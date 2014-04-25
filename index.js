var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var keypress = require('keypress');

keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();

// Create SerialPort instance
var sp = new SerialPort('/dev/cu.usbserial-A500SZXI', {
  baudrate: 115200,
  parser: serialport.parsers.readline('\n')
});

function zeroPad(num, places) {
  places = places || 2;
  var str = num+'';
  while (str.length < 2) {
    str = '0'+str;
  }
  return str;
}

var sessionStart = new Date().getTime();
function log(str) {
  var milliseconds = new Date().getTime() - sessionStart;
  var seconds = Math.round(milliseconds / 1000);
  var minutes = Math.round(seconds / 60);
  var hours = Math.round(minutes / 60);
  var dateStr = zeroPad(hours)+':'+zeroPad(minutes)+':'+zeroPad(seconds % 60);
  console.log('['+dateStr+'] '+str);
}

function sendCommand(command) {
  sp.write(command);
}

function sendState() {
  var state = processStick(speed, steer);

  console.log('State', state);

  // HB followed by 4 bytes of data sets the mode (0-2) and power (0-255) of each “H” bridge.
  var command = new Buffer(6);
  command.write('HB');
  command.writeUInt8(state.left.mode, 2);
  command.writeUInt8(state.left.pwm, 3);
  command.writeUInt8(state.right.mode, 4);
  command.writeUInt8(state.right.pwm, 5);

  sendCommand(command);
}

const MAX = 2000;
const MIN = 1000;
const STICKCENTER = 1500;
const STICKDEADBAND = 35;
const FORWARD = 2;
const BRAKE = 1;
const REVERSE = 0;

var speed = STICKCENTER;
var steer = STICKCENTER;
var increment = 25;

sp.on('open', function () {
  console.log('Serial port opened');

  sp.on('data', function(data) {
    log(data);
  });

  process.stdin.on('keypress', function(chunk, key) {
    if (!key) return;

    if (key.name === 'escape') {
      speed = 0;
      steer = 0;
      sendState();
    }
    else if (key.name === 'up') {
      if (speed < MAX) {
        speed += increment;
      }
      sendState();
    }
    else if (key.name === 'left') {
      if (steer > MIN) {
        steer -= increment;
      }
      sendState();
    }
    else if (key.name === 'down') {
      if (speed > MIN) {
        speed -= increment;
      }
      sendState();
    }
    else if (key.name === 'right') {
      if (steer < MAX) {
        steer += increment;
      }
      sendState();
    }
    else if (key.name === 'b') {
      sendCommand('BT');
    }
    else if (key.ctrl && key.name === 'c') {
      process.exit();
    }
  });
});

function scaleSpeed(speed) {
  // Scale 1000-2000uS to 0-255
  var pwm = Math.abs(speed-STICKCENTER)*10/12;

  // Set maximum limit 255
  pwm = Math.floor(Math.min(pwm, 255));

  return pwm;
}

/**
  steer: left/right, 1000 to 2000, 1500 is center
  speed: up/down, 1000 to 2000, 1500 is center
*/
function processStick(speed, steer) {
  // if speed input is within deadband set to 0
  if (Math.abs(speed-STICKCENTER) < STICKDEADBAND) {
    speed = STICKCENTER;
  }

  // if steer input is within deadband set to 0
  if (Math.abs(steer-STICKCENTER) < STICKDEADBAND) {
    steer = STICKCENTER;
  }

  // Mix speed and steering signals
  steer = steer - STICKCENTER;
  var leftSpeed = speed - steer;
  var rightSpeed = speed + steer;

  var leftMode = FORWARD;
  var rightMode = FORWARD;

  // if left input is forward then set left mode to forward
  if (leftSpeed > (STICKCENTER+STICKDEADBAND)) {
    leftMode = REVERSE;
  }

  // if right input is forward then set right mode to forward
  if (rightSpeed > (STICKCENTER+STICKDEADBAND)) {
    rightMode = REVERSE;
  }

  var LeftPWM = scaleSpeed(leftSpeed);
  var RightPWM = scaleSpeed(rightSpeed);

  return {
    left: {
      mode: leftMode,
      pwm: LeftPWM
    },
    right: {
      mode: rightMode,
      pwm: RightPWM
    }
  };
}


console.log('center:', processStick(1500, 1500));
console.log('full forward:', processStick(2000, 1500));
console.log('full backward:', processStick(1000, 1500));
console.log('full right:', processStick(1500, 2000));
console.log('full left:', processStick(1500, 1000));

