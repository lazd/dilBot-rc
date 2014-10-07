var constants = require('./constants');

module.exports = {
  driveMode: constants.mode.rc,

  camera: {
    fps: 10,
    port: 3001,
    device: 1
  },

  uiServer: {
    port: 3000
  },

  autonomy: {
    collisionDist: 50,
    speed: 120,
    steer: 320
  },

  rc: {
    range: 1000,
    center: 1800,
    deadband: 35
  },

  controller: {
    // debug: true,
    device: '/dev/ttyUSB2',
    baudRate: 115200,
    compassMode: constants.compass.filtered,
    compassFilter: {
      smoothFactor: 0.75,
      anomalyThreshold: 30
    }
  }
};
