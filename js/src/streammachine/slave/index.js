var Alerts, HTTP, IO, Server, Slave, SocketSource, Stream, URL, debug, tz, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require("underscore");

Stream = require("./stream");

Server = require("./server");

Alerts = require("../alerts");

IO = require("./slave_io");

SocketSource = require("./socket_source");

URL = require("url");

HTTP = require("http");

tz = require('timezone');

debug = require("debug")("sm:slave:slave");

module.exports = Slave = (function(_super) {
  __extends(Slave, _super);

  Slave.prototype.Outputs = {
    pumper: require("../outputs/pumper"),
    shoutcast: require("../outputs/shoutcast"),
    raw: require("../outputs/raw_audio"),
    live_streaming: require("../outputs/live_streaming")
  };

  function Slave(options, _worker) {
    var _ref;
    this.options = options;
    this._worker = _worker;
    this._configured = false;
    debug("Init for Slave");
    this.master = null;
    this.streams = {};
    this.stream_groups = {};
    this.root_route = null;
    this.connected = false;
    this._retrying = null;
    this._shuttingDown = false;
    this._totalConnections = 0;
    this._totalKBytesSent = 0;
    this.log = this.options.logger;
    this.alerts = new Alerts({
      logger: this.log.child({
        module: "alerts"
      })
    });
    if ((_ref = this.options.slave) != null ? _ref.master : void 0) {
      debug("Connecting IO to master");
      this.io = new IO(this, this.log.child({
        module: "slave_io"
      }), this.options.slave);
      this.io.on("connected", (function(_this) {
        return function() {
          debug("IO is connected");
          _this.alerts.update("slave_disconnected", _this.io.id, false);
          return _this.log.proxyToMaster(_this.io);
        };
      })(this));
      this.io.on("disconnected", (function(_this) {
        return function() {
          debug("IO is disconnected");
          _this.alerts.update("slave_disconnected", _this.io.id, true);
          return _this.log.proxyToMaster();
        };
      })(this));
    }
    this.once("streams", (function(_this) {
      return function() {
        debug("Streams event received");
        return _this._configured = true;
      };
    })(this));
    this.server = new Server({
      core: this,
      logger: this.log.child({
        subcomponent: "server"
      }),
      config: this.options
    });
  }

  Slave.prototype.once_configured = function(cb) {
    if (this._configured) {
      return cb();
    } else {
      return this.once("streams", (function(_this) {
        return function() {
          return cb();
        };
      })(this));
    }
  };

  Slave.prototype.once_rewinds_loaded = function(cb) {
    return this.once_configured((function(_this) {
      return function() {
        var aFunc, k, obj, _ref, _results;
        _this.log.debug("Looking for sources to load in " + (Object.keys(_this.streams).length) + " streams.");
        aFunc = _.after(Object.keys(_this.streams).length, function() {
          _this.log.debug("All sources are loaded.");
          return cb();
        });
        _ref = _this.streams;
        _results = [];
        for (k in _ref) {
          obj = _ref[k];
          _results.push(obj._once_source_loaded(aFunc));
        }
        return _results;
      };
    })(this));
  };

  Slave.prototype._shutdown = function(cb) {
    if (!this._worker) {
      cb("Don't have _worker to trigger shutdown on.");
      return false;
    }
    if (this._shuttingDown) {
      cb("Shutdown already in progress.");
      return false;
    }
    this._shuttingDown = true;
    this.server.close();
    return this._worker.shutdown(cb);
  };

  Slave.prototype.configureStreams = function(options) {
    var g, k, key, obj, opts, sg, source, stream, _base, _ref;
    debug("In configureStreams");
    this.log.debug("In slave configureStreams with ", {
      options: options
    });
    _ref = this.streams;
    for (k in _ref) {
      obj = _ref[k];
      if (!(options != null ? options[k] : void 0)) {
        debug("configureStreams: Disconnecting stream " + k);
        this.log.info("configureStreams: Calling disconnect on " + k);
        obj.disconnect();
        delete this.streams[k];
      }
    }
    debug("configureStreams: New options start");
    for (key in options) {
      opts = options[key];
      debug("configureStreams: Configuring " + key);
      if (this.streams[key]) {
        this.log.debug("Passing updated config to stream: " + key, {
          opts: opts
        });
        this.streams[key].configure(opts);
      } else {
        this.log.debug("Starting up stream: " + key, {
          opts: opts
        });
        if (this.options.hls) {
          opts.hls = true;
        }
        opts.tz = tz(require("timezone/zones"))(this.options.timezone || "UTC");
        stream = this.streams[key] = new Stream(this, key, this.log.child({
          stream: key
        }), opts);
        if (this.io) {
          source = this.socketSource(stream);
          stream.useSource(source);
        }
      }
      if (g = this.streams[key].opts.group) {
        sg = ((_base = this.stream_groups)[g] || (_base[g] = new Stream.StreamGroup(g, this.log.child({
          stream_group: g
        }))));
        sg.addStream(this.streams[key]);
      }
      if (opts.root_route) {
        this.root_route = key;
      }
    }
    debug("Done with configureStreams");
    return this.emit("streams", this.streams);
  };

  Slave.prototype._streamStatus = function(cb) {
    var key, s, status, totalConnections, totalKBytes, _ref;
    status = {};
    totalKBytes = 0;
    totalConnections = 0;
    _ref = this.streams;
    for (key in _ref) {
      s = _ref[key];
      status[key] = s.status();
      totalKBytes += status[key].kbytes_sent;
      totalConnections += status[key].connections;
    }
    return cb(null, _.extend(status, {
      _stats: {
        kbytes_sent: totalKBytes,
        connections: totalConnections
      }
    }));
  };

  Slave.prototype.socketSource = function(stream) {
    return new SocketSource(this, stream);
  };

  Slave.prototype.ejectListeners = function(lFunc, cb) {
    var id, k, obj, s, sFunc, _ref, _ref1;
    this.log.info("Preparing to eject listeners from slave.");
    this._enqueued = [];
    _ref = this.streams;
    for (k in _ref) {
      s = _ref[k];
      this.log.info("Preparing " + (Object.keys(s._lmeta).length) + " listeners for " + s.key);
      _ref1 = s._lmeta;
      for (id in _ref1) {
        obj = _ref1[id];
        this._enqueued.push([s, obj]);
      }
    }
    if (this._enqueued.length === 0) {
      return typeof cb === "function" ? cb() : void 0;
    }
    sFunc = (function(_this) {
      return function() {
        var d, l, sl, stream;
        sl = _this._enqueued.shift();
        if (!sl) {
          _this.log.info("All listeners have been ejected.");
          return cb(null);
        }
        stream = sl[0], l = sl[1];
        d = require("domain").create();
        d.on("error", function(err) {
          console.error("Handoff error: " + err);
          _this.log.error("Eject listener for " + l.id + " hit error: " + err);
          d.exit();
          return sFunc();
        });
        return d.run(function() {
          return l.obj.prepForHandoff(function(skipHandoff) {
            var lopts, socket;
            if (skipHandoff == null) {
              skipHandoff = false;
            }
            if (skipHandoff) {
              return sFunc();
            }
            socket = l.obj.socket;
            lopts = {
              key: [stream.key, l.id].join("::"),
              stream: stream.key,
              id: l.id,
              startTime: l.startTime,
              client: l.obj.client
            };
            if (socket && !socket.destroyed) {
              return lFunc(lopts, socket, function(err) {
                if (err) {
                  _this.log.error("Failed to send listener " + lopts.id + ": " + err);
                }
                return sFunc();
              });
            } else {
              _this.log.info("Listener " + lopts.id + " perished in the queue. Moving on.");
              return sFunc();
            }
          });
        });
      };
    })(this);
    return sFunc();
  };

  Slave.prototype.landListener = function(obj, socket, cb) {
    var output;
    if (socket && !socket.destroyed) {
      output = new this.Outputs[obj.client.output](this.streams[obj.stream], {
        socket: socket,
        client: obj.client,
        startTime: new Date(obj.startTime)
      });
      return cb(null);
    } else {
      return cb("Listener disconnected in-flight");
    }
  };

  return Slave;

})(require("events").EventEmitter);

//# sourceMappingURL=index.js.map
