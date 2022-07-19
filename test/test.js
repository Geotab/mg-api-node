var expect = require('chai').expect;
var nock = require('nock');
var API = require('../api');

var userName = 'user@example.com';
var password = 'fakepassword';
var database = 'abc-fleets';
var server = 'my3.geotab.com';
var sessionId = 'abc1234';

var api = new API(userName, password, database);
var authenticate = api.authenticate;
var call = api.call;
var credentialsResult = {
    result: {
        path: server,
        credentials: {
            userName: userName,
            database: database,
            sessionId: sessionId
        }
    }
};

var invalidUserError = {
    error: {
        message: 'Incorrect MyGeotab login credentials @ \'g560\'',
        name: 'JSONRPCError',
        errors: [{
            message: 'Incorrect MyGeotab login credentials @ \'g560\'',
            name: 'InvalidUserException'
        }]
    }
};

describe('#authenticate', function () {
    var validateSuccess = function (err, data, server) {
        expect(err).to.be.a('null');

        expect(data.path).to.be.a('string');
        expect(data.path).to.equal(server);

        expect(data.credentials).to.be.a('object');
        expect(data.credentials).to.have.property('userName');
        expect(data.credentials.userName).to.be.a('string').and.to.equal(userName);
        expect(data.credentials).to.have.property('sessionId');
        expect(data.credentials.sessionId).to.be.a('string');
        expect(data.credentials).to.have.property('database');
        expect(data.credentials.database).to.be.a('string').and.to.equal(database);
    };

    it('creates API without userName', function () {
        expect(API).to.throw('Must supply userName');
    });

    it('creates API without password', function () {
        expect(API.bind(API, userName)).to.throw('Must supply password');
    });

    it('creates API without session id or password', function () {
        expect(API.bind(API, userName)).to.throw('Must supply password');
    });

    it('creates API with session id but no database or server', function () {
        expect(API.bind(API, userName, null, null, null, null, sessionId)).to.throw('Must supply database');
    });

    it('creates API with session id and a database but no server', function () {
        expect(API.bind(API, userName, null, database, null, null, sessionId)).to.not.throw();
    });

    it('creates API with session id and a server but no database', function () {
        expect(API.bind(API, userName, null, null, server, null, sessionId)).to.throw('Must supply database');
    });

    it('creates API with session id and a database, but a server that equals "my.geotab.com"', function () {
        expect(API.bind(API, userName, null, database, "my.geotab.com", null, sessionId)).to.not.throw();
    });

    it('creates API with session id, server, and database', function () {
        api = new API(userName, null, database, server, null, sessionId);
        expect(api.credentials.userName).to.be.a('string');
    });

    it('authenticate without callback', function () {
        api = new API(userName, password, database, server);
        expect(api.authenticate).to.throw('Must provide callback');
    });

    it('authenticate against unknown server', function (done) {
        api = new API(userName, password, database, 'my10000.geotab.com');
        api.authenticate(function (err, data) {
            expect(err).to.be.a('object');

            expect(err.code).to.be.a('string').and.to.equal('ENOTFOUND');
            done();
        });
    });

    it('handles non 200 response', function (done) {
        nock('https://www.example.com').post('/apiv1').reply(404);

        api = new API(userName, password, database, 'www.example.com');

        api.authenticate(function (err, data) {
            expect(err).to.be.a('object');

            expect(err.message).to.be.a('string');
            expect(err.message).to.equal('Not Found');
            expect(err.name).to.be.a('string');
            expect(err.name).to.equal('404');

            done();
        });
    });

    it('authenticates a user successfully [userName, password]', function (done) {
        nock('https://my.geotab.com').post('/apiv1').reply(200, credentialsResult);

        api = new API(userName, password);

        api.authenticate(function (err, data) {
            validateSuccess(err, data, server);
            done();
        });
    });

    it('authenticates a user successfully [userName, password, database]', function (done) {
        nock('https://my.geotab.com').post('/apiv1').reply(200, credentialsResult);

        api = new API(userName, password, database);

        api.authenticate(function (err, data) {
            validateSuccess(err, data, server);
            done();
        });
    });

    it('authenticates a user successfully [userName, password, database, server]', function (done) {
        credentialsResult.result.path = 'ThisServer';
        nock('https://my3.geotab.com').post('/apiv1').reply(200, credentialsResult);

        api = new API(userName, password, database, server);

        api.authenticate(function (err, data) {
            validateSuccess(err, data, 'ThisServer');
            credentialsResult.result.path = 'my3.geotab.com';
            done();
        });
    });

    it('authenticates with invalid credentials', function (done) {

        nock('https://my.geotab.com').post('/apiv1').reply(200, invalidUserError);

        api = new API('foo@bar.com', password, database);

        api.authenticate(function (err, data) {
            expect(err).to.be.a('object');
            expect(err).to.deep.equal(invalidUserError.error);
            done();
        });
    });
});

describe('#call', function () {
    var user = {
        result: [{
            name: userName
        }]
    };
    var version = {
        result: "5.7.1234.6"
    };

    it('gets user', function (done) {
        nock('https://my3.geotab.com').post('/apiv1').reply(200, credentialsResult);

        api = new API(userName, password, database, server);

        api.authenticate(function (err, data) {
            interceptor = nock('https://my3.geotab.com').post('/apiv1').reply(200, user);
            api.call('Get', {
                typeName: 'User',
                search: {
                    name: userName
                }
            }, function (err, data) {
                expect(err).to.be.a('null');
                expect(data).to.deep.equal(user.result);
                done();
            });
        });
    });

    it('makes call with no method', function () {
        expect(api.call).to.throw('Must provide method');
    });

    it('makes a call without params', function (done) {
        nock('https://my3.geotab.com').post('/apiv1').reply(200, version);

        api.call('GetVersion', null, function (err, data) {
            expect(err).to.be.a('null');

            expect(data).to.be.a('string');
            expect(data).to.equal(version.result);

            done();
        });
    });

    it('makes call with callback', function () {
        expect(api.call.bind(api.call, 'GetVersion', null)).to.throw('Must provide callback');
    });

    it('makes a call with unknown method', function (done) {
        var error = {
            error: {
                message: '',
                name: 'JSONRPCError',
                errors: [{
                    message: '',
                    name: 'MissingMethodException'
                }]
            }
        };

        nock('https://my3.geotab.com').post('/apiv1').reply(200, credentialsResult);

        api = new API(userName, password, database, server);

        api.authenticate(function (err, data) {
            nock('https://my3.geotab.com').post('/apiv1').reply(200, error);

            api.call('Get', {
                typeName: 'FooBar'
            }, function (err, data) {
                expect(err).to.be.a('object');
                expect(err).to.deep.equal(error.error);

                done();
            });
        });
    });

    it('makes a call with no compression', function (done) {
        nock('https://my3.geotab.com').post('/apiv1').reply(200, credentialsResult);

        api = new API(userName, password, database, server, {
            compression: null
        });

        api.authenticate(function (err, data) {
            nock('https://my3.geotab.com').post('/apiv1').reply(200, user);

            api.call('Get', {
                typeName: 'User',
                search: {
                    name: userName
                }
            }, function (err, data) {
                expect(err).to.be.a('null');
                expect(data).to.deep.equal(user.result);
                done();
            });
        });
    });

    it('re-authenticates and retries on invaliduserexception', function (done) {
        nock('https://my3.geotab.com').post('/apiv1').reply(200, credentialsResult);

        api = new API(userName, password, database, server, {
            compression: null
        });

        api.authenticate(function (err, data) {
            nock('https://my3.geotab.com').post('/apiv1').reply(200, invalidUserError)
                .post('/apiv1').reply(200, credentialsResult)
                .post('/apiv1').reply(200, user);

            api.call('Get', {
                typeName: 'User',
                search: {
                    name: userName
                }
            }, function (err, data) {
                expect(err).to.be.a('null');
                expect(data).to.deep.equal(user.result);
                done();
            });
        });
    });

    it('gets user using session id, database, and servername', function (done) {
        nock('https://my3.geotab.com').post('/apiv1').reply(200, credentialsResult);
        api = new API(userName, null, database, server, null, sessionId);

        api.call('Get', {
            typeName: 'User',
            search: {
                name: userName
            }
        }, function (err, data) {
            expect(err).to.be.a('null');
            expect(data.userName).to.equal(user.result.name);
            done();
        });
    });

    it('makes a call with timeout length only', function (done) {
        nock('https://my3.geotab.com').post('/apiv1').delay(200).reply(200, credentialsResult);
        api = new API(userName, null, database, server, {ssl: false}, sessionId);
        
        let timedOut = true;
        api.call('Get', {
            typeName: 'User',
            search: {
                name: userName
            }
        }, function (err, data) {
            timedOut = false;
            done();
        }, 100);
        expect(timedOut, 'api ran callback when timeout had passed');
    });

    it('makes a call with full timeout options', function (done) {
        nock('https://my3.geotab.com').post('/apiv1').delay(200).reply(200, credentialsResult);
        
        let timedOut = false;
        api.call('Get', {
            typeName: 'User',
            search: {
                name: userName
            }
        }, function (err, data) {
            done();
        }, 100, function(){
            timedOut = true;
            done();
        });
        expect(timedOut, 'api did not run timeoutCallback');
    });
});

describe('#multicall', function () {
    var calls = [
        ['Get', {
            typeName: 'User',
            search: {
                name: userName
            }
        }],
        ['GetVersion']
    ];

    it('multicall without calls', function () {
        expect(api.multicall).to.throw('Must provide calls');
    });

    it('multicall without callback', function () {
        expect(api.multicall.bind(api.multicall, calls, null)).to.throw('Must provide callback');
    });

    it('gets user and version', function (done) {
        var results = {
            result: [{
                name: userName
            }, '5.7.22334.11']
        };
        // http for convenience - api instance from above has ssl: false - gives 302 redirect as nock response with https
        nock('http://my3.geotab.com').post('/apiv1').reply(200, results);

        api.multicall(calls, function (err, data) {
            expect(err).to.be.a('null');
            expect(data).to.deep.equal(results.result);
            done();
        });
    });

    it('times out on multicall', function (done) {
        var results = {
            result: [{
                name: userName
            }, '5.7.22334.11']
        };
        nock('http://my3.geotab.com').post('/apiv1').delay(200).reply(200, results);
        let timedOut = false;
        api.multicall(calls, function (err, data) {
            done();
        }, 100, function() {
            timedOut = true;
        });
        expect(timedOut, 'Multicall did not timeout');
    });
});