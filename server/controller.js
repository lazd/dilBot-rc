var util = require('util');
var EventEmitter = require('events').EventEmitter;
var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var log = require('./logger');
var constants = require('./constants');

var stateInterval;

var HeadingFilter = require('./HeadingFilter');

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

  // A heading filter
  this.filterHeading = HeadingFilter(0.35, 100);

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

    controller.emit('log', { message: 'Serial connection opened' });

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

      if (type === 'state') {
        // Smooth heading measurements
        message.heading = controller.filterHeading(message.heading);

        // @todo copy properties, don't overwrite
        controller.robotState = message;
      }
      else if (type === 'log') {
        // Print log messages to the console
        log('device: '+message.message);
      }

      controller.emit(type, message);
    });
  });
};

Controller.prototype.sendCommand = function(command) {
  // @todo do nothing unless connected
  this.sp.write(command);
};

Controller.prototype.stop = function() {
  this.sendCommand('ST');
};

// 0 - RC control
// 1 - Serial control
Controller.prototype.setMode = function(mode) {
  // MO followed by 1 byte indicating mode
  var command = new Buffer(3);
  command.write('MO');
  command.writeUInt8(mode, 2);

  this.sendCommand(command);
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

  this.sendCommand(command);
};

function scaleSpeed(speed) {
  // Scale 1000-2000uS to 0-255
  var pwm = Math.abs(speed - constants.rc.center) * 10 / 12;

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
  if (Math.abs(throttle - constants.rc.center) < constants.rc.deadband) {
    throttle = constants.rc.center;
  }

  // if steering input is within deadband set to 0
  if (Math.abs(steering - constants.rc.center) < constants.rc.deadband) {
    steering = constants.rc.center;
  }

  // Mix speed and steering signals
  steering = steering - constants.rc.center;
  var leftSpeed = throttle + steering;
  var rightSpeed = throttle - steering;

  var leftMode = constants.driveMode.reverse;
  var rightMode = constants.driveMode.reverse;

  // if left input is forward then set left mode to forward
  if (leftSpeed > (constants.rc.center + constants.rc.deadband)) {
    leftMode = constants.driveMode.forward;
  }

  // if right input is forward then set right mode to forward
  if (rightSpeed > (constants.rc.center + constants.rc.deadband)) {
    rightMode = constants.driveMode.forward;
  }

  var leftPWM = scaleSpeed(leftSpeed);
  var rightPWM = scaleSpeed(rightSpeed);

  return {
    left: {
      mode: leftMode,
      pwm: leftPWM
    },
    right: {
      mode: rightMode,
      pwm: rightPWM
    }
  };
}

module.exports = Controller;
