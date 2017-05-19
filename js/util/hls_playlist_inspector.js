var AACParser, HLSSegmentReader, MP3Parser, SegmentAnalyzer, analyzer, reader, request, uri, _ref,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

request = require("request");

HLSSegmentReader = require("hls-segment-reader");

MP3Parser = require("../src/streammachine/parsers/mp3");

AACParser = require("../src/streammachine/parsers/aac");

this.args = require("optimist").usage("Usage: $0 [uri]").argv;

uri = (_ref = this.args._) != null ? _ref[0] : void 0;

if (!uri) {
  console.error("Stream URI is required.");
  process.exit(1);
}

SegmentAnalyzer = (function(_super) {
  __extends(SegmentAnalyzer, _super);

  function SegmentAnalyzer() {
    SegmentAnalyzer.__super__.constructor.call(this, {
      objectMode: true,
      highWaterMark: 12
    });
  }

  SegmentAnalyzer.prototype._write = function(obj, encoding, cb) {
    var duration, frames, parser;
    duration = 0;
    frames = 0;
    parser = (function() {
      switch (obj.file.mime) {
        case "audio/mp3":
          return new MP3Parser();
        case "audio/aac":
          return new AACParser();
        default:
          throw "Unknown file mime: " + obj.file.mime;
      }
    })();
    parser.on("frame", (function(_this) {
      return function(data, header) {
        frames += 1;
        return duration += header.duration;
      };
    })(this));
    parser.once("end", (function(_this) {
      return function() {
        console.log("" + obj.seq + " Expected/Actual Duration: ", obj.details.duration, duration / 1000);
        return console.log("" + obj.seq + " Frames: ", frames);
      };
    })(this));
    obj.stream.pipe(parser);
    return cb();
  };

  return SegmentAnalyzer;

})(require("stream").Writable);

reader = new HLSSegmentReader(uri, {
  fullStream: true,
  withData: true
});

analyzer = new SegmentAnalyzer();

reader.pipe(analyzer);

//# sourceMappingURL=hls_playlist_inspector.js.map
