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
  self.ipaddress = '127.0.0.1';
  self.port      = process.env.PORT || 8080;

  /**
   *  terminator === the termination handler
   *  Terminate server on receipt of the specified signal.
   *  @param {string} sig  Signal to terminate on.
   */
  self.terminator = function(sig){
    if (typeof sig === "string") {
      console.log('%s: Received %s - terminating app ...', Date(Date.now()), sig);
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

    ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
     'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
    ].forEach(function(element, index, array) {
        process.on(element, function() { self.terminator(element); });
    });
  };

  /**
   *  Remove devices that are inactive
   */
  self.cullData = function(){
    console.log("Culling Data");
    var cutoff = (new Date()).getTime() - 21600000; // 6 hours
    Object.keys(data).forEach(function(group){
      Object.keys(data[group]).forEach(function(id){
        if(data[group][id].updated.getTime() < cutoff){
          delete data[group][id];
        }
      });
    });
  }
  
  var staticCache = {};
  var getStaticFile = function(file, cb){
    if(typeof staticCache[file] !== 'undefined') return cb(null, staticCache[file]);
    fs.readFile(file, function(err, f){
      if(err) return cb(err);
      staticCache[file] = f.toString('utf8')
      cb(null, staticCache[file]);
    })
  }


  /*  ================================================================  */
  /*  App server functions                                              */
  /*  ================================================================  */
  
  self.addAddress = function(req, res){
    // store IP address and name in hash under the address key
    if(typeof data[req.ip] === 'undefined') data[req.ip] = {};
    data[req.ip][req.query.id || req.query.name] = {name: req.query.name, updated: new Date(), address: req.query.address};
    res.send(200);
  }
  
  self.discover = function(req, res, format){
    var devices = [];
    var host = req.headers.host.split(':')[0];
    if(typeof data[req.ip] !== 'undefined'){
      Object.keys(data[req.ip]).forEach(function(id){
        var device = data[req.ip][id];
        device.id = id;
        devices.push(device);
      });
    }
    // Fetch all devices on this network
    if(format === 'html'){
      res.setHeader('Content-Type', 'text/html');
      getStaticFile('./static/' + host + '/index.html', (err, file) => {
        if(err){
          console.log(err);
          res.send(500);
        }else{
          res.send(ejs.render(file, {devices: devices}));
        }
      });
    }else if(format === 'json'){
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({devices: devices}));
    }
  }

  /**
   *  Initialize the server, create the routes and register the handlers.
   */
  self.initializeServer = function() {
    self.app = express();

    self.app.set('trust proxy', true);
    self.app.use(express.static('static/assets'));
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
    self.setupTerminationHandlers();

    // Create the express server and routes.
    self.initializeServer();
  };

  /**
   *  Start the server
   */
  self.start = function() {
    //  Start the app on the specific interface (and port).
    self.app.listen(self.port, function() {
      console.log('%s: Node server started on %s:%d ...', Date(Date.now() ), self.ipaddress, self.port);
    });
    setInterval(function(){ self.cullData() }, 3600000);
  };

};

// Start the app
var app = new DiscoveryApp();
app.initialize();
app.start();

