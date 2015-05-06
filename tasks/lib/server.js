// server.js

// Setup flexunit-server and reporter with given options.
// done is called after all tests are done and results are written to output
// file.


// options should be an object with following attributes:

// port:
// host: port and host that flexunit server listen to
// reporter: Reporter name in string. Refer to flexunit-server for available
//           reporters
// output: Filename in string to write result that reporter generates.
//         null to discard it.

var fs = require('fs');
var path = require('path');
var stream = require('stream');

var fuserver = require('flexunit-server');

exports.init = function(grunt){
  'use strict';

  exports.start = function(options, done) {
    options = options || {};
    done = done || function(){};

    var Reporter;
    Reporter = fuserver.reporter[options.reporter];

    if (! Reporter) {
      done(new Error('Unknown reporter'));
    }

    var reporter = new Reporter();
    var outputStream;

    if (options.output) {
      grunt.log.writeln('Write output result to ' + options.output);
      mkdirIfNotExistsSync(path.dirname(options.output));
      outputStream = fs.createWriteStream(options.output);
    } else {
      grunt.log.writeln('Write output result to stdout');
      outputStream = new stream.PassThrough();
      outputStream.on('data', function(data){
        grunt.log.write(data);
      });
    }

    reporter.pipe(outputStream);


    // server setup
    var host = options.host || undefined;
    var port = options.port || 0;
    var server = fuserver.createServer(reporter);
    server.on('close', function(){
      // Task successfully finished
      outputStream.on('finish', function(){
        done();
      });
      reporter.end();
    });
    server.on('error', function(e){
      if (e.code === 'EADDRINUSE' && port === 0) {
        grunt.log.debug('Port is in use. Retry with another port');
        setTimeout(function(){
          server.listen(0, host);
        }, 300);
      } else {
        reporter.end();
        done(e);
      }
    });
    server.listen(port, host);

    return server;
  };

  return exports;
};



// The original of mkdirIfNotExistsSync() function is from Karma:

// Karma
// https://github.com/karma-runner/karma
// Copyright (C) 2011-2013 Vojta Jína.
// Released under the MIT License

// https://github.com/karma-runner/karma/blob/master/lib/helper.js
function mkdirIfNotExistsSync(directory) {
  var stat;
  try {
    stat = fs.statSync(directory);
  } catch (e) {
    stat = null;
  }
  if (stat && stat.isDirectory()) {
    return;
  }

  mkdirIfNotExistsSync(path.dirname(directory));
  fs.mkdirSync(directory);
  return;
}

exports.mkdirIfNotExistsSync = mkdirIfNotExistsSync;
