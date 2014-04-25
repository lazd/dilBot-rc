var b;

(function() {
  var REVERSE = 0;
  var BRAKING = 1;
  var FORWARD = 2;

  b = {
    els: {},

    config: {
      joyCenter: 1500,
      joyWidth: null,
      logAutoScroll: true
    },

    state: null,

    init: function() {
      // Connect to socket
      var socket = b.socket = io.connect();

      socket.on('hello', function() {
        b.log('Connection established');
      });

      socket.on('log', function(str) {
        b.log(str);
      });

      socket.on('state', function(state) {
        b.setHUD(state);
      });

      // Get elements
      b.els.throttleHUD = document.querySelector('.js-throttleHUD');
      b.els.batteryHUD = document.querySelector('.js-batteryHUD');
      b.els.joystick = document.querySelector('.js-joystick');
      b.els.knob = document.querySelector('.js-knob');
      b.els.log = document.querySelector('.js-log');

      // Stop bouncing
      document.body.addEventListener('touchmove', b.stopEvent, false);

      // Be joystick-like
      b.els.joystick.addEventListener('touchstart', b.handleJoystickMove, false);
      b.els.joystick.addEventListener('touchmove', b.handleJoystickMove, false);
      b.els.joystick.addEventListener('touchend', b.stop, false);

      b.config.joyWidth = b.els.joystick.offsetWidth
      b.config.throttle = b.config.joyCenter;
      b.config.steering = b.config.joyCenter;
    },

    log: function(str) {
      var div = document.createElement('div');
      div.className = 'b-Log-entry';
      div.textContent = str;
      b.els.log.appendChild(div);

      // Scroll to bottom
      if (b.config.logAutoScroll) {
        b.els.log.scrollTop = b.els.log.scrollHeight;
      }
    },

    stopEvent: function(event) {
      event.stopPropagation();
      event.preventDefault();
    },

    adjustContinuum: function(percentage) {
      percentage = Math.min(Math.max(percentage, 0), 1000);

      // Fit in 1000
      percentage = percentage * 1000;

      // With a minimum of 1000
      percentage += 1000;

      return Math.floor(percentage);
    },

    getThrottleValue: function(pwm, mode) {
      if (mode === FORWARD) {
        return pwm;
      }
      else if (mode === REVERSE) {
        return pwm * -1;
      }
      else {
        // Braking
        return 0;
      }
    },

    setHUD: function(state) {
      b.state = state;
      b.els.throttleHUD.textContent = b.getThrottleValue(state.leftPWM, state.leftMode) + ' : ' + b.getThrottleValue(state.rightPWM, state.rightMode);
      b.els.batteryHUD.textContent = (state.battery/65) +'v, ' + state.isCharged ? 'charged' : 'charging';
    },

    handleJoystickMove: function(evt) {
      evt.stopPropagation();
      evt.preventDefault();

      var touch = evt.touches[0];

      var x = Math.min(b.config.joyWidth, Math.max(0, touch.clientX - b.els.joystick.offsetLeft));
      var y = Math.min(b.config.joyWidth, Math.max(0, touch.clientY - b.els.joystick.offsetTop));

      var steering = x;
      var throttle = b.config.joyWidth - y; // Invert, up is full throttle
      // var throttle = y;

      steering = b.adjustContinuum(steering / b.config.joyWidth);
      throttle = b.adjustContinuum(throttle / b.config.joyWidth);

      b.els.knob.classList.remove('b-transitionPosition');
      b.els.knob.style.left = x+'px';
      b.els.knob.style.top = y+'px';

      b.sendState({
        throttle: throttle,
        steering: steering
      });
    },

    sendState: function(state) {
      b.config.throttle = state.throttle;
      b.config.steering = state.steering;

      b.socket.emit('command', {
        command: 'setState',
        data: state
      });
    },

    stop: function() {
      b.els.knob.classList.add('b-transitionPosition');
      b.els.knob.style.left = '50%';
      b.els.knob.style.top = '50%';

      b.sendState({
        throttle: b.config.joyCenter,
        steering: b.config.joyCenter
      });
    }
  };

  window.onload = b.init;
}());
