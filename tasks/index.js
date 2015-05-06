module.exports = function(grunt) {
  'use strict';
  var nodeStatic = require('node-static');
  var async = require('async');
  var path = require('path');
  var http = require('http');

  var lib = require('./lib/').init(grunt);

  grunt.registerMultiTask('flexunit', 'Start flexunit-server and open flexunit', function(){
    var done = this.async();
    var options = this.options({
      // options for flexunit server
      port: 0,
      host: null,
      reporter: "Junit",
      output: null,
      // options for http server
      httpServerRoot: process.cwd(),
      // options for browser
      swfFiles: [],
      browser: "Firefox",
      useXvfb: 'auto'     // or 'always', 'yes', 'never', 'no'
    });


    var Browser = lib.browser[options.browser];
    // If browser not found, exit immediately
    if (! Browser) {
      grunt.log.error('Invalid browser: ' + options.browser);
      process.nextTick(function(){
        done(new Error("Invalid browser: " + options.browser));
      });
      return;
    }
    var browser;
    var browserError = null;

    // done() is called within server.start(). Inside server.start, this
    // function is called when the reporter emitted 'end' event, and it is
    // set to be fired when the server emitted 'close' event.
    // Usually, the server closes when it recieved `end_of_test_run` token.
    // However, below the server is set to be closed when browser object
    // emitted 'error' event.
    // Totally, 'closing' will be happen in the order as:
    // Normally:
    //   flexunit -> server -> reporter -> browser, grunt
    // Browser Error:
    //   browser -> server -> reporter -> browser, grunt
    // In this situation browser will be killed twice but it is not a problem
    var flexUnitServer = lib.server.start({
      port: options.port,
      host: options.host,
      reporter: options.reporter,
      output: options.output
    }, function(e){
      // if error is passed from server, return as it is,
      // otherwise refer to the error object of browser process
      grunt.log.writeln('Terminating ' + options.browser);
      browser.kill();
      httpServer.close();
      done(e || browserError);
    });
    flexUnitServer.on('connection', function(){
      grunt.log.writeln('Flexunit CIListner connected');
    });

    var staticServer = new nodeStatic.Server(options.httpServerRoot);
    var httpServer = http.createServer(function(request, response){
      request.addListener('end', function(){
        staticServer.serve(request, response);
      }).resume();
    });

    async.series([function(done){
      flexUnitServer.on('listening', function(){
        done();
      });

    }, function(done){
      httpServer.listen(0, '0.0.0.0', function(){
        done();
      });

    }, function(done){
      // after starting server, setup browser

      var ciPort = flexUnitServer.address().port;
      grunt.log.writeln('Flexunit Server listen on %d', ciPort);
      var httpPort = httpServer.address().port;
      grunt.log.writeln('HTTP Server listen on %d', httpPort);

      var urls = options.swfFiles.map(function(elem, idx, self){
        if (elem[0] === '/') {
          // If elem is absolute path make it relative from
          // root path of http server
          // Possible that it cannot detect absolute path on windows!
          // If using node v0.11 using path.isAbsolute is better
          elem = path.relative(options.httpServerRoot, elem);
        }
        return 'http://127.0.0.1:' + httpPort.toString() + '/' +
          elem + '?ciport=' + ciPort.toString();
      });
      grunt.log.writeln('Opening ' + urls.toString());

      browser = new Browser({
        urls: urls,
        useXvfb: options.useXvfb
      });

      // if running browser fails, close server. it causes closing reporter
      // causing call of done()
      browser.on('error', function(e){
        browserError = e;
        flexUnitServer.close();
      });

      browser.start();
      done();
    }]);

  });

};
