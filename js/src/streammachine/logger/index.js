var LogController, WinstonCommon, debug, fs, path, strftime, winston, _,
  __slice = [].slice,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require("underscore");

winston = require("winston");

WinstonCommon = require("winston/lib/winston/common");

fs = require("fs");

path = require("path");

strftime = require("prettydate").strftime;

debug = require("debug")("sm:logger");

module.exports = LogController = (function() {
  LogController.prototype.CustomLevels = {
    error: 80,
    alert: 75,
    event: 70,
    info: 60,
    request: 40,
    interaction: 30,
    minute: 30,
    debug: 10,
    silly: 5
  };

  function LogController(config) {
    var transports, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    transports = [];
    transports.push(new LogController.Debug({
      level: "silly"
    }));
    if (config.stdout) {
      console.log("adding Console transport");
      transports.push(new LogController.Console({
        level: ((_ref = config.stdout) != null ? _ref.level : void 0) || "debug",
        colorize: ((_ref1 = config.stdout) != null ? _ref1.colorize : void 0) || false,
        timestamp: ((_ref2 = config.stdout) != null ? _ref2.timestamp : void 0) || false,
        ignore: ((_ref3 = config.stdout) != null ? _ref3.ignore : void 0) || ""
      }));
    }
    if ((_ref4 = config.json) != null ? _ref4.file : void 0) {
      console.log("Setting up JSON logger with ", config.json);
      transports.push(new winston.transports.File({
        level: config.json.level || "interaction",
        timestamp: true,
        filename: config.json.file,
        json: true,
        options: {
          flags: 'a',
          highWaterMark: 24
        }
      }));
    }
    if ((_ref5 = config.w3c) != null ? _ref5.file : void 0) {
      transports.push(new LogController.W3CLogger({
        level: config.w3c.level || "request",
        filename: config.w3c.file
      }));
    }
    if (config.campfire != null) {
      transports.push(new LogController.CampfireLogger(config.campfire));
    }
    this.logger = new winston.Logger({
      transports: transports,
      levels: this.CustomLevels
    });
    this.logger.extend(this);
  }

  LogController.prototype.child = function(opts) {
    if (opts == null) {
      opts = {};
    }
    return new LogController.Child(this, opts);
  };

  LogController.prototype.proxyToMaster = function(sock) {
    if (this.logger.transports['socket']) {
      this.logger.remove(this.logger.transports['socket']);
    }
    if (sock) {
      return this.logger.add(new LogController.SocketLogger(sock, {
        level: "interaction"
      }), {}, true);
    }
  };

  LogController.Child = (function() {
    function Child(parent, opts) {
      this.parent = parent;
      this.opts = opts;
      _(['log', 'profile', 'startTimer'].concat(Object.keys(this.parent.logger.levels))).each((function(_this) {
        return function(k) {
          return _this[k] = function() {
            var args;
            args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            if (_.isObject(args[args.length - 1])) {
              args[args.length - 1] = _.extend({}, args[args.length - 1], _this.opts);
            } else {
              args.push(_.clone(_this.opts));
            }
            return _this.parent[k].apply(_this, args);
          };
        };
      })(this));
      this.logger = this.parent.logger;
      this.child = function(opts) {
        if (opts == null) {
          opts = {};
        }
        return new LogController.Child(this.parent, _.extend({}, this.opts, opts));
      };
    }

    Child.prototype.proxyToMaster = function(sock) {
      return this.parent.proxyToMaster(sock);
    };

    return Child;

  })();

  LogController.Debug = (function(_super) {
    __extends(Debug, _super);

    function Debug() {
      return Debug.__super__.constructor.apply(this, arguments);
    }

    Debug.prototype.log = function(level, msg, meta, callback) {
      debug("" + level + ": " + msg, meta);
      return callback(null, true);
    };

    return Debug;

  })(winston.Transport);

  LogController.Console = (function(_super) {
    __extends(Console, _super);

    function Console(opts) {
      this.opts = opts;
      Console.__super__.constructor.call(this, this.opts);
      this.ignore_levels = (this.opts.ignore || "").split(",");
    }

    Console.prototype.log = function(level, msg, meta, callback) {
      var k, output, prefixes, _i, _len, _ref;
      if (this.silent) {
        return callback(null, true);
      }
      if (this.ignore_levels.indexOf(level) !== -1) {
        return callback(null, true);
      }
      prefixes = [];
      _ref = ['pid', 'mode', 'component'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        k = _ref[_i];
        if (meta[k]) {
          prefixes.push(meta[k]);
          delete meta[k];
        }
      }
      output = WinstonCommon.log({
        colorize: this.colorize,
        json: this.json,
        level: level,
        message: msg,
        meta: meta,
        stringify: this.stringify,
        timestamp: this.timestamp,
        prettyPrint: this.prettyPrint,
        raw: this.raw,
        label: this.label
      });
      if (prefixes.length > 0) {
        output = prefixes.join("/") + " -- " + output;
      }
      if (level === 'error' || level === 'debug') {
        process.stderr.write(output + "\n");
      } else {
        process.stdout.write(output + "\n");
      }
      this.emit("logged");
      return callback(null, true);
    };

    return Console;

  })(winston.transports.Console);

  LogController.W3CLogger = (function(_super) {
    __extends(W3CLogger, _super);

    W3CLogger.prototype.name = "w3c";

    function W3CLogger(options) {
      W3CLogger.__super__.constructor.call(this, options);
      this.options = options;
      this._opening = false;
      this._file = null;
      this._queue = [];
      process.addListener("SIGHUP", (function(_this) {
        return function() {
          console.log("w3c reloading log file");
          return _this.close(function() {
            return _this.open();
          });
        };
      })(this));
    }

    W3CLogger.prototype.log = function(level, msg, meta, cb) {
      var logline;
      if (level === this.options.level) {
        logline = "" + meta.ip + " " + (strftime(new Date(meta.time), "%F %T")) + " " + meta.path + " 200 " + (escape(meta.ua)) + " " + meta.bytes + " " + meta.seconds;
        this._queue.push(logline);
        return this._runQueue();
      }
    };

    W3CLogger.prototype._runQueue = function() {
      var line;
      if (this._file) {
        if (this._queue.length > 0) {
          line = this._queue.shift();
          return this._file.write(line + "\n", "utf8", (function(_this) {
            return function() {
              if (_this._queue.length > 0) {
                return _this._runQueue;
              }
            };
          })(this));
        }
      } else {
        return this.open((function(_this) {
          return function(err) {
            return _this._runQueue();
          };
        })(this));
      }
    };

    W3CLogger.prototype.open = function(cb) {
      var initFile, stats;
      if (this._opening) {
        console.log("W3C already opening... wait.");
        return false;
      }
      console.log("W3C opening log file.");
      this._opening = setTimeout((function(_this) {
        return function() {
          console.log("Failed to open w3c log within one second.");
          _this._opening = false;
          return _this.open(cb);
        };
      })(this), 1000);
      initFile = true;
      if (fs.existsSync(this.options.filename)) {
        stats = fs.statSync(this.options.filename);
        if (stats.size > 0) {
          initFile = false;
        }
      }
      this._file = fs.createWriteStream(this.options.filename, {
        flags: (initFile ? "w" : "r+")
      });
      return this._file.once("open", (function(_this) {
        return function(err) {
          var _clear;
          console.log("w3c log open with ", err);
          _clear = function() {
            console.log("w3c open complete");
            if (_this._opening) {
              clearTimeout(_this._opening);
            }
            _this._opening = null;
            return typeof cb === "function" ? cb() : void 0;
          };
          if (initFile) {
            return _this._file.write("#Software: StreamMachine\n#Version: 0.2.9\n#Fields: c-ip date time cs-uri-stem c-status cs(User-Agent) sc-bytes x-duration\n", "utf8", function() {
              return _clear();
            });
          } else {
            return _clear();
          }
        };
      })(this));
    };

    W3CLogger.prototype.close = function(cb) {
      var _ref;
      if ((_ref = this._file) != null) {
        _ref.end(null, null, (function(_this) {
          return function() {
            return console.log("W3C log file closed.");
          };
        })(this));
      }
      return this._file = null;
    };

    W3CLogger.prototype.flush = function() {
      return this._runQueue();
    };

    return W3CLogger;

  })(winston.Transport);

  LogController.CampfireLogger = (function(_super) {
    __extends(CampfireLogger, _super);

    CampfireLogger.prototype.name = "campfire";

    function CampfireLogger(opts) {
      var Campfire;
      this.opts = opts;
      CampfireLogger.__super__.constructor.call(this, this.opts);
      Campfire = (require("campfire")).Campfire;
      this._room = false;
      this._queue = [];
      this.campfire = new Campfire({
        account: this.opts.account,
        token: this.opts.token,
        ssl: true
      });
      this.campfire.join(this.opts.room, (function(_this) {
        return function(err, room) {
          var msg, _i, _len, _ref;
          if (err) {
            console.error("Cannot connect to Campfire for logging: " + err);
            return false;
          }
          _this._room = room;
          _ref = _this._queue;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            msg = _ref[_i];
            _this._room.speak(msg, function(err) {});
          }
          return _this._queue = [];
        };
      })(this));
    }

    CampfireLogger.prototype.log = function(level, msg, meta, cb) {
      if (this._room) {
        this._room.speak(msg, (function(_this) {
          return function(err) {};
        })(this));
      } else {
        this._queue.push(msg);
      }
      return typeof cb === "function" ? cb() : void 0;
    };

    return CampfireLogger;

  })(winston.Transport);

  LogController.SocketLogger = (function(_super) {
    __extends(SocketLogger, _super);

    SocketLogger.prototype.name = "socket";

    function SocketLogger(io, opts) {
      this.io = io;
      SocketLogger.__super__.constructor.call(this, opts);
    }

    SocketLogger.prototype.log = function(level, msg, meta, cb) {
      this.io.log({
        level: level,
        msg: msg,
        meta: meta
      });
      return typeof cb === "function" ? cb() : void 0;
    };

    return SocketLogger;

  })(winston.Transport);

  return LogController;

})();

//# sourceMappingURL=index.js.map
