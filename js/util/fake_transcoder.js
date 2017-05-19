var FakeTranscoder, filepath, fs, path, s, _ref;

path = require("path");

fs = require("fs");

FakeTranscoder = require("../src/streammachine/util/fake_transcoder");

this.args = require("yargs").usage("Usage: $0 --dir ./test/files/mp3 --port 8001").describe({
  dir: "Directory with audio files",
  port: "Transcoder server port"
}).demand(["dir", "port"])["default"]({
  port: 0
}).argv;

if (((_ref = this.args._) != null ? _ref[0] : void 0) === "fake_transcoder") {
  this.args._.shift();
}

filepath = path.resolve(this.args.dir);

if (!fs.existsSync(this.args.dir)) {
  console.error("Files directory not found.");
  process.exit(1);
}

console.log("Files dir is ", filepath);

s = new FakeTranscoder(this.args.port, filepath);

console.error("Transcoding server is listening on port " + s.port);

s.on("request", (function(_this) {
  return function(obj) {
    return console.error("Request: ", obj);
  };
})(this));

//# sourceMappingURL=fake_transcoder.js.map
