const express = require('express');

exports.register = (backend, auth) => {
  backend.use(express.static(__dirname + "/public"));

  backend.get("/login", (req, res, next) => {
      req.session.origin = "/";
      next();
  }, auth.authenticate);

  backend.get("/status", (req, res) => {
      res.send(req.session.email);
  });

  backend.get("/logout", (req, res) => {
      req.session.destroy();
      res.redirect("/");
  });

  backend.use((req, res) => {
      res.sendStatus(200);
  });
}

