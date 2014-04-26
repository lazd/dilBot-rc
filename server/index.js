var log = require('./logger');

var Controller = require('./controller');

var cameraServer = require('./cameraServer')({
  device: process.argv[3] ? parseInt(process.argv[3], 10) : 1,
  port: 3001
});

var uiServer = require('./uiServer')({
  port: 3000
});

var socketServer = require('./socketServer')(uiServer);

var controller = new Controller(process.argv[2] || '/dev/ttyUSB1', {
  debug: false
});

controller.on('connected', function() {
  socketServer.io.sockets.emit('hello', {});
});

// Re-emit control errors as log
controller.on('error', function(err) {
  socketServer.io.sockets.emit('log', err.toString());
});

// Re-broadcast state updates from the bot
controller.on('state', function(state) {
  socketServer.io.sockets.emit('state', state);
});

// Send commands to controller
socketServer.on('command', function(event) {
  if (event.command === 'setState') {
    controller.setState(event.data.throttle, event.data.steering);
  }
});
