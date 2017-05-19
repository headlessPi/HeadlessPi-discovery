#!/usr/bin/env node

var express = require('express');
var fs      = require('fs');
var ejs     = require('ejs');
var cors    = require('cors');

var DiscoveryApp = function() {
  var self = this;
  var data = {};

  /*  ================================================================  */
  /*  Helper functions.                                                 */
  /*  ================================================================  */

  /**
   *  Set up server IP address and port # using env variables/defaults.
   */
  self.setupVariables = function() {
    //  Set the environment variables we need.
    self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
    self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

    if (typeof self.ipaddress === "undefined") {
      //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
      //  allows us to run/test the app locally.
      console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
      self.ipaddress = "127.0.0.1";
    };
  };

  /**
   *  Populate the cache.
   */
  self.populateCache = function() {
    //  Local cache for static content.
    self.indexPage = fs.readFileSync('./index.html').toString('utf8');
  };

  /**
   *  terminator === the termination handler
   *  Terminate server on receipt of the specified signal.
   *  @param {string} sig  Signal to terminate on.
   */
  self.terminator = function(sig){
    if (typeof sig === "string") {
      console.log('%s: Received %s - terminating sample app ...', Date(Date.now()), sig);
      process.exit(1);
    }
    console.log('%s: Node server stopped.', Date(Date.now()) );
  };

  /**
   *  Setup termination handlers (for exit and a list of signals).
   */
  self.setupTerminationHandlers = function(){
    //  Process on exit and signals.
    process.on('exit', function() { self.terminator(); });

    // Removed 'SIGPIPE' from the list - bugz 852598.
    ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
     'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
    ].forEach(function(element, index, array) {
        process.on(element, function() { self.terminator(element); });
    });
  };


  /*  ================================================================  */
  /*  App server functions                                              */
  /*  ================================================================  */
  
  self.addAddress = function(req, res){
    // store IP address and name in hash under the address key
    if(typeof data[req.ip] === 'undefined') data[req.ip] = {};
    data[req.ip][req.query.id] = {name: req.query.name, updated: new Date(), address: req.query.address};
    res.sendStatus(200);
  }
  
  self.discover = function(req, res, format){
    var devices = [];
    Object.keys(data[req.ip]).forEach((id) => {
      var device = data[req.ip][id];
      device.id = id;
      devices.push(device);
    });
    // Fetch all devices on this network
    if(format === 'html'){
      res.setHeader('Content-Type', 'text/html');
      res.send(ejs.render(self.indexPage, {devices: devices}));
    }else if(format === 'json'){
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({devices: data}));
    }
  }

  /**
   *  Initialize the server, create the routes and register the handlers.
   */
  self.initializeServer = function() {
    self.app = express();

    self.app.set('trust proxy', true);
    self.app.use(express.static('assets'));
    self.app.use(cors());

    //  Add handlers for the app (from the routes).
    self.app.post('/', function(req, res){ self.addAddress(req, res)});
    self.app.get('/', function(req, res){ self.discover(req, res, 'html')});
    self.app.get('/devices.json', function(req, res){ self.discover(req, res, 'json')});
  };


  /**
   *  Initializes the application.
   */
  self.initialize = function() {
    self.setupVariables();
    self.populateCache();
    self.setupTerminationHandlers();

    // Create the express server and routes.
    self.initializeServer();
  };


  /**
   *  Start the server
   */
  self.start = function() {
    //  Start the app on the specific interface (and port).
    self.app.listen(self.port, self.ipaddress, function() {
      console.log('%s: Node server started on %s:%d ...', Date(Date.now() ), self.ipaddress, self.port);
    });
  };

};

// Start the app
var app = new DiscoveryApp();
app.initialize();
app.start();

