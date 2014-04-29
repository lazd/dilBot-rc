var log = require('./logger');

var Controller = require('./controller');

var uiServer = require('./uiServer')({
  port: 3000
});

var socketServer = require('./socketServer')(uiServer);

var cameraServer = require('./cameraServer')({
  fps: 10,
  port: 3001,
  device: process.argv[3] ? parseInt(process.argv[3], 10) : 1
});

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

// Re-emit logs
controller.on('log', function(message) {
  socketServer.io.sockets.emit('log', message.message);
});

// Notify of battery state changes
controller.on('batteryDead', function(data) {
  var message = 'Battery dead';
  log(message);
  socketServer.io.sockets.emit('log', message);
});

controller.on('batteryCharged', function(data) {
  var message = 'Battery charge completed in '+log.getTime(data.time);
  log(message);
  socketServer.io.sockets.emit('log', message);
});

// Send commands to controller
socketServer.on('command', function(event) {
  var command = event.command;
  if (command === 'setState') {
    controller.setState(event.data.throttle, event.data.steering);
  }
  else if (command === 'stop') {
    controller.stop();
  }
});
