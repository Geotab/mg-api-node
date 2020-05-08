# This project has been deprecated. Please use [mg-api-js](https://github.com/Geotab/mg-api-js).

# mg-api-node #

Unofficial nodejs client for the MyGeotab API

### Getting Started ###

```javascript
$ npm install mg-api-node --save
```

### Usage ###
```javascript
var api = new API(userName, password, database);

api.authenticate(function(err, data) {

  if(err){
    console.log('Error', err);
    return;
  }

  api.call('Get', {
    typeName: 'User',
    search: {
      name: data.userName
    }
  }, function(err, data) {

    if(err){
      console.log('Error', err);
      return;
    }

    console.log('User', data);

  });

});
```

#### HTTP Timeout ####

If you need to handle potential slow HTTP requests, you can access [request.setTimeout](https://nodejs.org/api/http.html#http_request_settimeout_timeout_callback) by passing an optional timeout (ms) and timeoutCallback to `api.call()` and `api.multicall()`:

```javascript
var api = new API(userName, password, database, server, {ssl: false}, sessionId);

// Timeout (ms) and TimeoutCallback
api.call('Get', {
  typeName: 'User',
  resultsLimit: 1
}, function(err, data) {
  if(err){
    console.log('Error', err);
    return;
  }
  console.log('User', data);
}, 10000, function(){
    console.log('Timeout');
});

// Just Timeout
api.call('Get', {
  typeName: 'User',
  resultsLimit: 1
}, function(err, data) {
  if(err){
    console.log('Error', err);
    return;
  }
  console.log('User', data);
}, 10000);

```

#### Session ID ####

It's also possible to supply session ID and direct server to re-use a session ID. This avoids costly authentication.

```javascript
var api = new API(userName, password, database, server, options, sessionId);

api.call('Get', {
  typeName: 'User',
  resultsLimit: 1
}, function(err, data) {

  if(err){
    console.log('Error', err);
    return;
  }

  console.log('User', data);

});

```

### Running Tests ###
```javascript
$ npm install -g mocha
$ npm install
$ mocha
```
