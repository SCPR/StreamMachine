var Icy, ProxyRoom, domain, url, util,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Icy = require('icy');

util = require('util');

url = require('url');

domain = require("domain");

module.exports = ProxyRoom = (function(_super) {
  __extends(ProxyRoom, _super);

  ProxyRoom.prototype.TYPE = function() {
    return "Proxy (" + this.url + ")";
  };

  function ProxyRoom(opts) {
    var _ref;
    this.opts = opts;
    ProxyRoom.__super__.constructor.call(this, {
      useHeartbeat: false
    });
    this.url = this.opts.url;
    if ((_ref = this.log) != null) {
      _ref.debug("ProxyRoom source created for " + this.url);
    }
    this.isFallback = this.opts.fallback || false;
    this.connected = false;
    this.framesPerSec = null;
    this.last_ts = null;
    this.connected_at = null;
    this._in_disconnect = false;
    this._maxBounces = 10;
    this._bounces = 0;
    this._bounceInt = 5;
    this.StreamTitle = null;
    this.StreamUrl = null;
    this.d = domain.create();
    this.d.on("error", (function(_this) {
      return function(err) {
        var nice_err;
        nice_err = "ProxyRoom encountered an error.";
        nice_err = (function() {
          switch (err.syscall) {
            case "getaddrinfo":
              return "Unable to look up DNS for Icecast proxy.";
            default:
              return "Error making connection to Icecast proxy.";
          }
        })();
        return _this.emit("error", nice_err, err);
      };
    })(this));
    this.d.run((function(_this) {
      return function() {
        return _this.connect();
      };
    })(this));
  }

  ProxyRoom.prototype.status = function() {
    var _ref;
    return {
      source: (_ref = typeof this.TYPE === "function" ? this.TYPE() : void 0) != null ? _ref : this.TYPE,
      connected: this.connected,
      url: this.url,
      streamKey: this.streamKey,
      uuid: this.uuid,
      isFallback: this.isFallback,
      last_ts: this.last_ts,
      connected_at: this.connected_at
    };
  };

  ProxyRoom.prototype.connect = function() {
    var url_opts, _ref;
    if ((_ref = this.log) != null) {
      _ref.debug("connecting to " + this.url);
    }
    url_opts = url.parse(this.url);
    url_opts.headers = {
      "user-agent": "StreamMachine 0.1.0"
    };
    Icy.get(url_opts, (function(_this) {
      return function(ice) {
        _this.icecast = ice;
        _this.icecast.on("close", function() {
          var _ref1;
          console.log("proxy got close event");
          if (!_this._in_disconnect) {
            setTimeout((function() {
              return _this.connect();
            }), 5000);
            if ((_ref1 = _this.log) != null) {
              _ref1.debug("Lost connection to " + _this.url + ". Retrying in 5 seconds");
            }
            _this.connected = false;
            return _this.icecast.removeAllListeners();
          }
        });
        _this.icecast.on("metadata", function(data) {
          var meta;
          if (!_this._in_disconnect) {
            meta = Icy.parse(data);
            if (meta.StreamTitle) {
              _this.StreamTitle = meta.StreamTitle;
            }
            if (meta.StreamUrl) {
              _this.StreamUrl = meta.StreamUrl;
            }
            return _this.emit("metadata", {
              StreamTitle: _this.StreamTitle || "",
              StreamUrl: _this.StreamUrl || ""
            });
          }
        });
        _this.icecast.on("data", function(chunk) {
          return _this.parser.write(chunk);
        });
        _this.connected = true;
        _this.connected_at = new Date();
        return _this.emit("connect");
      };
    })(this));
    return this.on("_chunk", (function(_this) {
      return function(chunk) {
        _this.last_ts = chunk.ts;
        return _this.emit("data", chunk);
      };
    })(this));
  };

  ProxyRoom.prototype.disconnect = function() {
    var _ref;
    this._in_disconnect = true;
    if (this.connected) {
      this.icecast.removeAllListeners();
      this.parser.removeAllListeners();
      this.removeAllListeners();
      this.icecast.end();
      this.parser = null;
      this.icecast = null;
      return (_ref = this.log) != null ? _ref.debug("ProxyRoom source disconnected.") : void 0;
    }
  };

  return ProxyRoom;

})(require("./base"));

//# sourceMappingURL=proxy_room.js.map
