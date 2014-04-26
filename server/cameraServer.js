var cv = require('opencv');
var fs = require('fs');
var http = require('http');
var log = require('./logger');

module.exports = function(options) {
  options = options || {};

  var device = options.device || 1;
  var port = options.port || 3002;
  var fps = options.fps || 4;
  var connections = [];

  // Send each image to all connected clients
  function sendToAll() {
    connections.forEach(sendToOne);
  }

  // Send an image to a given client
  function sendToOne(res) {
    res.write('--mjpegBoundry\r\n');
    res.write('Content-Type: image/jpeg\r\n');
    res.write('Content-Length: ' + buffer.length + '\r\n');
    res.write('\r\n');
    res.write(buffer, 'binary');
    res.write('\r\n');
  }

  var server = http.createServer(function(req, res) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    log('camServer: client connected from %s', ip);

    // Store a reference to each connection
    connections.push(res);

    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=mjpegBoundry',
      'Cache-Control': 'no-cache',
      'Connection': 'close',
      'Pragma': 'no-cache'
    });

    // Start streaming when someone connects
    // @todo don't make this call unless the stream is paused
    startPolling();

    res.connection.on('close', function() {
      log('camServer: client disconnected from %s', ip);

      var index = connections.indexOf(res);
      connections.splice(res, 1);

      // Stop streaming if nobody is connected
      if (connections.length === 0) {
        stopPolling();
      }
    });
  });

  server.listen(port);
  log('camServer: Started on port %d', port);

  function startPolling() {
    if (!pollCamera) {
      pollCamera = true;
      getImage();
    }
  }

  function stopPolling() {
    pollCamera = false;
    clearTimeout(pollTimeout);
  }

  // Create a camera capture stream
  var pollCamera = false;
  var camera = new cv.VideoCapture(device);
  var buffer = new Buffer(0);

  var pollTimeout;
  function getImage() {
    camera.read(function(err, image) {
      if (err) {
        log('camServer: Error reading image from camera %s', err);
        return;
      }

      buffer = image.toBuffer();

      sendToAll();

      // Do next poll
      if (pollCamera) {
        pollTimeout = setTimeout(getImage, 1000 / fps);
      }
    });
  }
};
