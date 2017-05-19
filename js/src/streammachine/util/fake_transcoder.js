var FakeTranscoder, debug, express, fs,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

express = require("express");

debug = require("debug")("sm:util:fake_transcoder");

fs = require("fs");

module.exports = FakeTranscoder = (function(_super) {
  __extends(FakeTranscoder, _super);

  function FakeTranscoder(port, files_dir) {
    var s;
    this.port = port;
    this.files_dir = files_dir;
    this.app = express();
    this.app.get("/encoding", (function(_this) {
      return function(req, res) {
        var e, f, key, s, uri;
        key = req.query["key"];
        uri = req.query["uri"];
        if (!key || !uri) {
          return res.status(400).end("Key and URI are required.");
        }
        debug("Fake Transcoder request for " + key + ": " + uri);
        _this.emit("request", {
          key: key,
          uri: uri
        });
        try {
          f = "" + _this.files_dir + "/" + key + ".mp3";
          debug("Attempting to send " + f);
          s = fs.createReadStream(f);
          s.pipe(res.status(200).type('audio/mpeg'));
          return s.once("end", function() {
            return debug("Transcoder response sent");
          });
        } catch (_error) {
          e = _error;
          return res.status(500).end("Failed to open static file: " + e);
        }
      };
    })(this));
    s = this.app.listen(this.port);
    if (this.port === 0) {
      this.port = s.address().port;
    }
  }

  return FakeTranscoder;

})(require("events").EventEmitter);

//# sourceMappingURL=fake_transcoder.js.map
