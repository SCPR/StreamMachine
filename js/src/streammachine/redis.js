var Redis, RedisManager, Url, debug, nconf, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require('underscore');

Redis = require('redis');

Url = require("url");

nconf = require("nconf");

debug = require("debug")("sm:redis");

module.exports = RedisManager = (function(_super) {
  __extends(RedisManager, _super);

  RedisManager.prototype.DefaultOptions = {
    server: "redis://localhost:6379",
    key: "StreamMachine"
  };

  function RedisManager(opts) {
    var info;
    this.options = _.defaults(opts, this.DefaultOptions);
    debug("init redis with " + this.options.server);
    info = Url.parse(this.options.server);
    this.client = Redis.createClient(info.port || 6379, info.hostname);
    this.client.once("ready", (function(_this) {
      return function() {
        var db, rFunc;
        rFunc = function() {
          _this._connected = true;
          return _this.emit("connected", _this.client);
        };
        if (info.pathname && info.pathname !== "/") {
          db = Number(info.pathname.substr(1));
          if (isNaN(db)) {
            throw new Error("Invalid path in Redis URI spec. Expected db number, got '" + (info.pathname.substr(1)) + "'");
          }
          debug("Redis connecting to DB " + db);
          return _this.client.select(db, function(err) {
            if (err) {
              throw new Error("Redis DB select error: " + err);
            }
            _this._db = db;
            return rFunc();
          });
        } else {
          _this._db = 0;
          debug("Redis using DB 0.");
          return rFunc();
        }
      };
    })(this));
  }

  RedisManager.prototype.prefixedKey = function(key) {
    if (this.options.key) {
      return "" + this.options.key + ":" + key;
    } else {
      return key;
    }
  };

  RedisManager.prototype.once_connected = function(cb) {
    if (this._connected) {
      return typeof cb === "function" ? cb(this.client) : void 0;
    } else {
      return this.once("connected", cb);
    }
  };

  return RedisManager;

})(require('events').EventEmitter);

//# sourceMappingURL=redis.js.map
