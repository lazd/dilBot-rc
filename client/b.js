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
      joyCenter: 1500,
      joyWidth: null,
      logAutoScroll: true,
      imageFeedPort: 3001
    },

    state: null,

    init: function() {
      // Connect to sockets
      var socket = b.socket = io.connect();
      var feedSocket = b.feedSocket = io.connect('http://'+window.location.hostname+':'+b.config.imageFeedPort);

      socket.on('hello', function() {
        b.log('Connection established');
      });

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
      b.els.joystick = document.querySelector('.js-joystick');
      b.els.knob = document.querySelector('.js-knob');
      b.els.log = document.querySelector('.js-log');
      b.els.feed = document.querySelector('.js-feed');

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
      b.els.batteryHUD.textContent = (state.battery/VOLT).toFixed(2) +'v, ' + (state.isCharged ? 'charged' : 'charging');
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
