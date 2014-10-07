/**
Differential steer drive dead reckoning
Adapted from http://www.ridgesoft.com/articles/trackingposition/trackingposition.pdf
*/
var DeadReckoning = module.exports = function(options) {
  this.ticksPerRevolution = options.ticksPerRevolution;
  this.wheelDiameter = options.wheelDiameter;
  this.axleWidth = options.axleWidth;
  this.metersPerTick = Math.PI * this.wheelDiameter / this.ticksPerRevolution;
  this.radiansPerTick = Math.PI * (this.wheelDiameter / this.axleWidth) / this.ticksPerRevolution;

  this.previousLeftTicks = 0;
  this.previousRightTicks = 0;

  // x and y are meters
  // heading is radians
  this.position = {
    x: 0,
    y: 0,
    heading: 0
  }
};

DeadReckoning.prototype.update = function(leftTicks, rightTicks, heading) {
  var deltaLeft = leftTicks - this.previousLeftTicks; 
  var deltaRight = rightTicks - this.previousRightTicks; 
  var deltaDistance = 0.5 * (deltaLeft + deltaRight) * this.metersPerTick; 

  var deltaX = deltaDistance * Math.cos(this.position.heading); 
  var deltaY = deltaDistance * Math.sin(this.position.heading);
  var deltaHeading = (deltaRight - deltaLeft) * this.radiansPerTick;

  this.position.x += deltaX; 
  this.position.y += deltaY;

  // Use authoritative heading
  if (typeof heading !== 'undefined') {
    this.position.heading = heading;
  }
  else {
    this.position.heading -= deltaHeading;
  }

  // Stay within -2PI and 2PI
  this.position.heading = this.position.heading % (Math.PI * 2);

  // Store last tick location
  this.previousLeftTicks = leftTicks;
  this.previousRightTicks = rightTicks;

  return this.position;
};
