var PasswordHash, Users,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

PasswordHash = require("password-hash");

module.exports = Users = (function() {
  function Users() {
    this._user_lookup = (function(_this) {
      return function(user, password, cb) {
        return typeof cb === "function" ? cb("Cannot look up users without a valid store loaded.") : void 0;
      };
    })(this);
    this._user_store = (function(_this) {
      return function(user, password, cb) {
        return typeof cb === "function" ? cb("Cannot store users without a valid store loaded.") : void 0;
      };
    })(this);
    this._user_list = (function(_this) {
      return function(cb) {
        return typeof cb === "function" ? cb("Cannot list users without a valid store loaded.") : void 0;
      };
    })(this);
  }

  Users.prototype.list = function(cb) {
    return this._user_list(cb);
  };

  Users.prototype.validate = function(user, password, cb) {
    return this._user_lookup(user, password, cb);
  };

  Users.prototype.store = function(user, password, cb) {
    return this._user_store(user, password, cb);
  };

  Users.Local = (function(_super) {
    __extends(Local, _super);

    function Local(admin) {
      var nconf;
      this.admin = admin;
      Local.__super__.constructor.apply(this, arguments);
      if (this.admin.master.redis != null) {
        this._user_list = (function(_this) {
          return function(cb) {
            return _this.admin.master.redis.once_connected(function(redis) {
              return redis.hkeys("users", cb);
            });
          };
        })(this);
        this._user_lookup = (function(_this) {
          return function(user, password, cb) {
            return _this.admin.master.redis.once_connected(function(redis) {
              return redis.hget("users", user, function(err, val) {
                if (err) {
                  if (typeof cb === "function") {
                    cb(err);
                  }
                  return false;
                }
                if (PasswordHash.verify(password, val)) {
                  return typeof cb === "function" ? cb(null, true) : void 0;
                } else {
                  return typeof cb === "function" ? cb(null, false) : void 0;
                }
              });
            });
          };
        })(this);
        this._user_store = (function(_this) {
          return function(user, password, cb) {
            return _this.admin.master.redis.once_connected(function(redis) {
              var hashed;
              console.log("in user_store for ", user, password);
              if (password) {
                hashed = PasswordHash.generate(password);
                console.log("hashed pass is ", hashed);
                return redis.hset("users", user, hashed, function(err, result) {
                  if (err) {
                    if (typeof cb === "function") {
                      cb(err);
                    }
                    return false;
                  }
                  return typeof cb === "function" ? cb(null, true) : void 0;
                });
              } else {
                return redis.hdel("users", user, function(err) {
                  if (err) {
                    if (typeof cb === "function") {
                      cb(err);
                    }
                    return false;
                  }
                  return typeof cb === "function" ? cb(null, true) : void 0;
                });
              }
            });
          };
        })(this);
      } else {
        nconf = require("nconf");
        this._user_list = (function(_this) {
          return function(cb) {
            var users;
            users = nconf.get("users");
            if (users) {
              return typeof cb === "function" ? cb(null, Object.keys(users)) : void 0;
            } else {
              return typeof cb === "function" ? cb(null, []) : void 0;
            }
          };
        })(this);
        this._user_lookup = (function(_this) {
          return function(user, password, cb) {
            var hash;
            if (hash = nconf.get("users:" + user)) {
              return typeof cb === "function" ? cb(null, PasswordHash.verify(password, hash)) : void 0;
            } else {
              return typeof cb === "function" ? cb(null, false) : void 0;
            }
          };
        })(this);
        this._user_store = (function(_this) {
          return function(user, password, cb) {
            return typeof cb === "function" ? cb("Cannot store passwords when not using Redis.") : void 0;
          };
        })(this);
      }
    }

    return Local;

  })(Users);

  return Users;

})();

//# sourceMappingURL=users.js.map
