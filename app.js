var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var session = require('express-session');
var dashboardRouter = require('./routes/dashboard');
var publicRouter = require('./routes/public');
const usersRouter = require("./routes/users");
var okta = require("@okta/okta-sdk-nodejs");
var ExpressOIDC = require("@okta/oidc-middleware").ExpressOIDC;
require("dotenv").config({ path: "variables.env" });

var app = express();

var token = process.env.OKTA_TOKEN;
var clientSecret = process.env.OKTA_CLIENTSECRET;
var clientID = process.env.OKTA_CLIENTID;
var redirectUri = process.env.OKTA_REDIRECTURI;
var oktaClient = new okta.Client({
  orgUrl: 'https://dev-614524.oktapreview.com',
  token: token
});

const oidc = new ExpressOIDC({
  issuer: "https://dev-614524.oktapreview.com/oauth2/default",
  client_id: clientID,
  client_secret: clientSecret,
  redirect_uri: redirectUri,
  scope: "openid profile",
  routes: {
    login: {
      path: "/users/login"
    },
    callback: {
      path: "/users/callback",
      defaultRedirect: "/dashboard"
    }
  }
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: false
}))

app.use(oidc.router);
app.use((req, res, next) => {
  if (!req.userinfo) {
    return next();
  }
 
  oktaClient.getUser(req.userinfo.sub)
    .then(user => {
      req.user = user;
      res.locals.user = user;
      next();
    }).catch(err => {
      next(err);
    });
});

app.use('/', publicRouter);
app.use('/dashboard',loginRequired, dashboardRouter);
app.use('/users', usersRouter);

function loginRequired(req, res, next) {
  if (!req.user) {
    return res.status(401).render("unauthenticated");
  }
 
  next();
}


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
