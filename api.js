'use strict';

const https = require('https');
const http = require('http');
const zlib = require('zlib');

module.exports = class MgApi {

    static make(userName, password, database, server, options) {
        return new this(userName, password, database, server, options);
    }
    constructor(userName, password, database, server, options) {
        console.assert(userName, 'Must supply userName')
        console.assert(password, 'Must supply password')

        this.userName = userName;
        this.password = password;
        this.database = database;
        this.rootServer = server || 'my.geotab.com';
        this.directServer = this.rootServer;
        this.tryCount = 0;

        this.options = {
            ssl: !options || options.ssl === undefined ? true : options.ssl,
            compression: options && options.hasOwnProperty('compression') ? options.compression : 'gzip'
        }
    }

    post (method, params, callback) {
        const paramsStr = this.getRpc(method, params);
        const option = this.getOptions(method, paramsStr);

        const done = (err, data) => {
            if (err) {
                return callback(err, data);

            }
            if(!data){
                return callback('no data returned');
            }

            data = JSON.parse(data);
            if (data.error) {
                return callback(data.error);
            }
            callback(null, data.result);
        };

        const post_req = (this.options.ssl ? https : http).request(option, function (res) {
            let response;
            const chunks = [];
            const encoding = res.headers['content-encoding'];

            if(res.statusCode !== 200) {
                return done({
                    name: res.statusCode.toString(),
                    message: http.STATUS_CODES[res.statusCode]
                }, null);
            }

            // pipe the response into the gunzip to decompress
            if (encoding === 'gzip') {
                response = zlib.createGunzip();
                res.pipe(response);
            } else {
                response = res;
            }

            // decompression chunk ready, add it to the chunks
            response.on('data', (data) => chunks.push(data.toString()));

            // response and decompression complete, join the buffer and return
            response.on('end', () => done(null, chunks.join('')));

            response.on('error', (e) => done(e, null));
        });

        post_req.on('error', (err) => callback(err, null));

        if (paramsStr) {
            post_req.write(paramsStr);
        }
        post_req.end();
    }

    getOptions (method, post_data) {
        console.log('method', method)
        const thisServer = (method === 'authenticate' ? this.rootServer : this.directServer).replace(/\S*:\/\//, '').replace(/\/$/, '');
        const opts = {
            host: thisServer,
            path: '/apiv1',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': post_data.length
            }
        };
        if (this.options.compression) {
            opts.headers['Accept-Encoding'] = this.options.compression;
        }
        return opts;
    }

    getRpc (method, params, callback) {
        let rpcString;
        try {
            rpcString = JSON.stringify({
                method: method || '',
                params: params
            });
        }
        catch (e) {
            return callback(e, null);
        }
        return 'JSON-RPC=' + encodeURIComponent(rpcString);
    }

    call (method, params, callback) {
        if(!method){
            throw new Error('Must provide method');
        }
        if(!callback){
            throw new Error('Must provide callback');
        }

        const doAuthenticate = (callback) => {
            this.authenticate((err, data) => {
                if(err){
                    callback(err, data);
                    return;
                }
                this.call(method, params, callback);

            });
        };

        if(!params){
            params = {};
        }

        if(!this.credentials){
            doAuthenticate(callback);
            return;
        }
        params.credentials = this.credentials;

        this.post(method, params, (err, data) => {
            let reauthenticate = false;

            if (err && err.errors) {
                // check if any errors require re-authentication
                err.errors.forEach((error) => {
                    const name = error.name.toLowerCase();
                    if (name.indexOf('invaliduserexception') > -1 || name.indexOf('dbunavailablexception') > -1) {
                        reauthenticate = true;
                    }
                });
            }

            if (reauthenticate === true && this.tryCount < 1) {
                this.tryCount++;
                doAuthenticate(callback);
            } else {
                this.tryCount = 0;
                callback(err, data);
            }
        });
    }

    multicall (calls, callback) {
        if(!calls){
            throw new Error('Must provide calls');
        }
        if(!callback){
            throw new Error('Must provide callback');
        }

        let formattedCalls = calls.map((call) => {
            return {
                method: call[0],
                params: call[1] || {}
            };
        });

        this.call('ExecuteMultiCall', { calls: formattedCalls }, callback);
    }

    authenticate (callback) {
        if(!callback){
            throw new Error('Must provide callback');
        }

        const params = {
            userName: this.userName,
            password: this.password,
            database: this.database,
            server: this.rootServer
        };


        this.post('Authenticate', params, (err, data) => {
            if(!err) {
                if (data.path && data.path !== 'ThisServer') {
                    this.directServer = data.path;
                }
                this.credentials = data.credentials;
            }
            callback(err, data);
        });
    }
};
