var SocketSource, http,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

http = require("http");

module.exports = SocketSource = (function(_super) {
  __extends(SocketSource, _super);

  function SocketSource(slave, stream) {
    var getVitals;
    this.slave = slave;
    this.stream = stream;
    this.log = this.stream.log.child({
      subcomponent: "socket_source"
    });
    this.log.debug("created SocketSource for " + this.stream.key);
    this.slave.io.on("audio:" + this.stream.key, (function(_this) {
      return function(chunk) {
        return _this.emit("data", chunk);
      };
    })(this));
    this.slave.io.on("hls_snapshot:" + this.stream.key, (function(_this) {
      return function(snapshot) {
        return _this.emit("hls_snapshot", snapshot);
      };
    })(this));
    this._streamKey = null;
    getVitals = (function(_this) {
      return function(retries) {
        if (retries == null) {
          retries = 0;
        }
        return _this.slave.io.vitals(_this.stream.key, function(err, obj) {
          if (err) {
            _this.log.error("Failed to get vitals (" + retries + " retries remaining): " + err);
            if (retries > 0) {
              getVitals();
            }
            return;
          }
          _this._streamKey = obj.streamKey;
          _this._vitals = obj;
          return _this.emit("vitals", obj);
        });
      };
    })(this);
    getVitals(2);
    this.stream.once("disconnect", (function(_this) {
      return function() {
        getVitals = function() {};
        return _this.disconnect();
      };
    })(this));
  }

  SocketSource.prototype.vitals = function(cb) {
    var _vFunc;
    _vFunc = (function(_this) {
      return function(v) {
        return typeof cb === "function" ? cb(null, v) : void 0;
      };
    })(this);
    if (this._vitals) {
      return _vFunc(this._vitals);
    } else {
      return this.once("vitals", _vFunc);
    }
  };

  SocketSource.prototype.getStreamKey = function(cb) {
    if (this._streamKey) {
      return typeof cb === "function" ? cb(this._streamKey) : void 0;
    } else {
      return this.once("vitals", (function(_this) {
        return function() {
          return typeof cb === "function" ? cb(_this._streamKey) : void 0;
        };
      })(this));
    }
  };

  SocketSource.prototype.getHLSSnapshot = function(cb) {
    return this.slave.io.hls_snapshot(this.stream.key, cb);
  };

  SocketSource.prototype.getRewind = function(cb) {
    var gRT, req;
    gRT = setTimeout((function(_this) {
      return function() {
        _this.log.debug("Failed to get rewind buffer response.");
        return typeof cb === "function" ? cb("Failed to get a rewind buffer response.") : void 0;
      };
    })(this), 15000);
    this.log.debug("Making Rewind Buffer request for " + this.stream.key, {
      sock_id: this.slave.io.id
    });
    req = http.request({
      hostname: this.slave.io.io.io.opts.host,
      port: this.slave.io.io.io.opts.port,
      path: "/s/" + this.stream.key + "/rewind",
      headers: {
        'stream-slave-id': this.slave.io.id
      }
    }, (function(_this) {
      return function(res) {
        clearTimeout(gRT);
        _this.log.debug("Got Rewind response with status code of " + res.statusCode);
        if (res.statusCode === 200) {
          return typeof cb === "function" ? cb(null, res) : void 0;
        } else {
          return typeof cb === "function" ? cb("Rewind request got a non-500 response.") : void 0;
        }
      };
    })(this));
    req.on("error", (function(_this) {
      return function(err) {
        clearTimeout(gRT);
        _this.log.debug("Rewind request got error: " + err, {
          error: err
        });
        return typeof cb === "function" ? cb(err) : void 0;
      };
    })(this));
    return req.end();
  };

  SocketSource.prototype.disconnect = function() {
    this.log.debug("SocketSource disconnecting for " + this.stream.key);
    return this.stream = null;
  };

  return SocketSource;

})(require("events").EventEmitter);

//# sourceMappingURL=socket_source.js.map
