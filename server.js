const express = require("express");
const session = require("express-session");
const fileStore = require("session-file-store")(session);
const vhost = require("vhost");
const yaml = require("js-yaml");
const morgan = require('morgan');

const auth = require("./googleAuth.js");

const allVariables = [
  'AUTH_CONFIG',
  'AUTH_DOMAIN_ROOT',
  'AUTH_DOMAIN_BACKEND',
  'AUTH_DOMAIN_MAP',
].map((env) => {
  if (!process.env[env]) {
    console.error(`variable ${env} is not defined`);
    return false;
  }
  return true;
});

if (!allVariables.every(x => x)) {
  process.exit(-1);
}

const config = yaml.safeLoad(require("fs").readFileSync(process.env.AUTH_CONFIG));
config.backend = { url: `https://${process.env.AUTH_DOMAIN_BACKEND}` };

config.routing = JSON.parse(process.env.AUTH_DOMAIN_MAP);
console.log(`routing: ${JSON.stringify(config.routing, null, 2)}`);

const server = express();
const backend = express();
const proxy = express();

if (process.env.AUTH_DEBUG) {
    server.use(morgan('combined :req[upgrade]'));
}

server.use(session({
    secret: config.cookie.secret,
    store: new fileStore({
        path: '/sessions',
    }),
    proxy: true,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true,
        domain: "." + process.env.AUTH_DOMAIN_ROOT,
        path: "/",
        expires: new Date(Date.now() + (3600000 * 24 * 90))
    }
}));

server.use(auth.initialize(config, backend));
server.use(auth.session());

// convenience endpoints
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
auth.authenticated = (req, res, email) => {
    console.log(req.get("x-forwarded-for") + ": authenticated as " + email);

    req.session.email = email;
    res.redirect(req.session.origin);
};

// setup proxy, check if user has session, if not, authenticate
proxy.use((req, res, next) => {
    var proxiedUrl = req.get("x-forwarded-proto") + "://" + req.get("host") + req.originalUrl;

    if (req.session.email) {
        var route = config.routing[req.get("host")];

        // unknown route / origin
        if (route === undefined) {
            console.log(req.get("x-forwarded-for") + ": could not route to " + req.get("host"));
            res.redirect(backendUrl + "/routeError");
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
server.use(vhost(process.env.AUTH_DOMAIN_BACKEND, backend));
server.use(vhost("*." + process.env.AUTH_DOMAIN_ROOT, proxy));

console.log("server listening on port 80");
server.listen(80);

