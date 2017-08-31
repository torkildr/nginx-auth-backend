var express = require("express");
var session = require("express-session");
var fileStore = require("session-file-store")(session);
var vhost = require("vhost");
var yaml = require("js-yaml");

var auth = require("./googleAuth.js");

var config = yaml.safeLoad(require("fs").readFileSync("config.yml"));

var server = express();
var backend = express();
var proxy = express();

config.backend.url = ((config.backend.https)?"https":"http")+"://"+config.backend.serverDomain;

server.use(session({
    secret: config.cookie.secret,
    store: new fileStore,
    proxy: true,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: config.backend.https,
        domain: "." + config.backend.domains,
        path: "/",
        expires: new Date(Date.now() + (3600000 * 24 * 90))
    }
}));

server.use(auth.initialize(config, backend));
server.use(auth.session());

backend.use(express.static(__dirname + "/public"));

backend.get("/login", function(req, res, next) {
    req.session.origin = "/";
    next();
}, auth.authenticate);

backend.get("/status", function(req, res) {
    res.send(req.session.email);
});

backend.get("/logout", function(req, res) {
    req.session.destroy();
    res.redirect("/");
});

backend.use(function(req, res) {
    res.sendStatus(200);
});

// this is called when user is authenticated
auth.authenticated = function(req, res, email) {
    console.log(req.get("x-forwarded-for") + ": authenticated as " + email);

    req.session.email = email;
    res.redirect(req.session.origin);
};

// setup proxy, check if user has session, if not, authenticate
proxy.use(function(req, res, next) {
    var proxiedUrl = req.get("x-forwarded-proto") + "://" + req.get("host") + req.originalUrl;

    if (req.session.email) {
        var route = config.routing[req.get("host")];

        // unknown route / origin
        if (route === undefined) {
            console.log(req.get("x-forwarded-for") + ": could not route to " + req.get("host"));
            res.redirect(config.backend.url + "/routeError");
            return;
        }

        // unauthorized user
        if (config.allowed_email.indexOf(req.session.email) == -1) {
            console.log(req.get("x-forwarded-for") + ": " + req.session.email + " not authorized for " + req.get("host"));
            res.redirect(config.backend.url + "/unauthorized");
            return;
        }

        // at this point, the user is authenticated and authorized
        console.log(req.get("x-forwarded-for") + " - " + req.session.email + " - " + req.method + " " + proxiedUrl);

        res.set("X-Remote-User", req.session.email);
        res.set("X-Reproxy-URL", route + req.originalUrl);
        res.set("X-Reproxy-Method", req.method);
        res.set("X-Accel-Redirect", "/reproxy");
        res.send();
    } else {
        console.log(req.get("x-forwarded-for") + ": auth required - " + req.method + " " + proxiedUrl);
        req.session.origin = proxiedUrl;
        next();
    }
}, auth.authenticate);

// set up vhosts, auth backend for auth domain, proxy for everything else
server.use(vhost(config.backend.serverDomain, backend));
server.use(vhost("*." + config.backend.domains, proxy));

console.log("server listening on port " + config.backend.port);
server.listen(config.backend.port, "127.0.0.1");

