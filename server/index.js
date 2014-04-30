var log = require('./logger');
var constants = require('./constants');

var Controller = require('./controller');
var AutoDrive = require('./autodrive');

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

var autodrive = new AutoDrive(controller);

// The bot will start in RC mode
var mode = constants.mode.rc;

controller.on('ready', function() {
  log('main: Robot is ready');

  // Switch mode to serial control once a connection is established
  setMode(constants.mode.serial);

  socketServer.io.sockets.emit('ready', {});
});

// Re-emit control errors as log
controller.on('error', function(err) {
  socketServer.io.sockets.emit('log', err.toString());
});

// Re-broadcast state updates from the bot
controller.on('state', function(state) {
  socketServer.io.sockets.emit('state', state);

  // Autonomous mode
  if (mode === constants.mode.autonomous) {
    autodrive.update(state);
  }
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
    // Set H bridge state
    controller.setState(event.data.throttle, event.data.steering);
  }
  else if (command === 'setMode') {
    // Set communication mode
    setMode(event.mode);
  }
  else if (command === 'stop') {
    // Stop
    controller.stop();
  }
  else if (command === 'charge') {
    // Enter charge mode
    controller.sendCommand('CH');
  }
  else if (command === 'write') {
    // Raw comamnd
    controller.sendCommand(event.data);
  }
});

function setMode(newMode) {
  if (newMode === constants.mode.autonomous) {
    // Autonomous control requires serial
    controller.setMode(constants.mode.serial);
  }
  else {
    controller.setMode(newMode);
  }

  log('main: Mode set to '+newMode);

  // Store mode
  mode = newMode;
}
