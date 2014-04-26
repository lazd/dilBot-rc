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
  var dateStr = log.getTime(milliseconds, true);
  var args = Array.prototype.slice.call(arguments);
  args.splice(0, 1, '['+dateStr+'] '+str);
  console.log.apply(console, args);
}

log.getTime = function(milliseconds, alwaysIncludeHours) {
  var seconds = Math.round(milliseconds / 1000);
  var minutes = Math.round(seconds / 60);
  var hours = Math.round(minutes / 60);
  seconds = seconds % 60;
  
  var dateStr = '';

  if (hours || alwaysIncludeHours) {
    dateStr += zeroPad(hours)+':';
  }

  dateStr += zeroPad(minutes)+':'+zeroPad(seconds);
  
  return dateStr;
};

module.exports = log;
