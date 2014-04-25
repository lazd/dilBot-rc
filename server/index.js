var log = require('./logger');
var Controller = require('./controller');
var cameraServer = require('./cameraServer')({ port: 3001 });
var uiServer = require('./uiServer')({ port: 3000 });
var socketServer = require('./socketServer')(uiServer);

var controller = new Controller('/dev/cu.usbserial-A500SZXI');

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
