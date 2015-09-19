# mg-api-node #

Unofficial nodejs client for the MyGeotab API

### Getting Started ###

```
$ npm install mg-api-node --save
```

### Usage ###
```
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

### Running Tests ###
```
$ npm install -g mocha
$ npm install
$ mocha
```
