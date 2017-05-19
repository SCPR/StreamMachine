var AAC, aac, ema, ema_alpha, firstHeader, headerCount, _;

AAC = require("../src/streammachine/parsers/aac");

_ = require("underscore");

aac = new AAC;

firstHeader = null;

headerCount = 0;

ema_alpha = 2 / (40 + 1);

ema = null;

aac.on("frame", (function(_this) {
  return function(buf, header) {
    var bitrate;
    headerCount += 1;
    bitrate = header.frame_length / header.duration * 1000 * 8;
    ema || (ema = bitrate);
    ema = ema_alpha * bitrate + (1 - ema_alpha) * ema;
    console.log("header " + headerCount + ": " + bitrate + " (" + (Math.round(ema / 1000)) + ")");
    return true;
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

process.stdin.pipe(aac);

//# sourceMappingURL=parse_aac_headers.js.map
