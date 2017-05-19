var ALERT_TYPES, Alerts, nconf, nodemailer, pagerduty, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

nconf = require("nconf");

_ = require("underscore");

nodemailer = require("nodemailer");

pagerduty = require("pagerduty");

ALERT_TYPES = {
  sourceless: {
    description: "A monitored stream has lost its only source connection.",
    wait_for: 30
  },
  slave_disconnected: {
    description: "A slave server has lost its connection to the master server.",
    wait_for: 30
  },
  slave_unresponsive: {
    description: "A slave server has stopped responding to our status queries.",
    wait_for: 30
  },
  slave_unsynced: {
    description: "A slave server is out of sync with master.",
    wait_for: 30
  }
};

module.exports = Alerts = (function(_super) {
  __extends(Alerts, _super);

  function Alerts(opts) {
    this.opts = opts;
    this.logger = this.opts.logger;
    if (nconf.get("alerts:email")) {
      this.email = new Alerts.Email(this, nconf.get("alerts:email"));
    }
    if (nconf.get("alerts:pagerduty")) {
      this.pagerduty = new Alerts.PagerDuty(this, nconf.get("alerts:pagerduty"));
    }
    this._states = {};
  }

  Alerts.prototype.update = function(code, key, active) {
    var s;
    if (!ALERT_TYPES[code]) {
      console.log("Unknown alert type sent: " + code + " / " + key);
      return false;
    }
    if (!this._states[code]) {
      this._states[code] = {};
    }
    if (active) {
      if (s = this._states[code][key]) {
        s.last_seen_at = new Date;
        if (s.c_timeout) {
          clearTimeout(s.c_timeout);
        }
        delete s.c_timeout;
      } else {
        s = this._states[code][key] = {
          code: code,
          key: key,
          triggered_at: new Date,
          last_seen_at: new Date,
          alert_sent: false,
          a_timeout: null,
          c_timeout: null
        };
      }
      if (!s.alert_sent && !s.a_timeout) {
        return s.a_timeout = setTimeout((function(_this) {
          return function() {
            return _this._fireAlert(s);
          };
        })(this), ALERT_TYPES[code].wait_for * 1000);
      }
    } else {
      if (s = this._states[code][key]) {
        if (s.a_timeout) {
          clearTimeout(s.a_timeout);
        }
        delete s.a_timeout;
        if (s.alert_sent && !s.c_timeout) {
          return s.c_timeout = setTimeout((function(_this) {
            return function() {
              return _this._fireAllClear(s);
            };
          })(this), ALERT_TYPES[code].wait_for * 1000);
        } else {

        }
      } else {

      }
    }
  };

  Alerts.prototype._fireAlert = function(obj) {
    var alert;
    alert = {
      code: obj.code,
      key: obj.key,
      triggered_at: obj.triggered_at,
      description: ALERT_TYPES[obj.code].description
    };
    this.logger.alert("Alert: " + obj.key + " : " + alert.description, alert);
    this.emit("alert", alert);
    return obj.alert_sent = true;
  };

  Alerts.prototype._fireAllClear = function(obj) {
    var alert;
    alert = {
      code: obj.code,
      key: obj.key,
      triggered_at: obj.triggered_at,
      last_seen_at: obj.last_seen_at,
      description: ALERT_TYPES[obj.code].description
    };
    this.logger.alert("Alert Cleared: " + obj.key + " : " + alert.description, alert);
    this.emit("alert_cleared", alert);
    return delete this._states[obj.code][obj.key];
  };

  Alerts.Email = (function() {
    function Email(alerts, opts) {
      this.alerts = alerts;
      this.opts = opts;
      this.transport = nodemailer.createTransport(this.opts.mailer_type, this.opts.mailer_options);
      this.alerts.on("alert", (function(_this) {
        return function(msg) {
          return _this._sendAlert(msg);
        };
      })(this));
      this.alerts.on("alert_cleared", (function(_this) {
        return function(msg) {
          return _this._sendAllClear(msg);
        };
      })(this));
    }

    Email.prototype._sendAlert = function(msg) {
      var email;
      email = _.extend({}, this.opts.email_options, {
        subject: "[StreamMachine/" + msg.key + "] " + msg.code + " Alert",
        generateTextFromHTML: true,
        html: "<p>StreamMachine has detected an alert condition of <b>" + msg.code + "</b> for <b>" + msg.key + "</b>.</p>\n\n<p>" + msg.description + "</p>\n\n<p>Condition was first detected at <b>" + msg.triggered_at + "</b>.</p>"
      });
      return this.transport.sendMail(email, (function(_this) {
        return function(err, resp) {
          if (err) {
            _this.alerts.logger.error("Error sending alert email: " + err, {
              error: err
            });
            return false;
          }
          return _this.alerts.logger.debug("Alert email sent to " + email.to + ".", {
            code: msg.code,
            key: msg.key
          });
        };
      })(this));
    };

    Email.prototype._sendAllClear = function(msg) {
      var email;
      email = _.extend({}, this.opts.email_options, {
        subject: "[StreamMachine/" + msg.key + "] " + msg.code + " Cleared",
        generateTextFromHTML: true,
        html: "<p>StreamMachine has cleared an alert condition of <b>" + msg.code + "</b> for <b>" + msg.key + "</b>.</p>\n\n<p>" + msg.description + "</p>\n\n<p>Condition was first detected at <b>" + msg.triggered_at + "</b>.</p>\n\n<p>Condition was last seen at <b>" + msg.last_seen_at + "</b>.</p>"
      });
      return this.transport.sendMail(email, (function(_this) {
        return function(err, resp) {
          if (err) {
            _this.alerts.logger.error("Error sending all clear email: " + err, {
              error: err
            });
            return false;
          }
          return _this.alerts.logger.debug("All clear email sent to " + email.to + ".", {
            code: msg.code,
            key: msg.key
          });
        };
      })(this));
    };

    return Email;

  })();

  Alerts.PagerDuty = (function() {
    function PagerDuty(alerts, opts) {
      this.alerts = alerts;
      this.opts = opts;
      this.pager = new pagerduty({
        serviceKey: this.opts.serviceKey
      });
      this.incidentKeys = {};
      this.alerts.on("alert", (function(_this) {
        return function(msg) {
          return _this._sendAlert(msg);
        };
      })(this));
      this.alerts.on("alert_cleared", (function(_this) {
        return function(msg) {
          return _this._sendAllClear(msg);
        };
      })(this));
    }

    PagerDuty.prototype._sendAlert = function(msg) {
      var details;
      details = this._details(msg);
      this.alerts.logger.debug("Sending alert to PagerDuty.", {
        details: details
      });
      return this.pager.create({
        description: "[StreamMachine/" + msg.key + "] " + msg.code + " Alert",
        details: details,
        callback: (function(_this) {
          return function(error, response) {
            if (response.incident_key) {
              _this.incidentKeys[details.key] = response.incident_key;
            } else {
              _this.alerts.logger.error("PagerDuty response did not include an incident key.", {
                response: response,
                error: error
              });
            }
            return _this._logResponse(error, response, "Alert sent to PagerDuty.", msg);
          };
        })(this)
      });
    };

    PagerDuty.prototype._sendAllClear = function(msg) {
      var details;
      details = this._details(msg);
      this.alerts.logger.debug("Sending allClear to PagerDuty.", {
        details: details
      });
      if (this.incidentKeys[details.key]) {
        return this.pager.resolve({
          incidentKey: this.incidentKeys[details.key],
          description: "[StreamMachine/" + msg.key + "] " + msg.code + " Cleared",
          details: details,
          callback: (function(_this) {
            return function(error, response) {
              delete _this.incidentKeys[details.key];
              return _this._logResponse(error, response, "Alert marked as Resolved in PagerDuty.", msg);
            };
          })(this)
        });
      } else {
        return this.alerts.logger.error("Could not send allClear to PagerDuty. No incident key in system.", {
          keys: this.incidentKeys
        });
      }
    };

    PagerDuty.prototype._details = function(msg) {
      return {
        via: "StreamMachine Alerts",
        code: msg.code,
        description: msg.description,
        key: "" + msg.code + "/" + msg.key
      };
    };

    PagerDuty.prototype._logResponse = function(error, response, logText, msg) {
      if (error) {
        return this.alerts.logger.error("Error sending alert to PagerDuty: " + error, {
          error: error
        });
      } else {
        return this.alerts.logger.debug(logText, {
          code: msg.code,
          key: msg.key
        });
      }
    };

    return PagerDuty;

  })();

  return Alerts;

})(require("events").EventEmitter);

//# sourceMappingURL=alerts.js.map
