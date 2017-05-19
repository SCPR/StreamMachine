var Core,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

module.exports = Core = (function(_super) {
  __extends(Core, _super);

  function Core() {
    this.log.debug("Attaching listener for SIGUSR2 restarts.");
    if (process.listeners("SIGUSR2").length > 0) {
      this.log.info("Skipping SIGUSR2 registration for handoffs since another listener is registered.");
    } else {
      process.on("SIGUSR2", (function(_this) {
        return function() {
          if (_this._restarting) {
            return false;
          }
          _this._restarting = true;
          if (!_this._rpc) {
            _this.log.error("StreamMachine process was asked for external handoff, but there is no RPC interface");
            _this._restarting = false;
            return false;
          }
          _this.log.info("Sending process for USR2. Starting handoff via proxy.");
          return _this._rpc.request("HANDOFF_GO", null, null, {
            timeout: 20000
          }, function(err, reply) {
            if (err) {
              _this.log.error("Error handshaking handoff: " + err);
              _this._restarting = false;
              return false;
            }
            _this.log.info("Sender got handoff handshake. Starting send.");
            return _this._sendHandoff(_this._rpc);
          });
        };
      })(this));
    }
  }

  Core.prototype.streamInfo = function() {
    var k, s, _ref, _results;
    _ref = this.streams;
    _results = [];
    for (k in _ref) {
      s = _ref[k];
      _results.push(s.info());
    }
    return _results;
  };

  return Core;

})(require("events").EventEmitter);

//# sourceMappingURL=base.js.map
