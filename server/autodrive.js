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

  // if (this.mode === modes.turnTo) {
  //   // Choose closest spin direction
  //   // var diff = state.heading - this.targetHeading;

  //   this.controller.setState(constants.rc.center, constants.rc.center + constants.autonomy.steer);
  //   // Try right
  //     // If heading hasn't changed in 1s, try left
  //   // Try left
  //     // If heading hasn't changed in 1s, try right

  //   // If heading is within 5 deg of desired heading
  //   if (Math.abs(this.targetHeading - state.heading) < 5) {
  //     // Set mode to forward
  //     this.mode = modes.go;
  //   }
  // }
  if (frontCollide || (leftCollide && rightCollide)) {
    // Both sensors detect a wall, we can't go forward
    // Turn around
    log('Turn around...');
    rightCollide = true;
  }

  if (rightCollide) {
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
