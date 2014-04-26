var gpsd = require('node-gpsd');
var log = require('./logger');

module.exports = function() {
  var listener = new gpsd.Listener({
    port: 2947,
    hostname: 'localhost'
  });

  listener.connect();

  listener.on('connected', function() {
    log('gps: Connected to gpsd');
    listener.watch();
  });

  listener.on('TPV', function(data) {
    log('gps: ', data);
  });

  listener.on('SKY', function(info) {
    log('gps: satellites', info);
  });

  listener.on('INFO', function(info) {
    log('gps: info', info);
  });

  listener.on('DEVICES', function(info) {
    log('gps: devices', info);
  });

  listener.on('PPS', function(info) {
    log('gps: pps', info);
  });

  listener.on('disconnected', function() {
    log('gps: Connection to gpsd lost');
  });

  listener.on('error', function(err) {
    log('gps: Error in message from gpsd: %s', err);
  });

  // @todo provide custom interface
  return listener;
};
