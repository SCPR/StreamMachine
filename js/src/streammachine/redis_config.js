var EventEmitter, Redis, RedisConfig, Url, debug,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Redis = require('redis');

Url = require("url");

EventEmitter = require('events').EventEmitter;

debug = require("debug")("sm:redis_config");

module.exports = RedisConfig = (function(_super) {
  __extends(RedisConfig, _super);

  function RedisConfig(redis) {
    this.redis = redis;
    process.nextTick((function(_this) {
      return function() {
        return _this._config();
      };
    })(this));
  }

  RedisConfig.prototype._config = function() {
    return this.redis.once_connected((function(_this) {
      return function(client) {
        debug("Querying config from Redis");
        return client.get(_this.redis.prefixedKey("config"), function(err, reply) {
          var config;
          if (reply) {
            config = JSON.parse(reply.toString());
            debug("Got redis config of ", config);
            return _this.emit("config", config);
          } else {
            return _this.emit("config", null);
          }
        });
      };
    })(this));
  };

  RedisConfig.prototype._update = function(config, cb) {
    return this.redis.once_connected((function(_this) {
      return function(client) {
        debug("Saving configuration to Redis");
        return client.set(_this.redis.prefixedKey("config"), JSON.stringify(config), function(err, reply) {
          if (err) {
            debug("Redis: Failed to save updated config: " + err);
            return cb(err);
          } else {
            debug("Set config to ", config, reply);
            return cb(null);
          }
        });
      };
    })(this));
  };

  return RedisConfig;

})(EventEmitter);

//# sourceMappingURL=redis_config.js.map
