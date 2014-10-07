var EventEmitter = require('events').EventEmitter;
var util = require('util');
var log = require('./logger');
var config = require('./config');
var Q = require('q');

var modes = {
  reverse: -1,
  brake: 0,
  forward: 1,
  turnLeft: 2,
  turnRight: 3,
  turnTo: 4,
  backOut: 5,
  turnToClearPath: 6
};

function getTurnMode(current, target) {
  if ((target - current + 360) % 360 > 180) {
    return modes.turnLeft;
  }
  else {
    return modes.turnRight;
  }
}

function getHeading(current, offset) {
  return Math.abs(current + offset) % 360;
}

var AutoDrive = module.exports = function(controller) {
  EventEmitter.call(this);

  // Store reference to controller
  this.controller = controller;

  // Start out going forward
  this.mode = modes.forward;

  // Be a reactive creature
  this.loop = this.react;
};

util.inherits(AutoDrive, EventEmitter);

AutoDrive.prototype.reverse = function() {
  this.controller.setState(config.rc.center - config.autonomy.speed, config.rc.center);
};

AutoDrive.prototype.brake = function() {
  this.controller.setState(config.rc.center, config.rc.center);
};

AutoDrive.prototype.forward = function() {
  this.controller.setState(config.rc.center + config.autonomy.speed, config.rc.center);
};

AutoDrive.prototype.turnLeft = function() {
  this.controller.setState(config.rc.center, config.rc.center - config.autonomy.steer);
};

AutoDrive.prototype.turnRight = function() {
  this.controller.setState(config.rc.center, config.rc.center + config.autonomy.steer);
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
      throw new Error('Cannot set mode ' + mode);
  }
}

AutoDrive.prototype.getCollisions = function() {
  var state = this.state;

  // Test for impending collisions
  var centerCollide = state.centerDist < config.autonomy.collisionDist;
  var leftCollide = state.leftDist < config.autonomy.collisionDist;
  var rightCollide = state.rightDist < config.autonomy.collisionDist;

  return {
    leftCollide: leftCollide,
    centerCollide: centerCollide,
    rightCollide: rightCollide,
    none: !leftCollide && !centerCollide && !rightCollide,
    some: leftCollide || centerCollide || rightCollide,
    all: leftCollide && centerCollide && rightCollide
  };
};

// Back up until we have no collisions
AutoDrive.prototype.backOut = function(cb) {
  log('Backing out...');

  this.mode = modes.backOut;

  var deferred = Q.defer();

  // On the next tick, we'll back out
  var doBackOut = function() {
    var collisions = this.collisions;
    if (!collisions.leftCollide || !collisions.rightCollide) {
      log('Done backing out!');
      // When one side is free, we're done
      this.mode = null;
      deferred.resolve();
    }
    else {
      // log('Backing out...');
      // Otherwise, keep backing out
      this.reverse();
    }
  };

  this.loop = doBackOut;

  return deferred.promise;
};

AutoDrive.prototype.turnToClearPath = function() {
  log('Looking for clear path...');

  var clearPathDist = config.autonomy.collisionDist * 2;

  var deferred = Q.defer();

  var collisions = this.collisions;

  // If there's no collision, return
  if (this.state.centerDist > clearPathDist) {
    log('Already clear!');
    deferred.resolve();

    return deferred.promise;
  }

  if (collisions.leftCollide && collisions.rightCollide) {
    deferred.reject(new Error("Can't turn, neither direction is clear!"));
    return false;
  }

  this.mode = modes.turnToClearPath;

  // Turn left by default
  var mode = modes.turnLeft;

  // If there's something blocking the left, turn right
  if (collisions.leftCollide) {
    mode = modes.turnRight;
  }

  var doTurn = function() {
    // var collisions = this.collisions;

    // Stop turning after time
    if (this.state.centerDist > clearPathDist) {
      log('Clear path found!');
      this.loop = null;
      deferred.resolve();
    }
    else {
      log('Turning %d...', this.state.centerDist);
      this.applyMode(mode);
    }
  };

  // On the next tick, we'll start turning
  this.loop = doTurn;

  return deferred.promise;
};

AutoDrive.prototype.react = function() {
  var self = this;
  var collisions = this.collisions;

  // if (collisions.centerCollide && collisions.leftCollide && collisions.rightCollide) {
  if (collisions.leftCollide && collisions.rightCollide) {
    // No clear path, can't turn or go forward
    return this.backOut()
      .then(
        function() {
          log('Back out complete! Will turn around now...');
          return self.turnToClearPath();
        },
        function(err) {
          log(err+', will try to resume operations..');
          self.mode = modes.forward;
          self.loop = self.react;
        }
      )
      .then(
        function() {
          log('Backout and turn both complete, resuming react mode...');
          self.mode = modes.forward;
          self.loop = self.react;
        }
      )
      .catch(function(error) {
        self.loop = null;
        log(err + ", don't know what to do!");
      });
  }
  else if (collisions.centerCollide) {
    return this.turnToClearPath()
      .then(
        function() {
          log('Clear path found, resuming react mode...');
          self.mode = modes.forward;
          self.loop = self.react;
        }
      )
      .catch(function(error) {
        self.loop = null;
        log(err + ", don't know what to do!");
      });
  }
  else if (collisions.rightCollide) {
    // Imminent collision on the right
    if (this.mode != modes.turnLeft) {
      log('Turn left...');
    }
    this.mode = modes.turnLeft;
    this.applyMode(this.mode);
  }
  else if (collisions.leftCollide) {
    // Imminent collision on the left
    if (this.mode != modes.turnRight) {
      log('Turn right...');
    }
    this.mode = modes.turnRight;
    this.applyMode(this.mode);
  }
  else {
    // Go forward
    if (this.mode != modes.forward) {
      log('Forward!');
    }
    this.mode = modes.forward;
    this.applyMode(this.mode);
  }
};

AutoDrive.prototype.update = function(state) {
  // Store the state
  this.state = state;

  // Test for impending collisions
  // Run this before the loop
  this.collisions = this.getCollisions();

  if (!state.batteryDead && this.loop) {
    this.loop();
  }
};
