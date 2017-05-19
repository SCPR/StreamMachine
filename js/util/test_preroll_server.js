var $file, PrerollServer, express, fs, path, pre;

express = require("express");

fs = require("fs");

path = require("path");

$file = function(file) {
  return path.resolve(__dirname, "..", file);
};

PrerollServer = (function() {
  function PrerollServer(files, on) {
    this.files = files;
    this.on = on != null ? on : true;
    this.app = express();
    this.app.get("/:key/:streamkey", (function(_this) {
      return function(req, res, next) {
        var f, stream, _ref;
        console.log("Preroll request for " + req.path);
        if (f = (_ref = _this.files[req.param("key")]) != null ? _ref[req.param("streamkey")] : void 0) {
          if (_this.on) {
            res.header("Content-Type", "audio/mpeg");
            res.status(200);
            stream = fs.createReadStream(f);
            return stream.pipe(res);
          } else {
            return setTimeout(function() {
              return res.end();
            }, 3000);
          }
        } else {
          return next();
        }
      };
    })(this));
    this.app.get("*", (function(_this) {
      return function(req, res, next) {
        console.log("Invalid request to " + req.path);
        return next();
      };
    })(this));
    this.app.listen(process.argv[2]);
  }

  PrerollServer.prototype.toggle = function() {
    this.on = !this.on;
    return console.log("Responses are " + (this.on ? "on" : "off"));
  };

  return PrerollServer;

})();

pre = new PrerollServer({
  test: {
    "mp3-44100-128-m": $file("test/files/mp3/tone250Hz-44100-128-m.mp3")
  }
});

process.on("SIGUSR2", function() {
  return pre.toggle();
});

console.log("PID is " + process.pid);

//# sourceMappingURL=test_preroll_server.js.map
