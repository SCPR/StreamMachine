var Icy, StreamListener, debug, http, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Icy = require("icy");

http = require("http");

debug = require("debug")("sm:util:stream_listener");

_ = require("underscore");

module.exports = StreamListener = (function(_super) {
  __extends(StreamListener, _super);

  function StreamListener(host, port, stream, shoutcast) {
    this.host = host;
    this.port = port;
    this.stream = stream;
    this.shoutcast = shoutcast != null ? shoutcast : false;
    this.bytesReceived = 0;
    this.url = "http://" + this.host + ":" + this.port + "/" + this.stream;
    this.req = null;
    this.res = null;
    debug("Created new Stream Listener for " + this.url);
    this.disconnected = false;
  }

  StreamListener.prototype.connect = function(timeout, cb) {
    var abortT, aborted, cLoop, connect_func, _connected;
    if (_.isFunction(timeout)) {
      cb = timeout;
      timeout = null;
    }
    aborted = false;
    if (timeout) {
      abortT = setTimeout((function(_this) {
        return function() {
          aborted = true;
          return cb(new Error("Reached timeout without successful connection."));
        };
      })(this), timeout);
    }
    _connected = (function(_this) {
      return function(res) {
        if (abortT) {
          clearTimeout(abortT);
        }
        _this.res = res;
        debug("Connected. Response code is " + res.statusCode + ".");
        if (res.statusCode !== 200) {
          cb(new Error("Non-200 Status code: " + res.statusCode));
          return false;
        }
        if (typeof cb === "function") {
          cb();
        }
        _this.emit("connected");
        _this.res.on("metadata", function(meta) {
          return _this.emit("metadata", Icy.parse(meta));
        });
        _this.res.on("readable", function() {
          var data, _results;
          _results = [];
          while (data = _this.res.read()) {
            _this.bytesReceived += data.length;
            _results.push(_this.emit("bytes"));
          }
          return _results;
        });
        _this.res.once("error", function(err) {
          debug("Listener connection error: " + err);
          if (!_this.disconnected) {
            return _this.emit("error");
          }
        });
        return _this.res.once("close", function() {
          debug("Listener connection closed.");
          if (!_this.disconnected) {
            return _this.emit("close");
          }
        });
      };
    })(this);
    connect_func = this.shoutcast ? Icy.get : http.get;
    cLoop = (function(_this) {
      return function() {
        debug("Attempting connect to " + _this.url);
        _this.req = connect_func(_this.url, _connected);
        _this.req.once("socket", function(sock) {
          return _this.emit("socket", sock);
        });
        return _this.req.once("error", function(err) {
          if (err.code === "ECONNREFUSED") {
            if (!aborted) {
              return setTimeout(cLoop, 50);
            }
          } else {
            return cb(err);
          }
        });
      };
    })(this);
    return cLoop();
  };

  StreamListener.prototype.disconnect = function(cb) {
    this.disconnected = true;
    this.res.socket.destroy();
    return typeof cb === "function" ? cb() : void 0;
  };

  return StreamListener;

})(require("events").EventEmitter);

//# sourceMappingURL=stream_listener.js.map
