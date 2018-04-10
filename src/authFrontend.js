const express = require('express');

exports.register = (backend, auth) => {
  backend.use(express.static(__dirname + "/public"));

  backend.get("/login", (req, res, next) => {
    req.session.origin = "/";
    next();
  }, auth.authenticate);

  backend.get("/status", (req, res) => {
    if (!req.session.email) {
      res.json({});
      return;
    }

    const { cookie, email, passport } = req.session;
    const photos = passport.user.photos.map(p => p.value);

    res.json({
      expires: cookie.expires,
      email: email,
      name: passport.user.displayName,
      photo: photos.length > 0 ? photos[0] : null,
    });
  });

  backend.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
  });

  backend.use((req, res) => {
    res.sendStatus(200);
  });
}

