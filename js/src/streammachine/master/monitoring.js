var Monitoring, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require("underscore");

module.exports = Monitoring = (function(_super) {
  __extends(Monitoring, _super);

  function Monitoring(master, log, opts) {
    this.master = master;
    this.log = log;
    this.opts = opts;
    this._streamInt = setInterval((function(_this) {
      return function() {
        var k, sm, _ref, _results;
        _ref = _this.master.source_mounts;
        _results = [];
        for (k in _ref) {
          sm = _ref[k];
          if (sm.opts.monitored) {
            _results.push(_this.master.alerts.update("sourceless", sm.key, sm.source == null));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      };
    })(this), 5 * 1000);
    if (this.master.slaves) {
      this._pollForSlaveSync();
    }
  }

  Monitoring.prototype.shutdown = function() {
    var _ref;
    if (this._streamInt) {
      clearInterval(this._streamInt);
    }
    if (this._slaveInt) {
      clearInterval(this._slaveInt);
    }
    return (_ref = this.master.slaves) != null ? _ref.removeListener("disconnect", this._dFunc) : void 0;
  };

  Monitoring.prototype._pollForSlaveSync = function() {
    this._dFunc = (function(_this) {
      return function(slave_id) {
        return setTimeout(function() {
          var k, _i, _len, _ref, _results;
          _ref = ["slave_unsynced", "slave_unresponsive"];
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            k = _ref[_i];
            _results.push(_this.master.alerts.update(k, slave_id, false));
          }
          return _results;
        }, 3000);
      };
    })(this);
    this.master.slaves.on("disconnect", this._dFunc);
    return this._slaveInt = setInterval((function(_this) {
      return function() {
        var mstatus;
        mstatus = _this.master._rewindStatus();
        return _this.master.slaves.pollForSync(function(err, statuses) {
          var key, mobj, mts, sobj, stat, sts, ts, unsynced, _i, _j, _len, _len1, _ref, _results;
          _results = [];
          for (_i = 0, _len = statuses.length; _i < _len; _i++) {
            stat = statuses[_i];
            if (stat.UNRESPONSIVE) {
              _this.master.alerts.update("slave_unresponsive", stat.id, true);
              break;
            }
            _this.master.alerts.update("slave_unresponsive", stat.id, false);
            unsynced = false;
            for (key in mstatus) {
              mobj = mstatus[key];
              if (sobj = stat.status[key]) {
                _ref = ["first_buffer_ts", "last_buffer_ts"];
                for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
                  ts = _ref[_j];
                  sts = Number(new Date(sobj[ts]));
                  mts = Number(mobj[ts]);
                  if ((_.isNaN(sts) && _.isNaN(mts)) || ((mts - 10 * 1000) < sts && sts < (mts + 10 * 1000))) {

                  } else {
                    _this.log.info("Slave " + stat.id + " sync unhealthy on " + key + ":" + ts, sts, mts);
                    unsynced = true;
                  }
                }
              } else {
                unsynced = true;
              }
            }
            _results.push(_this.master.alerts.update("slave_unsynced", stat.id, unsynced));
          }
          return _results;
        });
      };
    })(this), 10 * 1000);
  };

  return Monitoring;

})(require("events").EventEmitter);

//# sourceMappingURL=monitoring.js.map
