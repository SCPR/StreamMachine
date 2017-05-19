var HLSIndex, Preroller, Rewind, Stream, debug, uuid, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

_ = require("underscore");

uuid = require("node-uuid");

Preroller = require("./preroller");

Rewind = require("../rewind_buffer");

HLSIndex = require("../rewind/hls_index");

debug = require("debug")("sm:slave:stream");

module.exports = Stream = (function(_super) {
  __extends(Stream, _super);

  function Stream(core, key, log, opts) {
    this.core = core;
    this.key = key;
    this.log = log;
    this.opts = opts;
    this.STATUS = "Initializing";
    Stream.__super__.constructor.call(this, {
      seconds: this.opts.seconds,
      burst: this.opts.burst
    });
    this.StreamTitle = this.opts.metaTitle;
    this.StreamUrl = "";
    this.setMaxListeners(0);
    this._id_increment = 1;
    this._lmeta = {};
    this.preroll = null;
    this.mlog_timer = null;
    this._totalConnections = 0;
    this._totalKBytesSent = 0;
    this.metaFunc = (function(_this) {
      return function(chunk) {
        if (chunk.StreamTitle) {
          _this.StreamTitle = chunk.StreamTitle;
        }
        if (chunk.StreamUrl) {
          return _this.StreamUrl = chunk.StreamUrl;
        }
      };
    })(this);
    this.bufferFunc = (function(_this) {
      return function(c) {
        return _this._insertBuffer(c);
      };
    })(this);
    this.once("source", (function(_this) {
      return function() {
        _this.source.on("meta", _this.metaFunc);
        return _this.source.on("buffer", _this.bufferFunc);
      };
    })(this));
    process.nextTick((function(_this) {
      return function() {
        return _this.configure(_this.opts);
      };
    })(this));
    if (this.opts.hls) {
      this.log.debug("Enabling HLS Index for stream.");
      this.hls = new HLSIndex(this, this.opts.tz);
      this.once("source", (function(_this) {
        return function(source) {
          source.on("hls_snapshot", function(snapshot) {
            return _this.hls.loadSnapshot(snapshot);
          });
          return source.getHLSSnapshot(function(err, snapshot) {
            return _this.hls.loadSnapshot(snapshot);
          });
        };
      })(this));
    }
    this.emit("_source_waiting");
    this._sourceInitializing = true;
    this._sourceInitT = setTimeout((function(_this) {
      return function() {
        _this._sourceInitializing = false;
        _this.emit("_source_init");
        return debug("Sending _source_init after source timeout");
      };
    })(this), 15 * 1000);
    this.once("source", (function(_this) {
      return function(source) {
        debug("Stream source is incoming.");
        clearTimeout(_this._sourceInitT);
        _this._sourceInitializing = true;
        return source.getRewind(function(err, stream, req) {
          if (err) {
            _this.log.error("Source getRewind encountered an error: " + err, {
              error: err
            });
            _this._sourceInitializing = false;
            _this.emit("_source_init");
            debug("Sending _source_init after load error");
            return false;
          }
          return _this.loadBuffer(stream, function(err) {
            _this.log.debug("Slave source loaded rewind buffer.");
            _this._sourceInitializing = false;
            _this.emit("_source_init");
            return debug("Sending _source_init after load success");
          });
        });
      };
    })(this));
  }

  Stream.prototype.status = function() {
    return _.extend(this._rStatus(), {
      key: this.key,
      listeners: this.listeners(),
      connections: this._totalConnections,
      kbytes_sent: this._totalKBytesSent
    });
  };

  Stream.prototype.useSource = function(source) {
    if (this.source === source) {
      return true;
    }
    this.log.debug("Slave stream got source connection");
    this.source = source;
    return this.emit("source", this.source);
  };

  Stream.prototype.getStreamKey = function(cb) {
    if (this.opts.stream_key) {
      return cb(this.opts.stream_key);
    } else {
      if (this.source) {
        return this.source.getStreamKey(cb);
      } else {
        return this.once("source", (function(_this) {
          return function() {
            return _this.source.getStreamKey(cb);
          };
        })(this));
      }
    }
  };

  Stream.prototype._once_source_loaded = function(cb) {
    if (this._sourceInitializing) {
      debug("_once_source_loaded is waiting for _source_init");
      return this.once("_source_init", (function(_this) {
        return function() {
          return typeof cb === "function" ? cb() : void 0;
        };
      })(this));
    } else {
      return typeof cb === "function" ? cb() : void 0;
    }
  };

  Stream.prototype.configure = function(opts) {
    var key;
    this.opts = opts;
    this.log.debug("Preroll settings are ", {
      preroll: this.opts.preroll
    });
    if ((this.opts.preroll != null) && this.opts.preroll !== "") {
      key = this.opts.preroll_key && this.opts.preroll_key !== "" ? this.opts.preroll_key : this.key;
      new Preroller(this, key, this.opts.preroll, this.opts.transcoder, this.opts.impression_delay, (function(_this) {
        return function(err, pre) {
          if (err) {
            _this.log.error("Failed to create preroller: " + err);
            return false;
          }
          _this.preroll = pre;
          return _this.log.debug("Preroller is created.");
        };
      })(this));
    }
    this.log.debug("Stream's max buffer size is " + this.opts.max_buffer);
    if (this.buf_timer) {
      clearInterval(this.buf_timer);
      this.buf_timer = null;
    }
    this.buf_timer = setInterval((function(_this) {
      return function() {
        var all_buf, id, l, _ref, _ref1, _ref2;
        all_buf = 0;
        _ref = _this._lmeta;
        for (id in _ref) {
          l = _ref[id];
          all_buf += l.rewind._queuedBytes + ((_ref1 = l.obj.socket) != null ? _ref1.bufferSize : void 0);
          if ((l.rewind._queuedBytes || 0) + (((_ref2 = l.obj.socket) != null ? _ref2.bufferSize : void 0) || 0) > _this.opts.max_buffer) {
            _this.log.debug("Connection exceeded max buffer size.", {
              client: l.obj.client,
              bufferSize: l.rewind._queuedBytes
            });
            l.obj.disconnect(true);
          }
        }
        return _this.log.silly("All buffers: " + all_buf);
      };
    })(this), 60 * 1000);
    this.setRewind(this.opts.seconds, this.opts.burst);
    return this.emit("config");
  };

  Stream.prototype.disconnect = function() {
    var k, l, _ref, _ref1, _ref2, _ref3;
    _ref = this._lmeta;
    for (k in _ref) {
      l = _ref[k];
      l.obj.disconnect(true);
    }
    if (this.buf_timer) {
      clearInterval(this.buf_timer);
      this.buf_timer = null;
    }
    if ((_ref1 = this.source) != null) {
      _ref1.removeListener("meta", this.metaFunc);
    }
    if ((_ref2 = this.source) != null) {
      _ref2.removeListener("buffer", this.bufferFunc);
    }
    this.source = null;
    this.metaFunc = this.bufferFunc = function() {};
    if ((_ref3 = this.hls) != null) {
      _ref3.disconnect();
    }
    Stream.__super__.disconnect.call(this);
    this.emit("disconnect");
    return this.removeAllListeners();
  };

  Stream.prototype.listeners = function() {
    return _(this._lmeta).keys().length;
  };

  Stream.prototype.listen = function(obj, opts, cb) {
    var lmeta;
    lmeta = {
      id: this._id_increment++,
      obj: obj,
      startTime: opts.startTime || (new Date)
    };
    this._totalConnections += 1;
    opts = _.extend({
      logInterval: this.opts.log_interval
    }, opts);
    return this._once_source_loaded((function(_this) {
      return function() {
        return _this.getRewinder(lmeta.id, opts, function() {
          var err, extra, rewind;
          err = arguments[0], rewind = arguments[1], extra = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
          if (err) {
            if (typeof cb === "function") {
              cb(err, null);
            }
            return false;
          }
          lmeta.rewind = rewind;
          _this._lmeta[lmeta.id] = lmeta;
          return typeof cb === "function" ? cb.apply(null, [null, lmeta.rewind].concat(__slice.call(extra))) : void 0;
        });
      };
    })(this));
  };

  Stream.prototype.disconnectListener = function(id) {
    var lmeta;
    if (lmeta = this._lmeta[id]) {
      delete this._lmeta[id];
      return true;
    } else {
      return console.error("disconnectListener called for " + id + ", but no listener found.");
    }
  };

  Stream.prototype.recordListen = function(opts) {
    var lmeta;
    if (opts.bytes) {
      opts.kbytes = Math.floor(opts.bytes / 1024);
    }
    if (_.isNumber(opts.kbytes)) {
      this._totalKBytesSent += opts.kbytes;
    }
    if (lmeta = this._lmeta[opts.id]) {
      return this.log.interaction("", {
        type: "listen",
        client: lmeta.obj.client,
        time: new Date(),
        kbytes: opts.kbytes,
        duration: opts.seconds,
        offsetSeconds: opts.offsetSeconds,
        contentTime: opts.contentTime
      });
    }
  };

  Stream.prototype.startSession = function(client, cb) {
    this.log.interaction("", {
      type: "session_start",
      client: client,
      time: new Date(),
      session_id: client.session_id
    });
    return cb(null, client.session_id);
  };

  Stream.StreamGroup = (function(_super1) {
    __extends(StreamGroup, _super1);

    function StreamGroup(key, log) {
      this.key = key;
      this.log = log;
      this.streams = {};
      this.hls_min_id = null;
    }

    StreamGroup.prototype.addStream = function(stream) {
      var delFunc;
      if (!this.streams[stream.key]) {
        this.log.debug("SG " + this.key + ": Adding stream " + stream.key);
        this.streams[stream.key] = stream;
        delFunc = (function(_this) {
          return function() {
            _this.log.debug("SG " + _this.key + ": Stream disconnected: " + stream.key);
            return delete _this.streams[stream.key];
          };
        })(this);
        stream.on("disconnect", delFunc);
        return stream.on("config", (function(_this) {
          return function() {
            if (stream.opts.group !== _this.key) {
              return delFunc();
            }
          };
        })(this));
      }
    };

    StreamGroup.prototype.hlsUpdateMinSegment = function(id) {
      var prev;
      if (!this.hls_min_id || id > this.hls_min_id) {
        prev = this.hls_min_id;
        this.hls_min_id = id;
        this.emit("hls_update_min_segment", id);
        return this.log.debug("New HLS min segment id: " + id + " (Previously: " + prev + ")");
      }
    };

    StreamGroup.prototype.startSession = function(client, cb) {
      this.log.interaction("", {
        type: "session_start",
        client: client,
        time: new Date(),
        id: client.session_id
      });
      return cb(null, client.session_id);
    };

    return StreamGroup;

  })(require("events").EventEmitter);

  return Stream;

})(require('../rewind_buffer'));

//# sourceMappingURL=stream.js.map
