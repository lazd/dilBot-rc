var util = require('util');
var EventEmitter = require('events').EventEmitter;
var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var log = require('./logger');
var constants = require('./constants');
var config = require('./config');

var CompassFilter = require('./lib/CompassFilter');
var DSDDeadReckoning = require('./lib/DSDDeadReckoning');

// Create a controller constructor that inherits from EventEmitter
var Controller = function(options) {
  EventEmitter.call(this);

  options = options || {};

  // Debug mode
  this.debug = options.debug || false;

  // Serial device address
  this.device = options.device;

  // Serial baud rate
  this.baudRate = options.baudRate;

  // Serial port
  this.serialPort = null;

  // Robot's current state
  this.robotState = {};

  // Compass filtering mode
  this.compassMode = typeof options.compassMode !== 'undefined' ? options.compassMode : constants.compass.raw;

  // A heading filter
  this.compassFilter = new CompassFilter(options.compassFilter);

  this.deadReckoning = new DSDDeadReckoning({
    // The number of ticks from the encoder per wheel revolution
    ticksPerRevolution: constants.encoders.ticksPerRevolution,

    // The diameter of a wheel in meters
    wheelDiameter: constants.dimensions.wheelDiameter,

    // The distance between the center of the wheels
    axleWidth: constants.dimensions.axleWidth
  });

  // Connect on the next tick so implementors can add listeners
  process.nextTick(this.connect.bind(this));
};

util.inherits(Controller, EventEmitter);

Controller.prototype.connect = function() {
  var self = this;

  // Create SerialPort instance
  var sp = this.serialPort = new SerialPort(this.device, {
    baudrate: this.baudRate,
    parser: serialport.parsers.readline('\n')
  }, false);

  sp.open(function(err) {
    if (err) {
      log('controller: Error connecting to serial: %s', err);

      self.emit('error', err);
    }
  });

  sp.on('error', function(err) {
    log('controller: Error communicating over serial: %s', err);

    self.emit('error', err);
  });

  sp.on('open', function() {
    log('controller: Serial connection opened');

    self.emit('log', { message: 'Serial connection opened' });

    sp.on('data', function(packet) {
      // Give raw data as packet
      self.emit('packet', packet);

      // Log raw data
      if (self.debug) {
        log(packet);
      }

      try {
        var message = JSON.parse(packet);
      }
      catch(err) {
        if (self.debug) {
          log('controller: Discarding malformed message %s', packet)
          self.emit('error', new Error('Got invalid message: '+err));
        }
        return;
      }

      // Send state
      var type = message.type || 'data';
      delete message.type;

      if (type === 'state') {
        if (this.compassMode === constants.compass.filtered) {
          // Smooth heading measurements from magnetometer
          message.heading = self.compassFilter.update(message.heading);

          // Update dead reckoning using compass heading
          message.position = self.deadReckoning.update(message.leftTicks, message.rightTicks, (message.heading * Math.PI) / 180);
        }
        else if (this.compassMode === constants.compass.deadReckoning) {
          // Update dead reckoning using compass heading using previously calculated heading
          message.position = self.deadReckoning.update(message.leftTicks, message.rightTicks);

          // Sending heading calculated from dead reckoning
          message.heading = message.position.heading * 180 / Math.PI;

          // Give a standard compass heading
          if (message.heading < 0) {
            message.heading += 360;
          }
        }
        else {
          // Use heading as provided
          // Update dead reckoning using compass heading
          message.position = self.deadReckoning.update(message.leftTicks, message.rightTicks, (message.heading * Math.PI) / 180);
        }

        if (self.debug) {
          var headingMethodString = this.compassMode === constants.compass.filtered ? 'compass' : (this.compassMode === constants.compass.deadReckoning ? 'encoders' : 'raw');
          log('controller: x: %s\ty: %s\tθ: %s\t via %s\t at %s', message.position.x.toFixed(3), message.position.y.toFixed(3), message.heading.toFixed(3), headingMethodString, new Date().getTime());
        }

        // @todo copy properties, don't overwrite
        self.robotState = message;
      }
      else if (type === 'log') {
        // Print log messages to the console
        log('device: '+message.message);
      }

      self.emit(type, message);
    });
  });
};

Controller.prototype.sendCommand = function(command) {
  // @todo do nothing unless connected
  this.serialPort.write(command);
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
  var pwm = Math.abs(speed - config.rc.center) * 10 / 12;

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
  if (Math.abs(throttle - config.rc.center) < config.rc.deadband) {
    throttle = config.rc.center;
  }

  // if steering input is within deadband set to 0
  if (Math.abs(steering - config.rc.center) < config.rc.deadband) {
    steering = config.rc.center;
  }

  // Mix speed and steering signals
  steering = steering - config.rc.center;
  var leftSpeed = throttle + steering;
  var rightSpeed = throttle - steering;

  var leftMode = constants.driveMode.reverse;
  var rightMode = constants.driveMode.reverse;

  // if left input is forward then set left mode to forward
  if (leftSpeed > (config.rc.center + config.rc.deadband)) {
    leftMode = constants.driveMode.forward;
  }

  // if right input is forward then set right mode to forward
  if (rightSpeed > (config.rc.center + config.rc.deadband)) {
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
