var EventEmitter = require('events').EventEmitter;
var util = require('util');
var log = require('./logger');
var constants = require('./constants');

var modes = {
  reverse: -1,
  brake: 0,
  forward: 1,
  turnLeft: 2,
  turnRight: 3,
  turnTo: 4
};

var AutoDrive = module.exports = function(controller) {
  EventEmitter.call(this);

  // Store reference to controller
  this.controller = controller;
};

util.inherits(AutoDrive, EventEmitter);

AutoDrive.prototype.reverse = function() {
  this.controller.setState(constants.rc.center - constants.autonomy.speed, constants.rc.center);
};

AutoDrive.prototype.brake = function() {
  this.controller.setState(constants.rc.center, constants.rc.center);
};

AutoDrive.prototype.forward = function() {
  this.controller.setState(constants.rc.center + constants.autonomy.speed, constants.rc.center);
};

AutoDrive.prototype.turnLeft = function() {
  this.controller.setState(constants.rc.center, constants.rc.center + constants.autonomy.steer);
  this.lastTurn = modes.turnLeft;
};

AutoDrive.prototype.turnRight = function() {
  this.controller.setState(constants.rc.center, constants.rc.center - constants.autonomy.steer);
  this.lastTurn = modes.turnRight;
};

AutoDrive.prototype.applyMode = function(mode) {
  switch(mode) {
    case modes.turnLeft:
      this.turnLeft();
      break;
    case modes.turnRight:
      this.turnRight();
      break;
    case modes.forward:
      this.forward();
      break;
    case modes.reverse:
      this.reverse();
      break;
    case modes.brake:
      this.brake();
      break;
    default:
      log('Invalid mode %s', mode);
  }
}

AutoDrive.prototype.getCollisions = function() {
  var state = this.state;

  // Test for impending collisions
  var centerCollide = state.centerDist < constants.autonomy.collisionDist;
  var leftCollide = state.leftDist < constants.autonomy.collisionDist;
  var rightCollide = state.rightDist < constants.autonomy.collisionDist;

  return {
    leftCollide: leftCollide,
    centerCollide: centerCollide,
    rightCollide: rightCollide,
    none: !leftCollide && !centerCollide && !rightCollide,
    some: leftCollide || centerCollide || rightCollide,
    all: leftCollide && centerCollide && rightCollide
  };
};

AutoDrive.prototype.update = function(state) {
  this.state = state;

  // Test for impending collisions
  var collisions = this.getCollisions();

 if (collisions.centerCollide) {
    // Both sensors or middle sensor detects a wall, we can't go forward

    // If last mode was left turn, turn left
    if (this.lastTurn === modes.turnLeft && !collisions.leftCollide) {
      log('Keep turning left...');
      this.mode = modes.turnLeft;
    }
    else if (this.lastTurn === modes.turnRight && !collisions.rightCollide) {
      log('Keep turning right...');
      this.mode = modes.turnRight;
    }
    else {
      log('Reverse!');
      this.mode = modes.reverse;
    }
  }
  else if (collisions.rightCollide) {
    // Turn left
    if (this.mode != modes.turnLeft) {
      log('Turn left...');
    }
    this.mode = modes.turnRight;
  }
  else if (collisions.leftCollide) {
    // Turn right
    if (this.mode != modes.turnRight) {
      log('Turn right...');
    }
    this.mode = modes.turnLeft;
  }
  else {
    // Go forward
    if (this.mode != modes.forward) {
      log('Forward!');
    }
    this.mode = modes.forward;
  }

  this.applyMode(this.mode);
};
