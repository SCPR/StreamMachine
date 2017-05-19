var Debounce, now;

now = function() {
  return Number(new Date());
};

module.exports = Debounce = (function() {
  function Debounce(wait, cb) {
    this.wait = wait;
    this.cb = cb;
    this.last = null;
    this.timeout = null;
    this._t = (function(_this) {
      return function() {
        var ago;
        ago = now() - _this.last;
        if (ago < _this.wait && ago >= 0) {
          return _this.timeout = setTimeout(_this._t, _this.wait - ago);
        } else {
          _this.timeout = null;
          return _this.cb(_this.last);
        }
      };
    })(this);
  }

  Debounce.prototype.ping = function() {
    this.last = now();
    if (!this.timeout) {
      this.timeout = setTimeout(this._t, this.wait);
    }
    return true;
  };

  Debounce.prototype.kill = function() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    return this.cb = null;
  };

  return Debounce;

})();

//# sourceMappingURL=debounce.js.map
