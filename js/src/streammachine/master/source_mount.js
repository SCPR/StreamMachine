var SourceMount, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require("underscore");

module.exports = SourceMount = (function(_super) {
  __extends(SourceMount, _super);

  SourceMount.prototype.DefaultOptions = {
    monitored: false,
    password: false,
    source_password: false,
    format: "mp3"
  };

  function SourceMount(key, log, opts) {
    this.key = key;
    this.log = log;
    this.opts = _.defaults(opts || {}, this.DefaultOptions);
    this.sources = [];
    this.source = null;
    this.password = this.opts.password || this.opts.source_password;
    this._vitals = null;
    this.log.event("Source Mount is initializing.");
    this.dataFunc = (function(_this) {
      return function(data) {
        return _this.emit("data", data);
      };
    })(this);
    this.vitalsFunc = (function(_this) {
      return function(vitals) {
        _this._vitals = vitals;
        return _this.emit("vitals", vitals);
      };
    })(this);
  }

  SourceMount.prototype.status = function() {
    var s;
    return {
      key: this.key,
      sources: (function() {
        var _i, _len, _ref, _results;
        _ref = this.sources;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          s = _ref[_i];
          _results.push(s.status());
        }
        return _results;
      }).call(this)
    };
  };

  SourceMount.prototype.config = function() {
    return this.opts;
  };

  SourceMount.prototype.configure = function(new_opts, cb) {
    var k, v, _ref;
    _ref = this.DefaultOptions;
    for (k in _ref) {
      v = _ref[k];
      if (new_opts[k] != null) {
        this.opts[k] = new_opts[k];
      }
      if (_.isNumber(this.DefaultOptions[k])) {
        this.opts[k] = Number(this.opts[k]);
      }
    }
    if (this.key !== this.opts.key) {
      this.key = this.opts.key;
    }
    this.password = this.opts.password || this.opts.source_password;
    this.emit("config");
    return typeof cb === "function" ? cb(null, this.config()) : void 0;
  };

  SourceMount.prototype.vitals = function(cb) {
    var _vFunc;
    _vFunc = (function(_this) {
      return function(v) {
        return typeof cb === "function" ? cb(null, v) : void 0;
      };
    })(this);
    if (this._vitals) {
      return _vFunc(this._vitals);
    } else {
      return this.once("vitals", _vFunc);
    }
  };

  SourceMount.prototype.addSource = function(source, cb) {
    var _ref, _ref1, _ref2;
    source.once("disconnect", (function(_this) {
      return function() {
        _this.sources = _(_this.sources).without(source);
        if (_this.source === source) {
          if (_this.sources.length > 0) {
            _this.useSource(_this.sources[0]);
            return _this.emit("disconnect", {
              active: true,
              count: _this.sources.length,
              source: _this.source
            });
          } else {
            _this.log.alert("Source disconnected. No sources remaining.");
            _this._disconnectSource(_this.source);
            _this.source = null;
            return _this.emit("disconnect", {
              active: true,
              count: 0,
              source: null
            });
          }
        } else {
          _this.log.event("Inactive source disconnected.");
          return _this.emit("disconnect", {
            active: false,
            count: _this.sources.length,
            source: _this.source
          });
        }
      };
    })(this));
    this.sources.push(source);
    if (this.sources[0] === source || ((_ref = this.sources[0]) != null ? _ref.isFallback : void 0)) {
      this.log.event("Promoting new source to active.", {
        source: (_ref1 = typeof source.TYPE === "function" ? source.TYPE() : void 0) != null ? _ref1 : source.TYPE
      });
      return this.useSource(source, cb);
    } else {
      this.log.event("Source connected.", {
        source: (_ref2 = typeof source.TYPE === "function" ? source.TYPE() : void 0) != null ? _ref2 : source.TYPE
      });
      this.emit("add_source", source);
      return typeof cb === "function" ? cb(null) : void 0;
    }
  };

  SourceMount.prototype._disconnectSource = function(source) {
    source.removeListener("data", this.dataFunc);
    return source.removeListener("vitals", this.vitalsFunc);
  };

  SourceMount.prototype.useSource = function(newsource, cb) {
    var alarm, old_source;
    old_source = this.source || null;
    alarm = setTimeout((function(_this) {
      return function() {
        var _ref, _ref1;
        _this.log.error("useSource failed to get switchover within five seconds.", {
          new_source: (_ref = typeof newsource.TYPE === "function" ? newsource.TYPE() : void 0) != null ? _ref : newsource.TYPE,
          old_source: (_ref1 = old_source != null ? typeof old_source.TYPE === "function" ? old_source.TYPE() : void 0 : void 0) != null ? _ref1 : old_source != null ? old_source.TYPE : void 0
        });
        return typeof cb === "function" ? cb(new Error("Failed to switch.")) : void 0;
      };
    })(this), 5000);
    return newsource.vitals((function(_this) {
      return function(err, vitals) {
        var _base, _ref, _ref1, _ref2;
        if (_this.source && old_source !== _this.source) {
          _this.log.event("Source changed while waiting for vitals.", {
            new_source: (_ref = typeof newsource.TYPE === "function" ? newsource.TYPE() : void 0) != null ? _ref : newsource.TYPE,
            old_source: (_ref1 = old_source != null ? typeof old_source.TYPE === "function" ? old_source.TYPE() : void 0 : void 0) != null ? _ref1 : old_source != null ? old_source.TYPE : void 0,
            current_source: (_ref2 = typeof (_base = _this.source).TYPE === "function" ? _base.TYPE() : void 0) != null ? _ref2 : _this.source.TYPE
          });
          return typeof cb === "function" ? cb(new Error("Source changed while waiting for vitals.")) : void 0;
        }
        if (old_source) {
          _this._disconnectSource(old_source);
        }
        _this.source = newsource;
        newsource.on("data", _this.dataFunc);
        newsource.on("vitals", _this.vitalsFunc);
        _this.emitDuration = vitals.emitDuration;
        process.nextTick(function() {
          var _ref3, _ref4;
          _this.log.event("New source is active.", {
            new_source: (_ref3 = typeof newsource.TYPE === "function" ? newsource.TYPE() : void 0) != null ? _ref3 : newsource.TYPE,
            old_source: (_ref4 = old_source != null ? typeof old_source.TYPE === "function" ? old_source.TYPE() : void 0 : void 0) != null ? _ref4 : old_source != null ? old_source.TYPE : void 0
          });
          _this.emit("source", newsource);
          return _this.vitalsFunc(vitals);
        });
        _this.sources = _.flatten([newsource, _(_this.sources).without(newsource)]);
        clearTimeout(alarm);
        return typeof cb === "function" ? cb(null) : void 0;
      };
    })(this));
  };

  SourceMount.prototype.promoteSource = function(uuid, cb) {
    var ns;
    if (ns = _(this.sources).find((function(_this) {
      return function(s) {
        return s.uuid === uuid;
      };
    })(this))) {
      if (ns === this.sources[0]) {
        return typeof cb === "function" ? cb(null, {
          msg: "Source is already active",
          uuid: uuid
        }) : void 0;
      } else {
        return this.useSource(ns, (function(_this) {
          return function(err) {
            if (err) {
              return typeof cb === "function" ? cb(err) : void 0;
            } else {
              return typeof cb === "function" ? cb(null, {
                msg: "Promoted source to active.",
                uuid: uuid
              }) : void 0;
            }
          };
        })(this));
      }
    } else {
      return typeof cb === "function" ? cb("Unable to find a source with that UUID on " + this.key) : void 0;
    }
  };

  SourceMount.prototype.dropSource = function(uuid, cb) {};

  SourceMount.prototype.destroy = function() {
    var s, _i, _len, _ref;
    _ref = this.sources;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      s = _ref[_i];
      s.disconnect();
    }
    this.emit("destroy");
    return this.removeAllListeners();
  };

  return SourceMount;

})(require("events").EventEmitter);

//# sourceMappingURL=source_mount.js.map
