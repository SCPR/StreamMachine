var StreamListener, argv, listener, _ref;

StreamListener = require("../src/streammachine/util/stream_listener");

argv = require("yargs").usage("Usage: $0 --host localhost --port 8001 --stream foo --shoutcast").help('h').alias('h', 'help').describe({
  host: "Server",
  port: "Port",
  stream: "Stream Key",
  shoutcast: "Include 'icy-metaint' header?"
})["default"]({
  shoutcast: false
}).boolean(['shoutcast']).demand(["host", "port", "stream"]).argv;

if (((_ref = argv._) != null ? _ref[0] : void 0) === "listener") {
  argv._.shift();
}

listener = new StreamListener(argv.host, argv.port, argv.stream, argv.shoutcast);

listener.connect((function(_this) {
  return function(err) {
    if (err) {
      console.error("ERROR: " + err);
      return process.exit(1);
    } else {
      return console.error("Connected.");
    }
  };
})(this));

setInterval((function(_this) {
  return function() {
    return console.error("" + listener.bytesReceived + " bytes.");
  };
})(this), 5000);

process.on("SIGINT", (function(_this) {
  return function() {
    console.error("Disconnecting...");
    return listener.disconnect(function() {
      console.error("Disconnected. " + listener.bytesReceived + " total bytes.");
      return process.exit();
    });
  };
})(this));

//# sourceMappingURL=stream_listener.js.map
