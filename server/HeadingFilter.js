module.exports = function(_smoothFactor, _anomalyThreshold) {
  // The easing float that defines how smooth the movement will be (1 is no smoothing and 0 is never updating, my default is 0.5)

  var smoothFactor = _smoothFactor || 0.5;

  // The threshold in which the distance is big enough to turn immediatly (0 is jump always, 360 is never jumping, my default is 30)
  var anomalyThreshold = _anomalyThreshold || 30.0;
  var lastReading = 0.0;

  return function(newReading) {
    if (Math.abs(newReading - lastReading) < 180) {
      if (Math.abs(newReading - lastReading) > anomalyThreshold) {
        lastReading = newReading;
      }
      else {
        lastReading = lastReading + smoothFactor * (newReading - lastReading);
      }
    }
    else {
      if (360.0 - Math.abs(newReading - lastReading) > anomalyThreshold) {
        lastReading = newReading;
      }
      else {
        if (lastReading > newReading) {
          lastReading = (lastReading + smoothFactor * ((360 + newReading - lastReading) % 360) + 360) % 360;
        }
        else {
          lastReading = (lastReading - smoothFactor * ((360 - newReading + lastReading) % 360) + 360) % 360;
        }
      }
    }

    return lastReading;
  }
};
