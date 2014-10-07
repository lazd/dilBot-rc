module.exports = {
  encoders: {
    // The number of ticks from the encoder per wheel revolution
    ticksPerRevolution: 1200
  },
  dimensions: {
    // The diameter of a wheel in meters
    wheelDiameter: 0.12,

    // The distance between the center of the wheels
    axleWidth: 0.325
  },
  compass: {
    raw: 0,
    filtered: 1,
    deadReckoning: 2
  },
  mode: {
    rc: 0,
    serial: 1,
    autonomous: 2
  },
  driveMode: {
    reverse: 0,
    brake: 1,
    forward: 2
  }
};
