// Read in configuration
var config = require('./config');

// Read in command line arguments
config.cameraDevice = process.argv[3] ? parseInt(process.argv[3], 10) : config.cameraDevice;
config.serialDevice = process.argv[2] || config.serialDevice;

var log = require('./logger');
var constants = require('./constants');

var Controller = require('./controller');
var AutoDrive = require('./autodrive');

var uiServer = require('./uiServer')(config.uiServer);

var socketServer = require('./socketServer')(uiServer);
var cameraServer = require('./cameraServer')(config.camera);

var controller = new Controller(config.controller);

var autodrive = new AutoDrive(controller);

// The bot's current mode of operation
var mode = config.mode;

controller.on('ready', function() {
  log('main: Robot is ready');

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

var keypress = require('keypress');

// Catch keypresses
keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('keypress', function(chunk, key) {
  if (!key) return;

  if (key.ctrl && key.name === 'c') {
    process.exit();
  }
  else if (key.name === 'escape') {
    controller.sendCommand('ST');
  }
  else if (key.name === 'c') {
    controller.sendCommand('CH');
  }
  else if (key.name === 's') {
    setMode(constants.mode.serial);
  }
  else if (key.name === 'a') {
    setMode(constants.mode.autonomous);
  }
  else if (key.name === 'r') {
    setMode(constants.mode.rc);
  }
});

function setMode(newMode) {
  newMode = parseInt(newMode, 10);

  log('main: Mode set to '+newMode);

  if (newMode === constants.mode.autonomous) {
    // Autonomous control requires serial
    controller.setMode(constants.mode.serial);
  }
  else {
    controller.setMode(newMode);
  }

  // Store mode
  mode = newMode;
}
