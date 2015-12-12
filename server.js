var express = require("express");
var session = require("express-session");
var vhost = require("vhost");

var passport = require("passport");
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

var yaml = require("js-yaml");
var config = yaml.safeLoad(require("fs").readFileSync("config.yml"));

console.log(config);

var port = config.auth_server.port;
var server = express();

server.use(session({
    secret: config.cookie.secret,
    proxy: true,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: config.auth_server.https,
        domain: "." + config.auth_server.domains,
        path: "/",
        expires: new Date(Date.now() + (3600000 * 24 * 30))
    }
}));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: config.google_oauth2.client_id,
    clientSecret: config.google_oauth2.secret,
    callbackURL: config.google_oauth2.callback
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));

var authCall = passport.authenticate('google', { scope: "email" });
var authCallback = passport.authenticate('google', { failureRedirect: '/login' });

var backend = express();

backend.use(express.static(__dirname + "/public"));

backend.get("/login", function(req, res) {
    req.session.origin = "/";
    authCall(req, res);
});

backend.get("/status", function(req, res) {
    res.send(req.session.email);
});

backend.get("/logout", function(req, res) {
    req.session.destroy();
    res.redirect("/");
});

backend.get("/auth/google/callback", authCallback, function(req, res) {
    var origin = req.session.origin;
    req.session.origin = null;

    console.log("authentication successful");
    console.log("redirecting to " + origin);
    
    req.session.email = req.session.passport.user.emails[0].value
    res.redirect(origin);
});

server.use(passport.initialize());
server.use(passport.session());

var webapp = express();

var isAuthorized = function(email) {
    return config.allowed_email.indexOf(email) != -1;
};

webapp.use(function(req, res, next) {

    if (req.session.email) {
        var route = config.routing[req.headers.host];

        if (route === undefined) {
            // fix, redirect to https/auth stuff
            res.redirect("/routeError");
            return;
        }

        // authorize
        if (!isAuthorized(req.session.email)) {
            res.redirect("/unauthorized");
            return;
        }

        var url = route + req.originalUrl;

        console.log("bypassing auth -> " + url);

        res.setHeader("X-Remote-User", req.session.email);
        res.setHeader("X-Reproxy-URL", url);
        res.setHeader("X-Accel-Redirect", "/reproxy");
        res.send();
    } else {
        console.log("authing");
        var proto = req.headers["x-forwarded-proto"];
        var fullUrl = proto + '://' + req.get('host') + req.originalUrl;
        req.session.origin = fullUrl;
        authCall(req, res, next);
    }
});

server.use(vhost(config.auth_server.serverDomain, backend));
server.use(vhost("*." + config.auth_server.domains, webapp));

console.log("server listening on port " + port);
server.listen(port);

