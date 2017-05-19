var FakeAdServer, debug, express, fs,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

express = require("express");

debug = require("debug")("sm:util:fake_ad_server");

fs = require("fs");

module.exports = FakeAdServer = (function(_super) {
  __extends(FakeAdServer, _super);

  function FakeAdServer(port, template, cb) {
    var s, xmldoc;
    this.port = port;
    this.template = template;
    xmldoc = "";
    debug("Template is " + this.template);
    s = fs.createReadStream(this.template);
    s.on("readable", (function(_this) {
      return function() {
        var r, _results;
        _results = [];
        while (r = s.read()) {
          _results.push(xmldoc += r);
        }
        return _results;
      };
    })(this));
    s.once("end", (function(_this) {
      return function() {
        debug("Template read complete");
        _this.counter = 0;
        _this.app = express();
        _this.app.get("/impression", function(req, res) {
          var req_id;
          req_id = req.query["req_id"];
          _this.emit("impression", req_id);
          return res.status(200).end("");
        });
        _this.app.get("/ad", function(req, res) {
          var ad, req_id;
          req_id = _this.counter;
          _this.counter += 1;
          ad = xmldoc.replace("IMPRESSION", "http://127.0.0.1:" + _this.port + "/impression?req_id=" + req_id);
          _this.emit("ad", req_id);
          return res.status(200).type("text/xml").end(ad);
        });
        s = _this.app.listen(_this.port);
        if (_this.port === 0) {
          _this.port = s.address().port;
        }
        debug("Setup complete");
        return typeof cb === "function" ? cb(null, _this) : void 0;
      };
    })(this));
  }

  return FakeAdServer;

})(require("events").EventEmitter);

//# sourceMappingURL=fake_ad_server.js.map
