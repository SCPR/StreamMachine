var Rewinder, debug, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

_ = require("underscore");

debug = require("debug")("sm:rewind:rewinder");

module.exports = Rewinder = (function(_super) {
  __extends(Rewinder, _super);

  function Rewinder(rewind, conn_id, opts, cb) {
    var finalizeFunc, oFunc, offset;
    this.rewind = rewind;
    this.conn_id = conn_id;
    if (opts == null) {
      opts = {};
    }
    this._insert = __bind(this._insert, this);
    this._read = __bind(this._read, this);
    Rewinder.__super__.constructor.call(this, {
      highWaterMark: 256 * 1024
    });
    this._sentDuration = 0;
    this._sentBytes = 0;
    this._offsetSeconds = null;
    this._contentTime = null;
    this._pumpOnly = false;
    this._offset = -1;
    this._queue = [];
    this._queuedBytes = 0;
    this._reading = false;
    this._bounceRead = _.debounce((function(_this) {
      return function() {
        return _this.read(0);
      };
    })(this), 100);
    this._segTimer = null;
    this.pumpSecs = opts.pump === true ? this.rewind.opts.burst : opts.pump;
    finalizeFunc = (function(_this) {
      return function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        if (!_this._pumpOnly) {
          _this._segTimer = setInterval(function() {
            var obj;
            obj = {
              id: _this.conn_id,
              bytes: _this._sentBytes,
              seconds: _this._sentDuration,
              contentTime: _this._contentTime
            };
            _this.emit("listen", obj);
            _this.rewind.recordListen(obj);
            _this._sentBytes = 0;
            _this._sentDuration = 0;
            return _this._contentTime = null;
          }, opts.logInterval || 30 * 1000);
        }
        cb.apply(null, [null, _this].concat(__slice.call(args)));
        finalizeFunc = null;
        return cb = null;
      };
    })(this);
    oFunc = (function(_this) {
      return function(_offset) {
        _this._offset = _offset;
        debug("Rewinder: creation with ", {
          opts: opts,
          offset: _this._offset
        });
        if (opts != null ? opts.live_segment : void 0) {
          _this._pumpOnly = true;
          return _this.rewind.hls.pumpSegment(_this, opts.live_segment, function(err, info) {
            if (err) {
              return cb(err);
            }
            debug("Pumping HLS segment with ", {
              duration: info.duration,
              length: info.length,
              offsetSeconds: info.offsetSeconds
            });
            _this._offsetSeconds = info.offsetSeconds;
            return finalizeFunc(info);
          });
        } else if (opts != null ? opts.pumpOnly : void 0) {
          _this._pumpOnly = true;
          return _this.rewind.pumpFrom(_this, _this._offset, _this.rewind.secsToOffset(_this.pumpSecs), false, function(err, info) {
            if (err) {
              return cb(err);
            }
            return finalizeFunc(info);
          });
        } else if (opts != null ? opts.pump : void 0) {
          if (_this._offset === 0) {
            debug("Rewinder: Pumping " + _this.rewind.opts.burst + " seconds.");
            _this.rewind.pumpSeconds(_this, _this.pumpSecs, true);
            return finalizeFunc();
          } else {
            return _this.rewind.burstFrom(_this, _this._offset, _this.pumpSecs, function(err, new_offset) {
              if (err) {
                return cb(err);
              }
              _this._offset = new_offset;
              return finalizeFunc();
            });
          }
        } else {
          return finalizeFunc();
        }
      };
    })(this);
    if (opts.timestamp) {
      this.rewind.findTimestamp(opts.timestamp, (function(_this) {
        return function(err, offset) {
          if (err) {
            return cb(err);
          }
          return oFunc(offset);
        };
      })(this));
    } else {
      offset = opts.offsetSecs ? this.rewind.checkOffsetSecs(opts.offsetSecs) : opts.offset ? this.rewind.checkOffset(opts.offset) : 0;
      oFunc(offset);
    }
  }

  Rewinder.prototype.onFirstMeta = function(cb) {
    if (this._queue.length > 0) {
      return typeof cb === "function" ? cb(null, this._queue[0].meta) : void 0;
    } else {
      return this.once("readable", (function(_this) {
        return function() {
          return typeof cb === "function" ? cb(null, _this._queue[0].meta) : void 0;
        };
      })(this));
    }
  };

  Rewinder.prototype._read = function(size) {
    var sent, _pushQueue;
    if (this._reading) {
      return false;
    }
    this._reading = true;
    sent = 0;
    _pushQueue = (function(_this) {
      return function() {
        var next_buf, _handleEmpty;
        _handleEmpty = function() {
          if (_this._pumpOnly) {
            _this.push(null);
          } else {
            _this.push('');
          }
          _this._reading = false;
          return false;
        };
        if (_this._queue.length === 0) {
          return _handleEmpty();
        }
        next_buf = _this._queue.shift();
        if (!next_buf) {
          _this.rewind.log.error("Shifted queue but got null", {
            length: _this._queue.length
          });
        }
        _this._queuedBytes -= next_buf.data.length;
        _this._sentBytes += next_buf.data.length;
        _this._sentDuration += next_buf.duration / 1000;
        debug("Sent duration is now " + _this._sentDuration);
        if (next_buf.meta) {
          _this.emit("meta", next_buf.meta);
        }
        if (_this.push(next_buf.data)) {
          sent += next_buf.data.length;
          if (sent < size && _this._queue.length > 0) {
            return _pushQueue();
          } else {
            if (_this._queue.length === 0) {
              return _handleEmpty();
            } else {
              _this.push('');
              return _this._reading = false;
            }
          }
        } else {
          _this._reading = false;
          return _this.emit("readable");
        }
      };
    })(this);
    return _pushQueue();
  };

  Rewinder.prototype._insert = function(b) {
    this._queue.push(b);
    this._queuedBytes += b.data.length;
    if (!this._contentTime) {
      this._contentTime = b.ts;
    }
    if (!this._reading) {
      return this._bounceRead();
    }
  };

  Rewinder.prototype.setOffset = function(offset) {
    var data, _ref;
    this._offset = this.rewind.checkOffsetSecs(offset);
    this._queue.slice(0);
    if (this._offset === 0) {
      debug("Rewinder: Pumping " + this.rewind.opts.burst + " seconds.");
      this.rewind.pumpSeconds(this, this.pumpSecs);
    } else {
      _ref = this.rewind.burstFrom(this._offset, this.pumpSecs), this._offset = _ref[0], data = _ref[1];
      this._queue.push(data);
    }
    return this._offset;
  };

  Rewinder.prototype.offset = function() {
    return this._offset;
  };

  Rewinder.prototype.offsetSecs = function() {
    return this.rewind.offsetToSecs(this._offset);
  };

  Rewinder.prototype.disconnect = function() {
    var obj;
    this.rewind._rremoveListener(this);
    obj = {
      id: this.conn_id,
      bytes: this._sentBytes,
      seconds: this._sentDuration,
      offsetSeconds: this._offsetSeconds,
      contentTime: this._contentTime
    };
    this.emit("listen", obj);
    this.rewind.recordListen(obj);
    if (this._segTimer) {
      clearInterval(this._segTimer);
    }
    this.rewind.disconnectListener(this.conn_id);
    return this.removeAllListeners();
  };

  return Rewinder;

})(require("stream").Readable);

//# sourceMappingURL=rewinder.js.map
