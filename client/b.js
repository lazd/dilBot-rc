var b;

(function() {
  var REVERSE = 0;
  var BRAKING = 1;
  var FORWARD = 2;
  var VOLT = 67;

  b = {
    els: {},

    config: {
      sendInterval: 1000/24, // 24 times per second
      joyCenter: 1800,
      joyRange: 500,
      joyWidth: null,
      logAutoScroll: true,
      imageFeedPort: 3001,
      collisionDistance: 25 // Higher than the actual
    },

    state: null,

    init: function() {
      // Connect to sockets
      var socket = b.socket = io.connect();
      var feedSocket = b.feedSocket = io.connect('http://'+window.location.hostname+':'+b.config.imageFeedPort);

      socket.on('log', function(str) {
        b.log(str);
      });

      socket.on('state', function(state) {
        b.setHUD(state);
      });

      feedSocket.on('image', function(image) {
        b.updateFeed(image);
      });

      // Get elements
      b.els.throttleHUD = document.querySelector('.js-throttleHUD');
      b.els.batteryHUD = document.querySelector('.js-batteryHUD');
      b.els.fpsHUD = document.querySelector('.js-fpsHUD');
      b.els.headingHUD = document.querySelector('.js-headingHUD');
      b.els.distanceHUD = document.querySelector('.js-distanceHUD');
      b.els.commModeSelect = document.querySelector('.js-commModeSelect');

      b.els.headingYaw = document.querySelector('.js-headingYaw');
      b.els.joystick = document.querySelector('.js-joystick');
      b.els.knob = document.querySelector('.js-knob');
      b.els.log = document.querySelector('.js-log');
      b.els.feed = document.querySelector('.js-feed');

      b.els.leftDistHUD = document.querySelector('.js-leftDistText');
      b.els.centerDistHUD = document.querySelector('.js-centerDistText');
      b.els.rightDistHUD = document.querySelector('.js-rightDistText');

      b.els.leftDistHUDArrow = document.querySelector('.js-leftDistArrow');
      b.els.centerDistHUDArrow = document.querySelector('.js-centerDistArrow');
      b.els.rightDistHUDArrow = document.querySelector('.js-rightDistArrow');

      // Get the feed context
      b.feedCtx = b.els.feed.getContext('2d');

      // Set feed size
      b.setFeedSize();
      window.addEventListener('resize', b.setFeedSize, false);

      // Stop bouncing on scroll
      document.body.addEventListener('touchmove', b.stopEvent, false);

      // Be joystick-like
      b.els.joystick.addEventListener('touchstart', b.handleJoystickMove, false);
      b.els.joystick.addEventListener('touchmove', b.handleJoystickMove, false);
      b.els.joystick.addEventListener('touchend', b.handleJoystickStop, false);

      // Listen for mode changes
      b.els.commModeSelect.addEventListener('change', b.handleCommModeChange, false);

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

    updateFeed: function(image) {
      // Create image object from base64
      var newImage = new Image();
      newImage.src = 'data:image/png;base64,' + image;

      newImage.onload = function() {
        // Scale to fit canvas
        var height = b.canvasHeight;
        var scale = height / newImage.height;
        var width = newImage.width * scale;

        // Center the image
        var x = (b.canvasWidth - width) / 2;

        // Draw the image
        b.feedCtx.drawImage(newImage, x, 0, width, height);
      };

      // Store the last draw time
      var time = new Date().getTime();
      if (b.lastFrameTime) {
        var timeBetween = time - b.lastFrameTime;

        // @todo use a simple moving average instead
        if (b.lastDrawTime) {
          var weightRatio = 0.1;
          var timeToDraw = timeBetween * (1 - weightRatio) + b.lastDrawTime * weightRatio;
          var fps = 1000 / timeToDraw;
          b.els.fpsHUD.textContent = fps.toFixed(1);
        }

        b.lastDrawTime = timeBetween;
      }
      b.lastFrameTime = time;
    },

    setFeedSize: function() {
      b.els.feed.width = b.canvasWidth = document.body.offsetWidth;
      b.els.feed.height = b.canvasHeight = document.body.offsetHeight;
    },

    stopEvent: function(event) {
      event.stopPropagation();
      event.preventDefault();
    },

    adjustContinuum: function(percentage) {
      var joyMin = b.config.joyCenter - b.config.joyRange

      // Be a value percentage
      percentage = Math.min(Math.max(percentage, 0), 100);

      // Be within the expected range
      percentage = percentage * (b.config.joyRange * 2);

      // Be greater than the min
      percentage += joyMin;

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
      b.els.batteryHUD.textContent = (state.battery/VOLT).toFixed(2) + 'v' + (state.batteryDead ? ' (dead)' : '');

      b.els.headingHUD.textContent = state.heading;
      b.els.distanceHUD.textContent = 'L: ' + state.leftEncPos + ' R: ' + state.rightEncPos;

      b.els.leftDistHUD.textContent = state.leftDist;
      b.els.centerDistHUD.textContent = state.centerDist;
      b.els.rightDistHUD.textContent = state.rightDist;

      var leftColor = b.getDistanceColor(state.leftDist, b.config.collisionDistance);
      var centerColor = b.getDistanceColor(state.centerDist, b.config.collisionDistance);
      var rightColor = b.getDistanceColor(state.rightDist, b.config.collisionDistance);

      b.els.leftDistHUDArrow.style.opacity = b.getOpacityFromDistanceFactor(b.getDistanceFactor(state.leftDist, b.config.collisionDistance));
      b.els.centerDistHUDArrow.style.opacity = b.getOpacityFromDistanceFactor(b.getDistanceFactor(state.centerDist, b.config.collisionDistance));
      b.els.rightDistHUDArrow.style.opacity = b.getOpacityFromDistanceFactor(b.getDistanceFactor(state.rightDist, b.config.collisionDistance));

      b.els.leftDistHUDArrow.style.fill = leftColor;
      b.els.centerDistHUDArrow.style.fill = centerColor;
      b.els.rightDistHUDArrow.style.fill = rightColor;

      b.els.headingYaw.style.webkitTransform = 'rotate3d(0,0,1, '+(state.heading * -1)+'deg)';

      if (b.els.commModeSelect.value !== state.commMode) {
        b.els.commModeSelect.value = state.commMode;
      }
    },

    getDistanceFactor: function(value, min) {
      var factor = 1;
      var safeDistance = min * 4;
      if (value < min) {
        factor = 0;
      }
      else if (value < safeDistance) {
        factor = value / safeDistance;
      }

      factor = 1 - factor;

      return factor;
    },

    getOpacityFromDistanceFactor: function(factor) {
      return Math.max(factor * 0.85, 0.15);
    },

    getDistanceColor: function(value, min, withAlpha) {
      factor = b.getDistanceFactor(value, min)

      var red = 0;
      var green = 0;
      var blue = 0;

      if (factor >= 0 && factor < 0.5) {
        // First, green stays at 100%, red raises to 100%
        green = 1.0
        red = 2 * factor
      }
      else if (factor >= 0.5 && factor <= 1) {
        // Then red stays at 100%, green decays
        red = 1.0
        green = 1.0 - 2 * (factor-0.5)
      }

      red *= 255;
      green *= 255;
      blue *= 255;

      if (withAlpha) {
        var alpha = b.getOpacityFromDistanceFactor(factor);
        return 'rgba('+red.toFixed(0)+','+green.toFixed(0)+','+blue.toFixed(0)+','+alpha.toFixed(2)+')';
      }
      else {
        return 'rgb('+red.toFixed(0)+','+green.toFixed(0)+','+blue.toFixed(0)+')';
      }
    },

    handleCommModeChange: function(evt) {
      b.setMode(b.els.commModeSelect.value);
    },

    handleJoystickStop: function(evt) {
      b.stop();
      clearInterval(b.moveInterval);
    },

    handleJoystickMove: function(evt) {
      clearInterval(b.moveInterval);

      evt.stopPropagation();
      evt.preventDefault();

      var touch = evt.touches[0];

      var x = Math.min(b.config.joyWidth, Math.max(0, touch.clientX - b.els.joystick.offsetLeft));
      var y = Math.min(b.config.joyWidth, Math.max(0, touch.clientY - b.els.joystick.offsetTop));

      var steering = x;
      var throttle = b.config.joyWidth - y; // Invert, up is full throttle

      steering = b.adjustContinuum(steering / b.config.joyWidth);
      throttle = b.adjustContinuum(throttle / b.config.joyWidth);

      b.els.knob.classList.remove('b-transitionPosition');
      b.els.knob.style.left = x+'px';
      b.els.knob.style.top = y+'px';

      var doSend = function() {
        b.sendState({
          throttle: throttle,
          steering: steering
        });
      };

      // Immediately send the command
      doSend();

      // Resend command until we stop
      b.moveInterval = setInterval(doSend, b.config.sendInterval);
    },

    sendState: function(state) {
      b.config.throttle = state.throttle;
      b.config.steering = state.steering;

      b.socket.emit('command', {
        command: 'setState',
        data: state
      });
    },

    sendCommand: function(command, data) {
      b.socket.emit('command', {
        command: command,
        data: data
      });
    },

    setMode: function(mode) {
      b.socket.emit('command', {
        command: 'setMode',
        mode: mode
      });
    },

    stop: function() {
      clearInterval(b.moveInterval);
      b.sendCommand('stop');

      b.els.knob.classList.add('b-transitionPosition');
      b.els.knob.style.left = '50%';
      b.els.knob.style.top = '50%';
    }
  };

  window.onload = b.init;
}());
