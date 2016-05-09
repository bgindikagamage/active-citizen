// https://gist.github.com/mojodna/1251812

var EmailWorker = function () {};

var log = require('../utils/logger');
var path = require('path');
var EmailTemplate = require('email-templates').EmailTemplate;
var nodemailer = require('nodemailer');
var ejs = require('ejs');
var i18n = require('../utils/i18n');
var toJson = require('../utils/to_json');

var templatesDir = path.resolve(__dirname, '..', 'email_templates', 'notifications');

var i18nFilter = function(text) {
  return i18n.t(text);
};

var transport = nodemailer.createTransport({
  service: 'sendgrid',
  auth: {
    user: process.env.SENDGRID_USERNAME,
    pass: process.env.SENDGRID_PASSWORD
  }
});

EmailWorker.prototype.sendOne = function (emailLocals, done) {
  try {
    var template = new EmailTemplate(path.join(templatesDir, emailLocals.template));

    emailLocals['t'] = i18nFilter;

    if (!emailLocals['community']) {
      emailLocals['community'] = { hostname: 'www' }
    }

    var fromEmail;

    if (emailLocals.domain.domain_name.indexOf('betrireykjavik.is') > -1) {
      fromEmail = 'betrireykjavik@ibuar.is';
    } else if (emailLocals.domain.domain_name.indexOf('betraisland.is') > -1) {
      fromEmail = 'betraisland@ibuar.is';
    } else {
      fromEmail = "admin@yrpri.org";
    }

    var locale;

    if (emailLocals.user.default_locale && emailLocals.user.default_locale != "") {
      locale = emailLocals.user.default_locale;
    } else if (emailLocals.community && emailLocals.community.default_locale && emailLocals.community.default_locale != "") {
      locale = emailLocals.community.default_locale;
    } else if (emailLocals.domain && emailLocals.domain.default_locale && emailLocals.domain.default_locale != "") {
      locale = emailLocals.domain.default_locale;
    } else {
      locale = 'en';
    }

    log.info("Selected locale", { locale: locale });

    i18n.changeLanguage(locale, function (err, t) {
      template.render(emailLocals, function (error, results) {
        if (error) {
          log.error('EmailWorker', { err: error, userID: emailLocals.user.id });
          done();
        } else {
          if (process.env.SENDGRID_USERNAME) {
            transport.sendMail({
              from: fromEmail, // emailLocals.community.admin_email,
              to: 'robert@citizens.is', // emailLocals.user.email,
              bcc: 'gunnar@ibuar.is',
              subject: emailLocals.subject,
              html: results.html,
              text: results.text
            }, function (error, responseStatus) {
              if (error) {
                log.error('EmailWorker', { err: error, user: emailLocals.user });
                done(error);
              } else {
                log.info('EmailWorker Completed', { responseStatusMessage: responseStatus.message, userId: emailLocals.user.id });
                done();
              }
            })
          } else {
            log.warn('EmailWorker no SMTP server', { subject: emailLocals.subject, userId: emailLocals.user.id, resultsHtml: results.html , resultsText: results.text });
            done();
          }
        }
      });
    });

  } catch (err) {
    log.error("Processing Email Error", {err: err});
    done();
  }
};

module.exports = new EmailWorker();
