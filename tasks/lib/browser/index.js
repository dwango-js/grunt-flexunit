exports.init = function(grunt){
  'use strict';

  // The BaseBrowser() function is from Karma:

  // Karma
  // https://github.com/karma-runner/karma
  // Copyright (C) 2011-2013 Vojta Jína.
  // Released under the MIT License

  // https://github.com/karma-runner/karma/blob/master/lib/launchers/base.js


  var spawn = require('child_process').spawn;
  var path = require('path');
  var fs = require('fs');
  var os = require('os');
  var inherits = require('util').inherits;
  var EventEmitter = require('events').EventEmitter;

  var which = require('which').sync;
  var tmp = require('tmp');
  // cleanup files on exit
  tmp.setGracefulCleanup();
  var debug = require('debug')('grunt-fleunit:browser')

  var env = process.env;

  var PREPARED = 0;
  var STARTING = 1;
  var STARTED = 2;
  var BEING_KILLED = 3;
  var FINISHED = 4;
  var FAILED = 5;


  // class: BaseBrwoser
  // public methods:
  // * start
  // * kill
  // Events:
  // * error
  // * exit

  // BaseBrowser is not intended to be start()-ed twice!


  // BaseBrowser.state
  // This attribute indicates the state of browser process.
  // it can be PREPRED, STARTING, STARTED, BEING_KILLED, FINISHED and FAILED

  // PREPARED: Just instanciated: start() is yet to be called
  // STARTING: Start starting browser process: at the start of start()
  // STARTED: Browser started: set at the end of _execCommand()
  // BEING_KILLED: start trying to kill browser: at the start of kill()
  //     Will be Updated to FINISHED or FAILED by _onProcessExit()
  // FINISHED: browser process exitted with code 0
  // FAILED: Starting browser or the browser process itself failed with error.
  //     When being this state, this.error is not null and 'error' event emitted



  inherits(BaseBrowser, EventEmitter);
  function BaseBrowser(args){
    this.args = args || {};

    this.env = this.args.env || env;
    this.urls = this.args.urls || [];

    if (typeof this.args.useXvfb === 'undefined') {
      this.useXvfb = 'auto';
    } else {
      this.useXvfb = this.args.useXvfb
    }
    this.xvfbCmd = this.args.xvfbCmd || 'xvfb-run';
    this.xvfbArgs = this.args.xvfbArgs || ['-a'];
    // set when this._shouldUseXvfb is called
    this.xvfbFullpath = null;


    this.name = null;
    this.killTimeout = 2000;
    this.state = PREPARED;
    this.retryLimit = 3;
    this.errorOutput = '';
    this.error = null;
    // call this.ensureTmpdir to prepare temporary directory
    this._tmpDir = null;
  }


  // get options for browser process: this method can be overrided
  // Should refer to this.urls and return array for browser args
  // This method can throw error when no valid options can be generated
  BaseBrowser.prototype._getOptions = function(){
    return this.urls || [];
  };

  // By default start() just calls _start(). Any pre-start code can be
  // implemented by overriding this method.
  BaseBrowser.prototype.start = function(){
    this._start();
  };

  // some 'utility' methods: intended to be called from method of child classes
  BaseBrowser.prototype.ensureTmpDir = function(done){
    // tmpdir already made
    if (this._tmpDir) {
      process.nextTick(done);
      return;
    }

    var self = this;
    tmp.dir({
      prefix: 'grunt_flexunit.launcher.'
    }, function(err, path, cleanup){
      if (err) {
        done(err);
        return;
      }
      debug('Creating temp dir at ' + path);
      self._tmpDir = path;
      done();
    });
  };

  BaseBrowser.prototype.emitError = function(e){
    this.state = FAILED;
    this.error = e;
    this.emit('error', e);
  };


  // starting process

  BaseBrowser.prototype._start = function(){
    this.state = STARTING;
    var self = this;
    this.ensureTmpDir(function(err){
      if (err) {
        self.emitError(err);
        self.emit('exit');
        return;
      }

      try {
        self._execCommand(self._getCommand(), self._getOptions());
      } catch (e) {
        self.emitError(e);
        self.emit('exit');
      }
    });
  };

  BaseBrowser.prototype._getCommand = function(){
    var cmd = path.normalize(env[this.ENV_CMD] ||
                             this.DEFAULT_CMD[process.platform]);

    if (!cmd) {
      throw new Error('No binary for browser on your platform');
    }

    return cmd;
  };

  BaseBrowser.prototype._shouldUseXvfb = function(){
    if (this.useXvfb === 'no' || this.useXvfb === 'never') {
      return false;
    }

    // find fullpath of xvfb-run executable
    try {
      this.xvfbFullpath = which(this.xvfbCmd);
    } catch (e) {
      this.xvfbFullpath = null;
    }

    // if useXvfb is auto, return true when:
    // xvfb-run was found and
    // DISPLAY is not set
    if (this.useXvfb === 'auto') {
      return Boolean(this.xvfbFullpath && ! env.DISPLAY);
    }

    if (this.useXvfb === 'yes' || this.useXvfb === 'always') {
      if (! this.xvfbFullpath) {
        throw new Error('useXvfb was set to yes but xvfb-run not found');
      }
      return true;
    }

    throw new Error('invalid value for useXvfb: ' + this.useXvfb);
  };

  BaseBrowser.prototype._execCommand = function(cmd, args){
    var self = this;

    var spawnOptions = {
      cwd: undefined,
      env: this.env
    };
    debug(cmd + ' ' + args.join(' '));


    if (this._shouldUseXvfb()) {
      // use xvfb-run
      debug('Run browser with xvfb-run');
      this._process = spawn(this.xvfbFullpath,
                            [this.xvfbArgs].concat([cmd], args),
                            spawnOptions);
    } else {
      this._process = spawn(cmd, args, spawnOptions);
    }


    this._process.stderr.on('data', function(data){
      self.errorOutput += data.toString().trim() + '\n';
    });

    this._process.on('exit', function(code, signal){
      // code can be null (when _process.kill() is called?)
      self._onProcessExit(code || 0, signal);
    });

    this._process.on('error', function(err){
      if (err.code === 'ENOENT') {
        // cannot find the executable: exit event wont be emitted from
        // process
        self.emitError(new Error(
          'Can not find the binary ' + cmd + ': ' +
            'Please set env variable ' + self.ENV_CMD + ' appropriately'
        ));
        // exit immediately
        self.emit('exit', err.code);
      } else {
        // this happens when:
        // 1. cannot kill process
        // 2. cannot send messages to this process for some reasons
        // http://nodejs.jp/nodejs.org_ja/docs/v0.10/api/child_process.html#child_process_event_exit
        self.errorOutput += err.toString();
        self.emitError(err);
      }
    });

    this.state = STARTED;
  };



  // Called when process exit for some reasons
  // This method is called only when browser process once started: wont be
  // called if failed before starting browser process
  BaseBrowser.prototype._onProcessExit = function(code, signal){
    debug('Process %s exitted with code %d', this.name, code);

    if (this.state === BEING_KILLED) {
      debug('Killed: %s', this.name);
    }

    if (this.state === STARTED && code) {
      // retry only when this.state is STARTED and code is not 0 nor null,
      // which means that browser started once but unexpectedly crashed.
      debug('%s crashed: %s', this.name, this.errorOutput);
      this.retryLimit--;
      if (this.retryLimit > 0) {
        debug('Trying to start %s again.', this.name);
        this.errorOutput = '';
        this.start();
        return;
      }
    }

    this.state = FINISHED;
    if (code !== 0 && signal !== 'SIGTERM') {
      this.emitError(new Error(this.errorOutput));
    }

    this.emit('exit', code, signal);
  };



  // Kill process
  BaseBrowser.prototype.kill = function(){
    var self = this;

    if (this.state === FINISHED || this.state === FAILED ||
        this.state === BEING_KILLED) {
      // do nothing
    } else {
      this.state = BEING_KILLED;
      this._process.kill();
      setTimeout(function(){ self._onKillTimeout(); }, self.killTimeout);
    }
  };


  // Called when try to kill by calling this.kill() but timeouted
  // Try to kill by sending SIGKILL signal
  BaseBrowser.prototype._onKillTimeout = function(){
    if (this.state !== BEING_KILLED) {
      return;
    }

    debug('%s was not terminated in %d ms, sending SIGKILL.',
                     this.name, this.killTimeout);

    this._process.kill('SIGKILL');
  };


  exports.BaseBrowser = BaseBrowser;
  exports.Firefox = require('./firefox.js').init(BaseBrowser).Firefox;

  return exports;
};
