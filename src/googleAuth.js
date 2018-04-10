const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

const callbackUrl = '/auth/google/callback';

const createStrategy = (config) =>
  new GoogleStrategy({
    clientID: config.google_oauth2.client_id,
    clientSecret: config.google_oauth2.secret,
    callbackURL: config.backend.url + callbackUrl
  },
  (accessToken, refreshToken, profile, done) =>
    done(null, profile)
  );

passport.serializeUser((user, done) =>
  done(null, user));

passport.deserializeUser((user, done) =>
  done(null, user));

exports.authenticate = passport.authenticate('google', { scope: 'email' });
exports.authenticated = () => {};

exports.initialize = (config, backend) => {
    passport.use(createStrategy(config));
    const callbackHandle = passport.authenticate('google', { failureRedirect: '/' });

    backend.get(callbackUrl, callbackHandle, (req, res) => {
        const googleEmail = req.session.passport.user.emails[0].value;
        exports.authenticated(req, res, googleEmail);
    });

    return passport.initialize();
};

exports.session = () => {
    return passport.session();
}

