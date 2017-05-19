var Logger, Master, Slave, StandaloneMode, debug, express, nconf, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require("underscore");

express = require("express");

nconf = require("nconf");

Logger = require("../logger");

Master = require("../master");

Slave = require("../slave");

debug = require("debug")("sm:modes:standalone");

module.exports = StandaloneMode = (function(_super) {
  __extends(StandaloneMode, _super);

  StandaloneMode.prototype.MODE = "StandAlone";

  function StandaloneMode(opts, cb) {
    this.opts = opts;
    this.log = (new Logger(this.opts.log)).child({
      pid: process.pid
    });
    this.log.debug("StreamMachine standalone initialized.");
    process.title = "StreamMachine";
    StandaloneMode.__super__.constructor.apply(this, arguments);
    this.streams = {};
    this.master = new Master(_.extend({}, this.opts, {
      logger: this.log.child({
        mode: "master"
      })
    }));
    this.slave = new Slave(_.extend({}, this.opts, {
      logger: this.log.child({
        mode: "slave"
      })
    }));
    this.server = express();
    this.api_server = null;
    this.api_handle = null;
    if (this.opts.api_port) {
      this.api_server = express();
      this.api_server.use("/api", this.master.api.app);
    } else {
      this.log.error("USING API ON MAIN PORT IS UNSAFE! See api_port documentation.");
      this.server.use("/api", this.master.api.app);
    }
    this.server.use(this.slave.server.app);
    if (process.send != null) {
      this._rpc = new RPC(process, {
        functions: {
          OK: function(msg, handle, cb) {
            return cb(null, "OK");
          },
          standalone_port: (function(_this) {
            return function(msg, handle, cb) {
              var _ref;
              return cb(null, ((_ref = _this.handle) != null ? _ref.address().port : void 0) || "NONE");
            };
          })(this),
          source_port: (function(_this) {
            return function(msg, handle, cb) {
              var _ref, _ref1;
              return cb(null, ((_ref = _this.master.sourcein) != null ? (_ref1 = _ref.server.address()) != null ? _ref1.port : void 0 : void 0) || "NONE");
            };
          })(this),
          api_port: (function(_this) {
            return function(msg, handle, cb) {
              var _ref;
              return cb(null, (typeof api_handle !== "undefined" && api_handle !== null ? (_ref = api_handle.address()) != null ? _ref.port : void 0 : void 0) || "NONE");
            };
          })(this),
          stream_listener: (function(_this) {
            return function(msg, handle, cb) {
              return _this.slave.landListener(msg, handle, cb);
            };
          })(this),
          config: (function(_this) {
            return function(config, handle, cb) {
              return _this.master.configure(config, function(err) {
                return cb(err, _this.master.config());
              });
            };
          })(this),
          status: (function(_this) {
            return function(msg, handle, cb) {
              return _this.status(cb);
            };
          })(this)
        }
      });
    }
    this.master.on("streams", (function(_this) {
      return function(streams) {
        debug("Standalone saw master streams event");
        _this.slave.once("streams", function() {
          var k, v, _ref, _results;
          debug("Standalone got followup slave streams event");
          _ref = _this.master.streams;
          _results = [];
          for (k in _ref) {
            v = _ref[k];
            debug("Checking stream " + k);
            if (_this.slave.streams[k] != null) {
              debug("Mapping master -> slave for " + k);
              _this.log.debug("mapping master -> slave on " + k);
              if (!_this.slave.streams.source) {
                _results.push(_this.slave.streams[k].useSource(v));
              } else {
                _results.push(void 0);
              }
            } else {
              _results.push(_this.log.error("Unable to map master -> slave for " + k));
            }
          }
          return _results;
        });
        return _this.slave.configureStreams(_this.master.config().streams);
      };
    })(this));
    this.log.debug("Standalone is listening on port " + this.opts.port);
    if (nconf.get("handoff")) {
      this._handoffStart(cb);
    } else {
      this._normalStart(cb);
    }
  }

  StandaloneMode.prototype._handoffStart = function(cb) {
    return this._acceptHandoff((function(_this) {
      return function(err) {
        if (err) {
          _this.log.error("_handoffStart Failed! Falling back to normal start: " + err);
          return _this._normalStart(cb);
        }
      };
    })(this));
  };

  StandaloneMode.prototype._normalStart = function(cb) {
    this.log.info("Attaching listeners.");
    this.master.sourcein.listen();
    this.handle = this.server.listen(this.opts.port);
    if (this.api_server) {
      this.log.info("Starting API server on port " + this.opts.api_port);
      this.api_handle = this.api_server.listen(this.opts.api_port);
    }
    return typeof cb === "function" ? cb(null, this) : void 0;
  };

  StandaloneMode.prototype.status = function(cb) {
    var aF, status;
    status = {
      master: null,
      slave: null
    };
    aF = _.after(2, (function(_this) {
      return function() {
        return cb(null, status);
      };
    })(this));
    status.master = this.master.status();
    aF();
    return this.slave._streamStatus((function(_this) {
      return function(err, s) {
        if (err) {
          return cb(err);
        }
        status.slave = s;
        return aF();
      };
    })(this));
  };

  StandaloneMode.prototype._sendHandoff = function(rpc) {
    this.log.event("Got handoff signal from new process.");
    debug("In _sendHandoff. Waiting for config.");
    return rpc.once("configured", (function(_this) {
      return function(msg, handle, cb) {
        debug("... got configured. Syncing running config.");
        return rpc.request("config", _this.master.config(), function(err, streams) {
          if (err) {
            _this.log.error("Error setting config on new process: " + err);
            cb("Error sending config: " + err);
            return false;
          }
          _this.log.info("New process confirmed configuration.");
          debug("New process confirmed configuration.");
          cb();
          return _this.master.sendHandoffData(rpc, function(err) {
            var _afterSockets;
            _this.log.event("Sent master data to new process.");
            _afterSockets = _.after(3, function() {
              debug("Socket transfer is done.");
              _this.log.info("Sockets transferred. Sending listeners.");
              debug("Beginning listener transfer.");
              return _this.slave.ejectListeners(function(obj, h, lcb) {
                debug("Sending a listener...", obj);
                return _this._rpc.request("stream_listener", obj, h, function(err) {
                  if (err) {
                    debug("Listener transfer error: " + err);
                  }
                  return lcb();
                });
              }, function(err) {
                if (err) {
                  _this.log.error("Error sending listeners during handoff: " + err);
                }
                _this.log.info("Standalone handoff has sent all information. Exiting.");
                debug("Standalone handoff complete. Exiting.");
                return process.exit();
              });
            });
            _this.log.info("Hand off standalone socket.");
            rpc.request("standalone_handle", null, _this.handle, function(err) {
              if (err) {
                _this.log.error("Error sending standalone handle: " + err);
              }
              debug("Standalone socket sent: " + err);
              _this.handle.unref();
              return _afterSockets();
            });
            _this.log.info("Hand off source socket.");
            rpc.request("source_socket", null, _this.master.sourcein.server, function(err) {
              if (err) {
                _this.log.error("Error sending source socket: " + err);
              }
              debug("Source socket sent: " + err);
              _this.master.sourcein.server.unref();
              return _afterSockets();
            });
            _this.log.info("Hand off API socket (if it exists).");
            return rpc.request("api_handle", null, _this.api_handle, function(err) {
              var _ref;
              if (err) {
                _this.log.error("Error sending API socket: " + err);
              }
              debug("API socket sent: " + err);
              if ((_ref = _this.api_handle) != null) {
                _ref.unref();
              }
              return _afterSockets();
            });
          });
        });
      };
    })(this));
  };

  StandaloneMode.prototype._acceptHandoff = function(cb) {
    var handoff_timer;
    this.log.info("Initializing handoff receptor.");
    debug("In _acceptHandoff");
    if (!this._rpc) {
      cb(new Error("Handoff called, but no RPC interface set up."));
      return false;
    }
    handoff_timer = setTimeout((function(_this) {
      return function() {
        debug("Handoff failed to handshake. Done waiting.");
        return cb(new Error("Handoff failed to handshake within five seconds."));
      };
    })(this), 5000);
    debug("Waiting for HANDOFF_GO");
    return this._rpc.once("HANDOFF_GO", (function(_this) {
      return function(msg, handle, ccb) {
        clearTimeout(handoff_timer);
        debug("HANDOFF_GO received.");
        ccb(null, "GO");
        debug("Waiting for internal configuration signal.");
        return _this.master.once_configured(function() {
          debug("Telling handoff sender that we're configured.");
          return _this._rpc.request("configured", _this.master.config(), function(err, reply) {
            var aFunc;
            if (err) {
              _this.log.error("Failed to send config broadcast when starting handoff: " + err);
              return false;
            }
            debug("Handoff sender ACKed config.");
            _this.log.info("Handoff initiator ACKed our config broadcast.");
            _this.master.loadHandoffData(_this._rpc, function() {
              return _this.log.info("Master handoff receiver believes all stream and source data has arrived.");
            });
            aFunc = _.after(3, function() {
              _this.log.info("All handles are up.");
              return typeof cb === "function" ? cb(null, _this) : void 0;
            });
            _this._rpc.once("source_socket", function(msg, handle, cb) {
              _this.log.info("Source socket is incoming.");
              _this.master.sourcein.listen(handle);
              debug("Now listening on source socket.");
              cb(null);
              return aFunc();
            });
            _this._rpc.once("standalone_handle", function(msg, handle, cb) {
              _this.log.info("Standalone socket is incoming.");
              _this.handle = _this.server.listen(handle);
              debug("Now listening on standalone socket.");
              cb(null);
              return aFunc();
            });
            return _this._rpc.once("api_handle", function(msg, handle, cb) {
              if (handle && _this.api_server) {
                debug("Handoff sent API socket and we have API server");
                _this.log.info("API socket is incoming.");
                _this.api_handle = _this.api_server.listen(handle);
                debug("Now listening on API socket.");
              } else {
                _this.log.info("Handoff sent no API socket");
                debug("Handoff sent no API socket.");
                if (_this.api_server) {
                  debug("Handoff sent no API socket, but we have API server. Listening.");
                  _this.api_handle = _this.api_server.listen(_this.opts.api_port);
                }
              }
              cb(null);
              return aFunc();
            });
          });
        });
      };
    })(this));
  };

  return StandaloneMode;

})(require("./base"));

//# sourceMappingURL=standalone.js.map
