var BaseStore,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

module.exports = BaseStore = (function(_super) {
  __extends(BaseStore, _super);

  function BaseStore() {}

  BaseStore.prototype.setMax = function(l) {
    this.max_length = l;
    return this._truncate();
  };

  BaseStore.prototype.length = function() {};

  BaseStore.prototype.at = function(i) {};

  BaseStore.prototype.insert = function(chunk) {};

  BaseStore.prototype.info = function() {};

  return BaseStore;

})(require("events").EventEmitter);

//# sourceMappingURL=base_store.js.map
