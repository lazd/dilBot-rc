/**
A low-pass compass filter
Based on http://stackoverflow.com/a/6462517/1170723
*/
var CompassFilter = module.exports = function(options) {
  // The easing float that defines how smooth the movement will be (1 is no smoothing and 0 is never updating, my default is 0.5)
  this.smoothFactor = options.smoothFactor || 0.5;

  // The threshold in which the distance is big enough to turn immediatly (0 is jump always, 360 is never jumping, my default is 30)
  this.anomalyThreshold = options.anomalyThreshold || 30.0;

  this.heading = 0.0;
};

CompassFilter.prototype.update = function(newHeading) {
  if (Math.abs(newHeading - this.heading) < 180) {
    if (Math.abs(newHeading - this.heading) > this.anomalyThreshold) {
      this.heading = newHeading;
    }
    else {
      this.heading = this.heading + this.smoothFactor * (newHeading - this.heading);
    }
  }
  else {
    if (360.0 - Math.abs(newHeading - this.heading) > this.anomalyThreshold) {
      this.heading = newHeading;
    }
    else {
      if (this.heading > newHeading) {
        this.heading = (this.heading + this.smoothFactor * ((360 + newHeading - this.heading) % 360) + 360) % 360;
      }
      else {
        this.heading = (this.heading - this.smoothFactor * ((360 - newHeading + this.heading) % 360) + 360) % 360;
      }
    }
  }

  return this.heading;
};
