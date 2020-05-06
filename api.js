var https = require('https');
var http = require('http');
var zlib = require('zlib');
module.exports = function (u, p, d, s, o, sId) {
    var credentials,
        userName = u,
        password = p,
        database = d,
        rootServer = s || 'my.geotab.com',
        directServer = rootServer,
        tryCount = 0,
        options = {
            ssl: !o || o.ssl === undefined ? true : o.ssl,
            compression: o && o.hasOwnProperty('compression') ? o.compression : 'gzip'
        },
        sessionId = sId;

    if (!userName) {
        throw new Error('Must supply userName')
    }

    if (!!sessionId) {
        if (!database || directServer === 'my.geotab.com') {
            throw new Error('Must supply database and server')
        }

        credentials = {
            userName,
            sessionId,
            database,
            serverName: directServer
        }
    } else if (!password) {
        throw new Error('Must supply password')
    }

    var post = function (method, params, callback, timeout, timeoutCallback) {
        var paramsStr = getRpc(method, params);
        var option = getOptions(method, paramsStr);
        var done = function (err, data) {
            if (err) {
                callback(err, data);
            } else {
                if (!data) {
                    callback("no data returned");
                    return;
                }
                data = JSON.parse(data);
                if (data.error) {
                    callback(data.error);
                    return;
                }
                callback(null, data.result);
            }
        };
        var post_req = (options.ssl ? https : http).request(option, function (res) {
            var response;
            var chunks = [];
            var encoding = res.headers['content-encoding'];
            if (res.statusCode !== 200) {
                done({
                    name: res.statusCode.toString(),
                    message: http.STATUS_CODES[res.statusCode]
                }, null);
                return;
            }
            // pipe the response into the gunzip to decompress
            if (encoding === 'gzip') {
                response = zlib.createGunzip();
                res.pipe(response);
            } else {
                response = res;
            }

            response.on('data', function (data) {
                // decompression chunk ready, add it to the chunks
                chunks.push(data.toString())
            });
            response.on('end', function () {
                // response and decompression complete, join the buffer and return
                done(null, chunks.join(''));
            });
            response.on('error', function (e) {
                done(e, null);
            });
        });

        if (typeof timeout === 'number' && !options.ssl){
            typeof timoutCallback === 'function' ? post_req.setTimeout(timeout, timeoutCallback) : post_req.setTimeout(timeout);
        }

        post_req.on('error', function (err) {
            callback(err, null)
        });
        if (paramsStr) {
            post_req.write(paramsStr);
        }
        post_req.end();
    };

    var getOptions = function (method, post_data) {
        var thisServer = (method === 'authenticate' ? rootServer : directServer).replace(/\S*:\/\//, '').replace(/\/$/, '');
        var opts = {
            host: thisServer,
            path: '/apiv1',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': post_data.length
            }
        };
        if (options.compression) {
            opts.headers['Accept-Encoding'] = options.compression;
        }
        return opts;
    };

    var getRpc = function (method, params, callback) {
        var rpcString;
        try {
            rpcString = JSON.stringify({
                method: method || '',
                params: params
            });
        } catch (e) {
            callback(e, null);
            return;
        }
        return 'JSON-RPC=' + encodeURIComponent(rpcString);
    };

    var call = function (method, params, callback, timeout = null, timeoutCallback = null) {
        var doAuthenticate = function (callback) {
            authenticate(function (err, data) {
                if (err) {
                    callback(err, data);
                } else {
                    call(method, params, callback);
                }
            });
        };

        if (!method) {
            throw new Error('Must provide method');
        }
        if (!params) {
            params = {};
        }
        if (!callback) {
            throw new Error('Must provide callback');
        }

        if (!credentials) {
            doAuthenticate(callback);
            return;
        }

        params.credentials = credentials;
        post(method, params, function (err, data) {
            var reauthenticate = false;

            if (err && err.errors) {
                // check if any errors require re-authentication
                err.errors.forEach(function (error) {
                    if (error.name.toLowerCase().indexOf("invaliduserexception") > -1 || error.name.toLowerCase().indexOf("dbunavailablexception") > -1) {
                        reauthenticate = true;
                    }
                });
            }

            if (reauthenticate === true && tryCount < 1) {
                tryCount++;
                doAuthenticate(callback);
            } else {
                tryCount = 0;
                callback(err, data);
            }
        }, timeout, timeoutCallback);
    };

    var multicall = function (calls, callback, timeout = null, timeoutCallback = null) {
        var formattedCalls;

        if (!calls) {
            throw new Error('Must provide calls');
        }
        if (!callback) {
            throw new Error('Must provide callback');
        }

        formattedCalls = calls.map(function (call) {
            var json = {
                method: call[0],
                params: call[1]
            };
            if (!json.params) {
                json.params = {};
            }
            return json;
        });

        call("ExecuteMultiCall", {
            calls: formattedCalls
        }, callback, timeout, timeoutCallback);
    };

    var authenticate = function (callback) {
        var params = {
            userName: userName,
            password: password,
            database: database,
            server: rootServer
        };

        if (!callback) {
            throw new Error('Must provide callback');
        }

        post('Authenticate', params, function (err, data) {
            if (!err) {
                if (data.path && data.path !== 'ThisServer') {
                    directServer = data.path;
                }
                credentials = data.credentials;
            }
            callback(err, data);
        });
    };

    return {
        authenticate: authenticate,
        call: call,
        multicall: multicall,
        credentials: credentials,
        server: rootServer
    }
};