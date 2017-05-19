var Debounce, HLSSegmenter, MAX_PTS, tz, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require("underscore");

tz = require('timezone');

Debounce = require("../util/debounce");

MAX_PTS = Math.pow(2, 33) - 1;

module.exports = HLSSegmenter = (function(_super) {
  __extends(HLSSegmenter, _super);

  function HLSSegmenter(rewind, segment_length, log) {
    this.rewind = rewind;
    this.segment_length = segment_length;
    this.log = log;
    this.segments = [];
    this._rewindLoading = false;
    this.injector = new HLSSegmenter.Injector(this.segment_length * 1000, this.log);
    this._snapDebounce = new Debounce(1000, (function(_this) {
      return function() {
        return _this.finalizer.snapshot(function(err, snap) {
          return _this.emit("snapshot", {
            segment_duration: _this.segment_length,
            segments: snap
          });
        });
      };
    })(this));
    this.finalizer = null;
    this._createFinalizer = _.once((function(_this) {
      return function(map) {
        _this.finalizer = new HLSSegmenter.Finalizer(_this.log, _this.segment_length * 1000, map);
        _this.injector.pipe(_this.finalizer);
        _this.segments = _this.finalizer.segments;
        _this.finalizer.on("add", function() {
          return _this._snapDebounce.ping();
        });
        _this.finalizer.on("remove", function() {
          var _ref;
          _this._snapDebounce.ping();
          if (!_this._rewindLoading && _this.segments[0]) {
            return (_ref = _this.group) != null ? _ref.hlsUpdateMinSegment(Number(_this.segments[0].ts)) : void 0;
          }
        });
        return _this.emit("_finalizer");
      };
    })(this));
    this.injector.once("readable", (function(_this) {
      return function() {
        return setTimeout(function() {
          return _this._createFinalizer();
        }, 1000);
      };
    })(this));
    this.rewind.on("rpush", (function(_this) {
      return function(c) {
        return _this.injector.write(c);
      };
    })(this));
    this.rewind.on("runshift", (function(_this) {
      return function(c) {
        return _this.injector.write(c);
      };
    })(this));
    this.rewind.on("rshift", (function(_this) {
      return function(chunk) {
        var _ref;
        return (_ref = _this.finalizer) != null ? _ref.expire(chunk.ts, function(err, seg_id) {
          if (err) {
            _this.log.error("Error expiring audio chunk: " + err);
            return false;
          }
        }) : void 0;
      };
    })(this));
    this.rewind.once("rewind_loading", (function(_this) {
      return function() {
        return _this._rewindLoading = true;
      };
    })(this));
    this.rewind.once("rewind_loaded", (function(_this) {
      return function() {
        return _this.injector._flush(function() {
          _this.log.debug("HLS Injector flushed");
          return _this.once("snapshot", function() {
            var _ref;
            _this.log.debug("HLS rewind loaded and settled. Length: " + _this.segments.length);
            _this._rewindLoading = false;
            if (_this.segments[0]) {
              return (_ref = _this.group) != null ? _ref.hlsUpdateMinSegment(Number(_this.segments[0].ts)) : void 0;
            }
          });
        });
      };
    })(this));
    this._gSyncFunc = (function(_this) {
      return function(ts) {
        var _ref;
        return (_ref = _this.finalizer) != null ? _ref.setMinTS(ts, function(err, seg_id) {
          return _this.log.silly("Synced min segment TS to " + ts + ". Got " + seg_id + ".");
        }) : void 0;
      };
    })(this);
  }

  HLSSegmenter.prototype.syncToGroup = function(g) {
    if (g == null) {
      g = null;
    }
    if (this.group) {
      this.group.removeListener("hls_update_min_segment", this._gSyncFunc);
      this.group = null;
    }
    if (g) {
      this.group = g;
      this.group.addListener("hls_update_min_segment", this._gSyncFunc);
    }
    return true;
  };

  HLSSegmenter.prototype._dumpMap = function(cb) {
    if (this.finalizer) {
      return this.finalizer.dumpMap(cb);
    } else {
      return cb(null, null);
    }
  };

  HLSSegmenter.prototype._loadMap = function(map) {
    return this._createFinalizer(map);
  };

  HLSSegmenter.prototype.status = function() {
    var status, _ref, _ref1, _ref2, _ref3;
    return status = {
      hls_segments: this.segments.length,
      hls_first_seg_id: (_ref = this.segments[0]) != null ? _ref.id : void 0,
      hls_first_seg_ts: (_ref1 = this.segments[0]) != null ? _ref1.ts : void 0,
      hls_last_seg_id: (_ref2 = this.segments[this.segments.length - 1]) != null ? _ref2.id : void 0,
      hls_last_seg_ts: (_ref3 = this.segments[this.segments.length - 1]) != null ? _ref3.ts : void 0
    };
  };

  HLSSegmenter.prototype.snapshot = function(cb) {
    if (this.finalizer) {
      return this.finalizer.snapshot((function(_this) {
        return function(err, segments) {
          return cb(null, {
            segments: segments,
            segment_duration: _this.segment_length
          });
        };
      })(this));
    } else {
      return cb(null, null);
    }
  };

  HLSSegmenter.prototype.pumpSegment = function(id, cb) {
    var seg;
    if (seg = this.segment_idx[id]) {
      return cb(null, seg);
    } else {
      return cb(new Error("HTTP Live Streaming segment not found."));
    }
  };

  HLSSegmenter.Injector = (function(_super1) {
    __extends(Injector, _super1);

    function Injector(segment_length, log) {
      this.segment_length = segment_length;
      this.log = log;
      this.first_seg = null;
      this.last_seg = null;
      Injector.__super__.constructor.call(this, {
        objectMode: true
      });
    }

    Injector.prototype._transform = function(chunk, encoding, cb) {
      var seg, _ref, _ref1;
      if (this.last_seg && ((this.last_seg.ts <= (_ref = chunk.ts) && _ref < this.last_seg.end_ts))) {
        this.last_seg.buffers.push(chunk);
        return cb();
      } else if (this.first_seg && ((this.first_seg.ts <= (_ref1 = chunk.ts) && _ref1 < this.first_seg.end_ts))) {
        this.first_seg.buffers.unshift(chunk);
        return cb();
      } else if (!this.last_seg || (chunk.ts >= this.last_seg.end_ts)) {
        seg = this._createSegment(chunk.ts);
        if (!seg) {
          return cb();
        }
        seg.buffers.push(chunk);
        if (!this.first_seg) {
          this.first_seg = this.last_seg;
        } else {
          if (this.last_seg) {
            this.emit("push", this.last_seg);
            this.push(this.last_seg);
          }
        }
        this.last_seg = seg;
        return cb();
      } else if (!this.first_seg || (chunk.ts < this.first_seg.ts)) {
        seg = this._createSegment(chunk.ts);
        if (!seg) {
          return cb();
        }
        seg.buffers.push(chunk);
        if (this.first_seg) {
          this.emit("push", this.first_seg);
          this.push(this.first_seg);
        }
        this.first_seg = seg;
        return cb();
      } else {
        this.log.error("Not sure where to place segment!!! ", {
          chunk_ts: chunk.ts
        });
        return cb();
      }
    };

    Injector.prototype._flush = function(cb) {
      var b, duration, seg, _i, _j, _len, _len1, _ref, _ref1;
      _ref = [this.first_seg, this.last_seg];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        seg = _ref[_i];
        if (seg) {
          duration = 0;
          _ref1 = seg.buffers;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            b = _ref1[_j];
            duration += b.duration;
          }
          this.log.debug("HLS Injector flush checking segment: " + seg.ts + ", " + duration);
          if (duration >= this.segment_length) {
            this.emit("push", seg);
            this.push(seg);
          }
        }
      }
      return cb();
    };

    Injector.prototype._createSegment = function(ts) {
      var seg_start;
      seg_start = Math.floor(Number(ts) / this.segment_length) * this.segment_length;
      return {
        id: null,
        ts: new Date(seg_start),
        end_ts: new Date(seg_start + this.segment_length),
        buffers: []
      };
    };

    return Injector;

  })(require("stream").Transform);

  HLSSegmenter.Finalizer = (function(_super1) {
    __extends(Finalizer, _super1);

    function Finalizer(log, segmentLen, seg_data) {
      this.log = log;
      this.segmentLen = segmentLen;
      if (seg_data == null) {
        seg_data = null;
      }
      this.segments = [];
      this.segment_idx = {};
      this.segmentSeq = (seg_data != null ? seg_data.segmentSeq : void 0) || 0;
      this.discontinuitySeq = (seg_data != null ? seg_data.discontinuitySeq : void 0) || 0;
      this.firstSegment = (seg_data != null ? seg_data.nextSegment : void 0) ? Number(seg_data != null ? seg_data.nextSegment : void 0) : null;
      this.segment_map = (seg_data != null ? seg_data.segmentMap : void 0) || {};
      this.segmentPTS = (seg_data != null ? seg_data.segmentPTS : void 0) || (this.segmentSeq * (this.segmentLen * 90));
      this.discontinuitySeqR = this.discontinuitySeq;
      this._min_ts = null;
      Finalizer.__super__.constructor.call(this, {
        objectMode: true
      });
    }

    Finalizer.prototype.expire = function(ts, cb) {
      var f_s, _ref;
      while (true) {
        if (((f_s = this.segments[0]) != null) && Number(f_s.ts) <= Number(ts)) {
          this.segments.shift();
          delete this.segment_idx[f_s.id];
          this.emit("remove", f_s);
        } else {
          break;
        }
      }
      return cb(null, (_ref = this.segments[0]) != null ? _ref.id : void 0);
    };

    Finalizer.prototype.setMinTS = function(ts, cb) {
      if (ts instanceof Date) {
        ts = Number(ts);
      }
      this._min_ts = ts;
      return this.expire(ts - 1, cb);
    };

    Finalizer.prototype.dumpMap = function(cb) {
      var map, seg, seg_map, _i, _len, _ref, _ref1;
      seg_map = {};
      _ref = this.segments;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        seg = _ref[_i];
        if (seg.discontinuity == null) {
          seg_map[Number(seg.ts)] = seg.id;
        }
      }
      map = {
        segmentMap: seg_map,
        segmentSeq: this.segmentSeq,
        segmentLen: this.segmentLen,
        segmentPTS: this.segmentPTS,
        discontinuitySeq: this.discontinuitySeq,
        nextSegment: (_ref1 = this.segments[this.segments.length - 1]) != null ? _ref1.end_ts : void 0
      };
      return cb(null, map);
    };

    Finalizer.prototype.snapshot = function(cb) {
      var snapshot;
      snapshot = this.segments.slice(0);
      return cb(null, snapshot);
    };

    Finalizer.prototype._write = function(segment, encoding, cb) {
      var b, data_length, duration, last_buf, last_seg, seg_id, seg_pts, sorted_buffers, _i, _len;
      last_seg = this.segments.length > 0 ? this.segments[this.segments.length - 1] : null;
      seg_id = null;
      seg_pts = null;
      if (this.segment_map[Number(segment.ts)] != null) {
        seg_id = this.segment_map[Number(segment.ts)];
        this.log.silly("Pulling segment ID from loaded segment map", {
          id: seg_id,
          ts: segment.ts
        });
        if (this._min_ts && segment.end_ts < this._min_ts) {
          this.log.debug("Discarding segment below our minimum TS.", {
            segment_id: seg_id,
            min_ts: this._min_ts
          });
          cb();
          return false;
        }
      } else {
        if ((!last_seg && (!this.firstSegment || Number(segment.ts) > this.firstSegment)) || (last_seg && Number(segment.ts) > Number(last_seg.ts))) {
          seg_id = this.segmentSeq;
          this.segmentSeq += 1;
        } else {
          this.log.debug("Discarding segment without ID from front of buffer.", {
            segment_ts: segment.ts
          });
          cb();
          return false;
        }
      }
      segment.id = seg_id;
      sorted_buffers = _(segment.buffers).sortBy("ts");
      last_buf = sorted_buffers[sorted_buffers.length - 1];
      segment.ts_actual = sorted_buffers[0].ts;
      segment.end_ts_actual = new Date(Number(last_buf.ts) + last_buf.duration);
      duration = 0;
      data_length = 0;
      for (_i = 0, _len = sorted_buffers.length; _i < _len; _i++) {
        b = sorted_buffers[_i];
        duration += b.duration;
        data_length += b.data.length;
      }
      segment.data_length = data_length;
      segment.duration = duration;
      delete segment.buffers;
      if (Math.abs(segment.ts - segment.ts_actual) > 3000) {
        segment.ts = segment.ts_actual;
      }
      if (Math.abs(segment.end_ts - segment.ts_end_actual) > 3000) {
        segment.end_ts = segment.ts_end_actual;
      }
      if (!last_seg || Number(segment.ts) > last_seg.ts) {
        segment.discontinuitySeq = !last_seg || segment.ts - last_seg.end_ts === 0 ? this.discontinuitySeq : this.discontinuitySeq += 1;
        segment.pts = this.segmentPTS;
        this.segmentPTS = Math.round(this.segmentPTS + (segment.duration * 90));
        if (this.segmentPTS > MAX_PTS) {
          this.segmentPTS = this.segmentPTS - MAX_PTS;
        }
        this.segments.push(segment);
      } else if (Number(segment.ts) < this.segments[0].ts) {
        segment.discontinuitySeq = segment.end_ts - this.segments[0].ts === 0 ? this.discontinuitySeqR : this.discontinuitySeqR -= 1;
        segment.pts = Math.round(this.segments[0].pts > (segment.duration * 90) ? this.segments[0].pts - (segment.duration * 90) : MAX_PTS - (segment.duration * 90) + this.segments[0].pts);
        this.segments.unshift(segment);
      }
      this.segment_idx[segment.id] = segment;
      this.emit("add", segment);
      return cb();
    };

    return Finalizer;

  })(require("stream").Writable);

  return HLSSegmenter;

})(require("events").EventEmitter);

//# sourceMappingURL=hls_segmenter.js.map
