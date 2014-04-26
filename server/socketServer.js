var EventEmitter = require('events').EventEmitter;
var socket = require('socket.io');
var log = require('./logger');

module.exports = function(app) {
  // Open socket without logging
  io = socket.listen(app, { log: false });
  io.set('log level', 1);

  log('socketServer: Started');

  // Aggregate all events on a single emitter
  var emitter = new EventEmitter();

  io.sockets.on('connection', function(socket) {
    log('socketServer: Client connected from %s', socket.handshake.address.address);

    // Re-emit commands so they can be processed
    socket.on('command', function(data) {
      emitter.emit('command', data);
    });
  });

  // Store io as a property of the emitter for a cleaner API
  emitter.io = io;

  return emitter;
};
