var b = {
  els: {},

  config: {
    joyCenter: 1500,
    joyWidth: null
  },

  init: function() {
    b.els.throttleHUD = document.querySelector('.js-throttleHUD');
    b.els.steeringHUD = document.querySelector('.js-steeringHUD');
    b.els.joystick = document.querySelector('.js-joystick');
    b.els.knob = document.querySelector('.js-knob');

    // document.body.addEventListener('touchmove', b.stopEvent, false);
    b.els.joystick.addEventListener('touchmove', b.handleJoystickMove, false);
    b.els.joystick.addEventListener('touchend', b.centerSticks, false);

    b.config.joyWidth = b.els.joystick.offsetWidth
    b.config.throttle = b.config.joyCenter;
    b.config.steering = b.config.joyCenter;

    b.setHUD();
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

  setHUD: function() {
    b.els.throttleHUD.textContent = b.config.throttle;
    b.els.steeringHUD.textContent = b.config.steering;
  },

  sendState: function(state) {
    b.config.throttle = state.throttle;
    b.config.steering = state.steering;
  },

  handleJoystickMove: function(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var touch = evt.touches[0];

    var x = Math.min(b.config.joyWidth, Math.max(0, touch.clientX - b.els.joystick.offsetLeft));
    var y = Math.min(b.config.joyWidth, Math.max(0, touch.clientY - b.els.joystick.offsetTop));

    var steering = x;
    var throttle = b.config.joyWidth - y; // Invert

    steering = b.adjustContinuum(steering / b.config.joyWidth);
    throttle = b.adjustContinuum(throttle / b.config.joyWidth);

    b.els.knob.classList.remove('b-transitionPosition');
    b.els.knob.style.left = x+'px';
    b.els.knob.style.top = y+'px';

    b.sendState({
      throttle: throttle,
      steering: steering
    });
    b.setHUD();
  },

  centerSticks: function() {
    b.els.knob.classList.add('b-transitionPosition');
    b.els.knob.style.left = '50%';
    b.els.knob.style.top = '50%';

    b.sendState({
      throttle: b.config.joyCenter,
      steering: b.config.joyCenter
    });
    b.setHUD();
  }
};

window.onload = b.init;
