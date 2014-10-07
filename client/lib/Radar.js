var Radar = function(options) {
  options = options || {};

  // Set deafults
  this.zoom = options.zoom || Radar.defaultOptions.zoom;
  this.className = options.className || Radar.defaultOptions.className;
  this.selfColor = options.selfColor || Radar.defaultOptions.selfColor;
  this.selfSize = options.selfSize || Radar.defaultOptions.selfSize;
  this.pointColor = options.pointColor || Radar.defaultOptions.pointColor;
  this.pointSize = options.pointSize || Radar.defaultOptions.pointSize;

  // Always execute update in the context of this instance
  this.update = this.update.bind(this);

  // An array of points to draw
  this._points = [];

  // Create a canvas and add it to the DOM
  this.canvas = document.createElement('canvas');
  this.canvas.className = this.className;
  document.body.appendChild(this.canvas);
  
  // Store the size of the canvas
  this.size = this.canvas.offsetWidth;
  
  // Set the size of the canvas
  this.canvas.width = this.size;
  this.canvas.height = this.size;
  
  // Store a reference to the drawing context
  this.ctx = this.canvas.getContext('2d');
  
  // Draw around the center
  this.ctx.translate(this.size/2, this.size/2);
};

Radar.defaultOptions = {
  className: 'b-Radar',
  zoom: 0.1,
  selfColor: '#00FF00',
  selfSize: 2.5,
  pointColor: '#FF0000',
  pointSize: 1
};

Radar.prototype.toString = function() { return 'Radar'; };

Radar.prototype.destruct = function() {
  // Remove the canvas from the DOM
  document.body.removeChild(this.canvas);
};
  
Radar.prototype.addPoint = function(x, y, size, color) {
  x = Math.floor(x);
  y = Math.floor(y);

  var coords = x+','+y;

  // Track whether the point has been added yet
  if (this._points[coords]) { return; }
  this._points[coords] = true;

  this._points.push({
    x: x,
    y: y,
    size: size || this.pointSize,
    color: color || this.pointColor
  })
};

Radar.prototype._drawPoint = function(x, y, size, color) {
  this.ctx.beginPath();
  this.ctx.fillStyle = color;
  
  if (size === 1) {
    this.ctx.fillRect(x, y, 1, 1);
  }
  else {
    this.ctx.arc(x, y, 2.5, 0, Math.PI * 2, true);
  }
  
  this.ctx.closePath();
  this.ctx.fill();
};

Radar.prototype._getDrawPosition = function(position, offset, zoom) {
  var newPos = {
    x: (offset.x - position.x) * zoom,
    y: (offset.y - position.y) * zoom
  };
  
  return newPos;
};

Radar.prototype.update = function(x, y, rotation) {
  // Clear previous positions
  this.ctx.clearRect(-this.size/2, -this.size/2, this.size, this.size);

  // Rotate the radar to match our rotation
  this.ctx.rotate(rotation);
  
  // Store position of self to offset other blips
  var offset = { x: x, y: y };
  
  // Draw self in the center
  this._drawPoint(0, 0, this.selfSize, this.selfColor);
  
  var self = this;

  this._points.forEach(function(point) {
    // Offset the position of the blip based on my location
    var pos = self._getDrawPosition(point, offset, self.zoom);
    
    var maxPos = self.size/2-2;

    // Calculate position    
    if (Math.pow(-pos.x, 2) + Math.pow(-pos.y, 2) > Math.pow(maxPos, 2)) {
      var theta = Math.atan(pos.y / pos.x);
      if (pos.x < 0) theta += Math.PI;
      pos.x = Math.cos(theta) * maxPos;
      pos.y = Math.sin(theta) * maxPos;
    }

    // Draw the point
    self._drawPoint(pos.x, pos.y, self.pointSize, self.pointColor);
  });
  
  // Rotate back so we don't rotate in circles (rotate operations compound)
  this.ctx.rotate(-rotation);
};

if (typeof module !== 'undefined') {
  module.exports = Radar;
}
