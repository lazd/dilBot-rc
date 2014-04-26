var connect = require('connect');
var http = require('http');
var log = require('./logger');
var path = require('path');

module.exports = function(options) {
  options = options || {};

  var port = options.port || 3000;
  var directory = options.directory || path.join(__dirname, '..', 'client');

  var app = connect()
    .use(connect.static(directory))
    .listen(port);

  log('uiServer: Started on port %d', port);

  return app;
};
