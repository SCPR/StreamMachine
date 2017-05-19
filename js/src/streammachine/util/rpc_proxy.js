var RPCProxy,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

module.exports = RPCProxy = (function(_super) {
  __extends(RPCProxy, _super);

  function RPCProxy(a, b) {
    this.a = a;
    this.b = b;
    this.messages = [];
    this._aFunc = (function(_this) {
      return function(msg, handle) {
        _this.messages.push({
          sender: "a",
          msg: msg,
          handle: handle != null
        });
        _this.b.send(msg, handle);
        if (msg.err) {
          return _this.emit("error", msg);
        }
      };
    })(this);
    this._bFunc = (function(_this) {
      return function(msg, handle) {
        _this.messages.push({
          sender: "b",
          msg: msg,
          handle: handle != null
        });
        _this.a.send(msg, handle);
        if (msg.err) {
          return _this.emit("error", msg);
        }
      };
    })(this);
    this.a.on("message", this._aFunc);
    this.b.on("message", this._bFunc);
  }

  RPCProxy.prototype.disconnect = function() {
    this.a.removeListener("message", this._aFunc);
    return this.b.removeListener("message", this._bFunc);
  };

  return RPCProxy;

})(require("events").EventEmitter);

//# sourceMappingURL=rpc_proxy.js.map
