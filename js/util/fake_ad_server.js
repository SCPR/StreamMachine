var FakeAdServer, filepath, fs, path, _ref;

path = require("path");

fs = require("fs");

FakeAdServer = require("../src/streammachine/util/fake_ad_server");

this.args = require("yargs").usage("Usage: $0 --template ./test/files/ads/vast.xml --port 8002").describe({
  template: "XML Ad Template",
  port: "Ad server port"
}).demand(["template", "port"])["default"]({
  port: 0
}).argv;

if (((_ref = this.args._) != null ? _ref[0] : void 0) === "fake_ad_server") {
  this.args._.shift();
}

filepath = path.resolve(this.args.template);

if (!fs.existsSync(this.args.template)) {
  console.error("Template file not found.");
  process.exit(1);
}

new FakeAdServer(this.args.port, filepath, (function(_this) {
  return function(err, s) {
    console.error("Ad server is listening on port " + s.port);
    return s.on("request", function(obj) {
      return console.error("Request: ", obj);
    });
  };
})(this));

//# sourceMappingURL=fake_ad_server.js.map
