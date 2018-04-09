var passport = require("passport");
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

var callbackUrl = "/auth/google/callback";

var createStrategy = function(config) {
    return new GoogleStrategy({
        clientID: config.google_oauth2.client_id,
        clientSecret: config.google_oauth2.secret,
        callbackURL: config.backend.url + callbackUrl
      },
      function(accessToken, refreshToken, profile, done) {
        return done(null, profile);
      }
    );
};

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

exports.authenticate = passport.authenticate("google", { scope: "email" });
exports.authenticated = () => {};

exports.initialize = function(config, backend) {
    passport.use(createStrategy(config));

    backend.get(callbackUrl, passport.authenticate("google", { failureRedirect: "/error" }), function(req, res) {
        var googleEmail = req.session.passport.user.emails[0].value;
        exports.authenticated(req, res, googleEmail);
    });

    return passport.initialize();
};

exports.session = function() {
    return passport.session();
}

