var StreamMachineRunner, Watch, args, cp, debug, fs, path, runner, streamer_path, _handleExit,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

debug = require("debug")("sm:runner");

path = require("path");

fs = require("fs");

cp = require("child_process");

Watch = require("watch-for-path");

args = require("yargs").usage("Usage: $0 --watch [watch file] --title [title] --config [streammachine config file]").describe({
  watch: "File to watch for restarts",
  title: "Process title suffix",
  restart: "Trigger handoff if watched path changes",
  config: "Config file to pass to StreamMachine",
  dir: "Directory path for StreamMachine",
  coffee: "Run via coffeescript"
})["default"]({
  restart: true,
  coffee: false
}).demand(['config']).argv;

StreamMachineRunner = (function(_super) {
  __extends(StreamMachineRunner, _super);

  function StreamMachineRunner(_streamer, _args) {
    this._streamer = _streamer;
    this._args = _args;
    this.process = null;
    this._terminating = false;
    this._inHandoff = false;
    this._command = "" + this._streamer + " --config=" + this._args.config;
    process.title = this._args.title ? "StreamR:" + this._args.title : "StreamR";
    if (this._args.watch) {
      console.error("Setting a watch on " + this._args.watch + " before starting up.");
      new Watch(this._args.watch, (function(_this) {
        return function(err) {
          var last_m, last_restart;
          if (err) {
            throw err;
          }
          debug("Found " + _this._args.watch + ". Starting up.");
          if (_this._args.restart) {
            _this._w = fs.watch(_this._args.watch, function(evt, file) {
              debug("fs.watch fired for " + _this._args.watch + " (" + evt + ")");
              return _this.emit("_restart");
            });
            last_m = null;
            _this._wi = setInterval(function() {
              return fs.stat(_this._args.watch, function(err, stats) {
                if (err) {
                  return false;
                }
                if (last_m) {
                  if (Number(stats.mtime) !== last_m) {
                    debug("Polling found change in " + _this._args.watch + ".");
                    _this.emit("_restart");
                    return last_m = Number(stats.mtime);
                  }
                } else {
                  return last_m = Number(stats.mtime);
                }
              });
            }, 1000);
          }
          _this._startUp();
          last_restart = null;
          return _this.on("_restart", function() {
            var cur_t;
            cur_t = Number(new Date);
            if ((_this.process != null) && (!last_restart || cur_t - last_restart > 1200)) {
              last_restart = cur_t;
              debug("Triggering restart after watched file change.");
              return _this.restart();
            }
          });
        };
      })(this));
    } else {
      this._startUp();
    }
  }

  StreamMachineRunner.prototype._startUp = function() {
    var e, uptime, _start;
    _start = (function(_this) {
      return function() {
        _this.process = _this._spawn(false);
        return debug("Startup process PID is " + _this.process.p.pid + ".");
      };
    })(this);
    if (!this.process) {
      return _start();
    } else {
      try {
        process.kill(worker.pid, 0);
        return debug("Tried to start command while it was already running.");
      } catch (_error) {
        e = _error;
        this.process.p.removeAllListeners();
        this.process.p = null;
        uptime = Number(new Date) - this.process.start;
        debug("Command uptime was " + (Math.floor(uptime / 1000)) + " seconds.");
        return _start();
      }
    }
  };

  StreamMachineRunner.prototype._spawn = function(isHandoff) {
    var cmd, opts, process;
    if (isHandoff == null) {
      isHandoff = false;
    }
    debug("Should start command: " + this._command);
    cmd = this._command.split(" ");
    if (isHandoff) {
      cmd.push("--handoff");
    }
    opts = {};
    process = {
      p: null,
      start: Number(new Date),
      stopping: false
    };
    process.p = cp.fork(cmd[0], cmd.slice(1), opts);
    process.p.once("error", (function(_this) {
      return function(err) {
        debug("Command got error: " + err);
        if (!process.stopping) {
          return _this._startUp();
        }
      };
    })(this));
    process.p.once("exit", (function(_this) {
      return function(code, signal) {
        debug("Command exited: " + code + " || " + signal);
        if (!process.stopping) {
          return _this._startUp();
        }
      };
    })(this));
    return process;
  };

  StreamMachineRunner.prototype.restart = function() {
    var aToB, handles, nToO, new_process, oToN, old_process;
    if (!this.process || this.process.stopping) {
      console.error("Restart triggered with no process running.");
      return;
    }
    if (this._inHandoff) {
      console.error("Restart triggered while in existing handoff.");
      return;
    }
    this._inHandoff = true;
    old_process = this.process;
    this.process.stopping = true;
    new_process = this._spawn(true);
    handles = [];
    aToB = (function(_this) {
      return function(title, a, b) {
        return function(msg, handle) {
          var e;
          debug("Message: " + title, msg, handle != null);
          if (handle && handle.destroyed) {
            return b.send(msg);
          } else {
            try {
              b.send(msg, handle);
              if (handle != null) {
                return handles.push(handle);
              }
            } catch (_error) {
              e = _error;
              if (e(instanceOf(TypeError))) {
                console.error("HANDLE SEND ERROR:: " + err);
                return b.send(msg);
              }
            }
          }
        };
      };
    })(this);
    oToN = aToB("Old -> New", old_process.p, new_process.p);
    nToO = aToB("New -> Old", new_process.p, old_process.p);
    old_process.p.on("message", oToN);
    new_process.p.on("message", nToO);
    old_process.p.once("exit", (function(_this) {
      return function() {
        var h, _i, _len;
        new_process.p.removeListener("message", nToO);
        debug("Handoff completed.");
        for (_i = 0, _len = handles.length; _i < _len; _i++) {
          h = handles[_i];
          if (typeof h.close === "function") {
            h.close();
          }
        }
        _this.process = new_process;
        return _this._inHandoff = false;
      };
    })(this));
    return process.kill(old_process.p.pid, "SIGUSR2");
  };

  StreamMachineRunner.prototype.terminate = function(cb) {
    this._terminating = true;
    if (this.process) {
      this.process.stopping = true;
      this.process.p.once("exit", (function(_this) {
        return function() {
          var uptime;
          debug("Command is stopped.");
          uptime = Number(new Date) - _this.process.start;
          debug("Command uptime was " + (Math.floor(uptime / 1000)) + " seconds.");
          _this.process = null;
          return cb();
        };
      })(this));
      return this.process.p.kill();
    } else {
      debug("Stop called with no process running?");
      return cb();
    }
  };

  return StreamMachineRunner;

})(require("events").EventEmitter);

streamer_path = args.coffee ? path.resolve(args.dir || __dirname, "./coffee.js") : args.dir ? path.resolve(args.dir, "js/streamer.js") : path.resolve(__dirname, "./streamer.js");

debug("Streamer path is " + streamer_path);

runner = new StreamMachineRunner(streamer_path, args);

_handleExit = function() {
  return runner.terminate(function() {
    debug("StreamMachine Runner exiting.");
    return process.exit();
  });
};

process.on('SIGINT', _handleExit);

process.on('SIGTERM', _handleExit);

process.on('SIGHUP', function() {
  debug("Restart triggered via SIGHUP.");
  return runner.restart();
});

//# sourceMappingURL=runner.js.map
