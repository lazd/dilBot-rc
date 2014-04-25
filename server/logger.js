var sessionStart = new Date().getTime();

function zeroPad(num, places) {
  places = places || 2;
  var str = num+'';
  while (str.length < 2) {
    str = '0'+str;
  }
  return str;
}

function log(str) {
  var milliseconds = new Date().getTime() - sessionStart;
  var seconds = Math.round(milliseconds / 1000);
  var minutes = Math.round(seconds / 60);
  var hours = Math.round(minutes / 60);
  var dateStr = zeroPad(hours)+':'+zeroPad(minutes)+':'+zeroPad(seconds % 60);
  var args = Array.prototype.slice.call(arguments);
  args.splice(0, 1, '['+dateStr+'] '+str);
  console.log.apply(console, args);
}

module.exports = log;
