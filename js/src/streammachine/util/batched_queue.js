var BatchedQueue, debug,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

debug = require("debug")("sm:util:batched_queue");

module.exports = BatchedQueue = (function(_super) {
  __extends(BatchedQueue, _super);

  function BatchedQueue(opts) {
    this.opts = opts != null ? opts : {};
    BatchedQueue.__super__.constructor.call(this, {
      objectMode: true
    });
    this._writableState.highWaterMark = this.opts.writable || 4096;
    this._readableState.highWaterMark = this.opts.readable || 1;
    this._size = this.opts.batch || 1000;
    this._latency = this.opts.latency || 200;
    debug("Setting up BatchedQueue with size of " + this._size + " and max latency of " + this._latency + "ms");
    this._queue = [];
    this._timer = null;
  }

  BatchedQueue.prototype._transform = function(obj, encoding, cb) {
    this._queue.push(obj);
    if (this._queue.length >= this._size) {
      debug("Calling writeQueue for batch size");
      return this._writeQueue(cb);
    }
    if (!this._timer) {
      this._timer = setTimeout((function(_this) {
        return function() {
          debug("Calling writeQueue after latency timeout");
          return _this._writeQueue();
        };
      })(this), this._latency);
    }
    return cb();
  };

  BatchedQueue.prototype._flush = function(cb) {
    return this._writeQueue(cb);
  };

  BatchedQueue.prototype._writeQueue = function(cb) {
    var batch;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    batch = this._queue.splice(0);
    debug("Writing batch of " + batch.length + " objects");
    if (batch.length > 0) {
      this.push(batch);
    }
    return typeof cb === "function" ? cb() : void 0;
  };

  return BatchedQueue;

})(require("stream").Transform);

//# sourceMappingURL=batched_queue.js.map
