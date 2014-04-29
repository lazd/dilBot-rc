var util = require('util');
var EventEmitter = require('events').EventEmitter;
var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var keypress = require('keypress');
var log = require('./logger');

const MAX = 2000;
const MIN = 1000;
const STICKCENTER = 1500;
const STICKDEADBAND = 35;
const FORWARD = 2;
const BRAKE = 1;
const REVERSE = 0;

var stateInterval;

// Create a controller constructor that inherits from EventEmitter
var Controller = function(device, options) {
  EventEmitter.call(this);

  options = options || {};

  // Debug mode
  this.debug = options.debug || false;

  // Serial device address
  this.device = device;

  // Serial port
  this.sp = null;

  // Robot's current state
  this.robotState = {};

  // Connect on the next tick so implementors can add listeners
  process.nextTick(this.connect.bind(this));
};

util.inherits(Controller, EventEmitter);

Controller.prototype.connect = function() {
  var controller = this;

  // Create SerialPort instance
  var sp = this.sp = new SerialPort(this.device, {
    baudrate: 115200,
    parser: serialport.parsers.readline('\n')
  }, false);

  sp.open(function(err) {
    if (err) {
      log('controller: Error connecting to serial: %s', err);

      controller.emit('error', err);
    }
  });

  sp.on('error', function(err) {
    log('controller: Error communicating over serial: %s', err);

    controller.emit('error', err);

    clearInterval(stateInterval);
  });

  sp.on('open', function() {
    log('controller: Serial connection opened');

    controller.emit('connected', {});

    sp.on('data', function(packet) {
      // Give raw data as packet
      controller.emit('packet', packet);

      // Log raw data
      if (controller.debug) {
        log(packet);
      }

      try {
        var message = JSON.parse(packet);
      }
      catch(err) {
        if (controller.debug) {
          log('controller: Discarding malformed message %s', packet)
          controller.emit('error', new Error('Got invalid message: '+err));
        }
        return;
      }

      // Send state
      var type = message.type || 'data';
      delete message.type;
      controller.emit(type, message);

      // @todo copy properties, don't overwrite
      if (type === 'state') {
        controller.robotState = message;
      }

      // Print log messages to the console
      if (type === 'log') {
        log(message.message);
      }
    });

    // Catch keypresses
    keypress(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', function(chunk, key) {
      if (!key) return;

      if (key.name === 'escape') {
        sendCommand('ST');
      }
      else if (key.name === 'b') {
        sendCommand('BT');
      }
      else if (key.ctrl && key.name === 'c') {
        process.exit();
      }
    });
  });
};

Controller.prototype.sendCommand = function(command) {
  // @todo do nothing unless connected
  this.sp.write(command);
};

Controller.prototype.stop = function(command) {
  this.sendCommand('ST');
};

Controller.prototype.setState = function(throttle, steer) {
  // @todo do nothing unless connected
  var state = processStick(throttle, steer);

  // HB followed by 4 bytes of data sets the mode (0-2) and power (0-255) of each “H” bridge.
  var command = new Buffer(6);
  command.write('HB');
  command.writeUInt8(state.left.mode, 2);
  command.writeUInt8(state.left.pwm, 3);
  command.writeUInt8(state.right.mode, 4);
  command.writeUInt8(state.right.pwm, 5);

  // @todo handshake to confirm settings, store state
  this.sendCommand(command);
};

function scaleSpeed(speed) {
  // Scale 1000-2000uS to 0-255
  var pwm = Math.abs(speed-STICKCENTER)*10/12;

  // Set maximum limit 255
  pwm = Math.floor(Math.min(pwm, 255));

  return pwm;
}

/*
  throttle: up/down, 2000 to 1000, 1500 is center (2000 is off and 1000 is full)
  steering: left/right, 1000 to 2000, 1500 is center
*/
function processStick(throttle, steering) {
  // if speed input is within deadband set to 0
  if (Math.abs(throttle - STICKCENTER) < STICKDEADBAND) {
    throttle = STICKCENTER;
  }

  // if steering input is within deadband set to 0
  if (Math.abs(steering - STICKCENTER) < STICKDEADBAND) {
    steering = STICKCENTER;
  }

  // Mix speed and steering signals
  steering = steering - STICKCENTER;
  var leftSpeed = throttle + steering;
  var rightSpeed = throttle - steering;

  var leftMode = REVERSE;
  var rightMode = REVERSE;

  // if left input is forward then set left mode to forward
  if (leftSpeed > (STICKCENTER + STICKDEADBAND)) {
    leftMode = FORWARD;
  }

  // if right input is forward then set right mode to forward
  if (rightSpeed > (STICKCENTER + STICKDEADBAND)) {
    rightMode = FORWARD;
  }

  var LeftPWM = scaleSpeed(leftSpeed);
  var RightPWM = scaleSpeed(rightSpeed);

  return {
    left: {
      mode: leftMode,
      pwm: LeftPWM
    },
    right: {
      mode: rightMode,
      pwm: RightPWM
    }
  };
}

module.exports = Controller;
