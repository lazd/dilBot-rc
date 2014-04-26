var cv = require('opencv');
var fs = require('fs');
var http = require('http');
var log = require('./logger');

module.exports = function(options) {
  options = options || {};

  var device = options.device || 1;
  var port = options.port || 3002;
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
    cameraStream.resume();

    res.connection.on('close', function() {
      log('camServer: client disconnected from %s', ip);

      var index = connections.indexOf(res);
      connections.splice(res, 1);

      // Stop streaming if nobody is connected
      if (connections.length === 0) {
        cameraStream.pause();
      }
    });
  });

  server.listen(port);
  log('camServer: Started on port %d', port);

  // Create a camera capture stream
  var camera = new cv.VideoCapture(device);
  var cameraStream = camera.toStream();
  var buffer = new Buffer(0);
  cameraStream.on('data', function(image) {
    buffer = image.toBuffer();

    sendToAll();
  });
};
