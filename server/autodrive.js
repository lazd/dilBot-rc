var EventEmitter = require('events').EventEmitter;
var util = require('util');
var log = require('./logger');
var constants = require('./constants');

var modes = {
  go: 0,
  turnAround: 1,
  turnLeft: 2,
  turnRight: 3
};

var AutoDrive = module.exports = function(controller) {
  EventEmitter.call(this);

  // Store reference to controller
  this.controller = controller;
};

util.inherits(AutoDrive, EventEmitter);

AutoDrive.prototype.update = function(state) {
  // Test for impending collisions
  var frontCollide = state.centerDist < constants.autonomy.collisionDist;
  var leftCollide = state.leftDist < constants.autonomy.collisionDist;
  var rightCollide = state.rightDist < constants.autonomy.collisionDist;

  if (frontCollide || (leftCollide && rightCollide)) {
    // Both sensors detect a wall, we can't go forward
    // Turn around
    if (this.mode != modes.turnAround) {
      log('Turn around...');
    }
    this.mode = modes.turnAround;
    this.controller.stop();
  }
  else if (rightCollide) {
    // Turn left
    if (this.mode != modes.turnLeft) {
      log('Turn left...');
    }
    this.controller.setState(constants.rc.center, constants.rc.center - constants.autonomy.steer);
    this.mode = modes.turnLeft;
  }
  else if (leftCollide) {
    // Turn right
    if (this.mode != modes.turnRight) {
      log('Turn right...');
    }
    this.controller.setState(constants.rc.center, constants.rc.center + constants.autonomy.steer);
    this.mode = modes.turnRight;
  }
  else {
    // Go forward
    if (this.mode != modes.go) {
      log('Go forward...');
    }
    this.controller.setState(constants.rc.center + constants.autonomy.speed, constants.rc.center);
    this.mode = modes.go;
  }
};
