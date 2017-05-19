var MP3, firstHeader, headerCount, mp3, _,
  __slice = [].slice;

MP3 = require("../src/streammachine/parsers/mp3");

_ = require("underscore");

mp3 = new MP3;

firstHeader = null;

headerCount = 0;

mp3.on("debug", (function(_this) {
  return function() {
    var msgs;
    msgs = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return console.log.apply(console, msgs);
  };
})(this));

mp3.on("id3v1", (function(_this) {
  return function(tag) {
    return console.log("id3v1: ", tag);
  };
})(this));

mp3.on("id3v2", (function(_this) {
  return function(tag) {
    return console.log("id3v2: ", tag, tag.length);
  };
})(this));

mp3.on("frame", (function(_this) {
  return function(buf, obj) {
    headerCount += 1;
    if (firstHeader) {
      if (_.isEqual(firstHeader, obj)) {

      } else {
        return console.log("Header " + headerCount + ": ", obj);
      }
    } else {
      firstHeader = obj;
      return console.log("First header: ", obj);
    }
  };
})(this));

process.stdin.pipe(mp3);

//# sourceMappingURL=parse_mp3_header.js.map
