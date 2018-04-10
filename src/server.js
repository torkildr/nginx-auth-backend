const express = require('express');
const session = require('express-session');
const fileStore = require('session-file-store')(session);
const morgan = require('morgan');
const vhost = require('vhost');

const auth = require('./googleAuth.js');
const authFrontend = require('./authFrontend.js');
const config = require('./config.js').load();

console.log(`routing: ${JSON.stringify(config.routing, null, 2)}`);

const server = express();
const backend = express();
const proxy = express();

server.use(morgan(':req[x-forwarded-for] [:date[clf]] :res[x-remote-user] :req[host] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
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
    domain: '.' + process.env.AUTH_DOMAIN_ROOT,
    path: '/',
    expires: new Date(Date.now() + (3600000 * 24 * 90))
  }
}));

server.use(auth.initialize(config, backend));
server.use(auth.session());

// only used for human navigation of auth domain
authFrontend.register(backend, auth);

// this is called when user is authenticated
auth.authenticated = (req, res, email) => {
  console.log(req.get('x-forwarded-for') + ': authenticated as ' + email);

  req.session.email = email;
  res.redirect(req.session.origin);
};

// setup proxy, check if user has session, if not, authenticate
proxy.use((req, res, next) => {
  const proxiedUrl = req.get('x-forwarded-proto') + '://' + req.get('host') + req.originalUrl;
  const authLog = msg => console.log(req.get('x-forwarded-for') + ': ' + msg);

  if (req.session.email) {
    const route = config.routing[req.get('host')];

    // unknown route / origin
    if (route === undefined) {
      console.log(req.get('x-forwarded-for') + ': could not route to ' + req.get('host'));
      res.redirect(backendUrl + '/routeError');
      return;
    }

    // unauthorized user
    if (config.allowed_email.indexOf(req.session.email) == -1) {
      authLog(req.session.email + ' not authorized for ' + req.get('host'));
      res.redirect(config.backend.url + '/unauthorized');
      return;
    }

    // at this point, the user is authenticated and authorized
    res.set('X-Authenticated-User', req.session.email);
    res.set('X-Reproxy-URL', route + req.originalUrl);
    res.set('X-Reproxy-Method', req.method);
    res.set('X-Accel-Redirect', '/reproxy');
    res.send();
  } else {
    authLog('auth required - ' + req.method + ' ' + proxiedUrl);
    req.session.origin = proxiedUrl;
    next();
  }
}, auth.authenticate);

// set up vhosts, auth backend for auth domain, proxy for everything else
server.use(vhost(process.env.AUTH_DOMAIN_BACKEND, backend));
server.use(vhost('*.' + process.env.AUTH_DOMAIN_ROOT, proxy));

console.log('server listening on port 80');
server.listen(80);

