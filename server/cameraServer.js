var socket = require('socket.io');
var cv = require('opencv');
var log = require('./logger');

module.exports = function(options) {
  options = options || {};

  var device = options.device || 1;
  var port = options.port || 3001;
  var fps = options.fps || 12;
  var resolution = options.resolution || [160, 120];
  var connections = [];

  // Open socket without logging
  io = socket.listen(port, { log: false });
  io.set('log level', 1);

  // @todo is listen async? if so, don't log until socket actually open
  log('camServer: Started');

  io.sockets.on('connection', function(socket) {
    log('camServer: Client connected from %s', socket.handshake.address.address);
  });

  // Send each image to all connected clients
  function broadcastImage(buffer) {
    io.sockets.emit('image', buffer);
  }

  /*
  // Streaming
  // Create a camera capture stream
  var camera = new cv.VideoCapture(device);
  var cameraStream = camera.toStream();
  var buffer = new Buffer(0);

  cameraStream.on('error', function(err) {
    log('camServer: Error reading image from camera %s', err);
  });

  cameraStream.on('data', function(image) {
    // @todo check if resize is necessary
    image.resize(resolution[0], resolution[1]);
    buffer = image.toBuffer().toString('base64');
    broadcastImage();
  });

  cameraStream.read();
  */

  // Interval based
  var readTimeout;
  var camera;
  try {
    camera = new cv.VideoCapture(device);
  }
  catch (err) {
    log('camServer: Failed to open camera: ', err);
  }

  if (camera) {
    function getImage() {
      clearTimeout(readTimeout);
      camera.read(function(err, image) {
        if (err) {
          log('camServer: Error reading image from camera %s', err);
          return;
        }

        // @todo check if resize is necessary
        image.resize(resolution[0], resolution[1]);
        var buffer = image.toBuffer().toString('base64');
        broadcastImage(buffer);

        // @todo calculate correct delay based on time last frame sent
        readTimeout = setTimeout(getImage, 1000 / fps);
      });
    }

    getImage();
  }

  return io;
};
