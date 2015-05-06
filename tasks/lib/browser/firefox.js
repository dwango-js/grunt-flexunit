exports.init = function(BaseBrowser){

  // Functions defined here are from karma-firefox-launcher

  // karma-firefox-launcher
  // https://github.com/karma-runner/karma-firefox-launcher
  // Copyright (C) 2011-2013 Google, Inc.
  // Released under the MIT License

  var fs = require('fs');
  var spawn = require('child_process').spawn;
  var inherits = require('util').inherits;

  var PREFS_DEFAULT = [
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.bookmarks.restore_default_bookmarks", false);',
    'user_pref("dom.disable_open_during_load", false);',
    'user_pref("dom.max_script_run_time", 0);'
  ];


  // Return location of firefox.exe file for a given Firefox directory
  // (available: "Mozilla Firefox", "Aurora", "Nightly").
  function getFirefoxExe(firefoxDirName){
    if (process.platform !== 'win32') {
      return null;
    }


    var prefix;
    var prefixes = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']];
    var suffix = '\\'+ firefoxDirName + '\\firefox.exe';

    for (var i = 0; i < prefixes.length; i++) {
      prefix = prefixes[i];
      if (fs.existsSync(prefix + suffix)) {
        return prefix + suffix;
      }
    }

    return 'C:\\Program Files' + suffix;
  };


  /////////////////////////////////////////////
  // FirefoxBrowser
  // https://developer.mozilla.org/en-US/docs/Command_Line_Options
  function FirefoxBrowser(args){
    BaseBrowser.call(this, args);
    this.name = 'Firefox';
    this.DEFAULT_CMD = {
      linux: 'firefox',
      darwin: '/Applications/Firefox.app/Contents/MacOS/firefox-bin',
      win32: getFirefoxExe('Mozilla Firefox')
    };
    this.ENV_CMD = 'FIREFOX_BIN';

  }
  inherits(FirefoxBrowser, BaseBrowser);

  FirefoxBrowser.prototype.start = function(){
    var self = this;
    this.ensureTmpDir(function(){
      // prepare profile dir
      fs.writeFile(self._tmpDir + '/prefs.js',
                   self._getPrefs(self.args.prefs),
                   function(err){
                     if (err) {
                       self.emitError(err);
                       self.emit('exit');
                       return;
                     }
                     self._start()
                   });
    });
  };

  FirefoxBrowser.prototype._getPrefs = function(prefs){
    // Return pref in string
    if (typeof prefs !== 'object') {
      return PREFS_DEFAULT.join('\n') + '\n';
    }

    var results = PREFS_DEFAULT.concat();
    for (var key in prefs) {
      results.push('user_pref("' + key + '", ' +
                   JSON.stringify(prefs[key]) + ');');
    }
    return results.join('\n') + '\n';
  };

  FirefoxBrowser.prototype._getOptions = function(){
    if (this.urls.length === 0) {
      throw new Error('Firefox: No url to open given.');
    }
    return this.urls.concat(['-profile', this._tmpDir, '-no-remote']);
  };





  ///////////////////////////////////////////
  // FirefoxAuroraBrowser
  inherits(FirefoxAuroraBrowser, FirefoxBrowser);
  function FirefoxAuroraBrowser(){
    FirefoxBrowser.apply(this, arguments);
    this.name = 'FirefoxAurora';
    this.DEFAULT_CMD = {
      linux: 'firefox',
      darwin: '/Applications/FirefoxAurora.app/Contents/MacOS/firefox-bin',
      win32: getFirefoxExe('Aurora')
    };
    this.ENV_CMD = 'FIREFOX_AURORA_BIN';
  }


  ///////////////////////////////////////////////
  // FIrefoxNightlyBrowser
  inherits(FirefoxNightlyBrowser, FirefoxBrowser);
  function FirefoxNightlyBrowser(){
    FirefoxBrowser.apply(this, arguments);
    this.name = 'FirefoxNightly';
    this.DEFAULT_CMD = {
      linux: 'firefox',
      darwin: '/Applications/FirefoxNightly.app/Contents/MacOS/firefox-bin',
      win32: getFirefoxExe('Nightly')
    };
    this.ENV_CMD = 'FIREFOX_NIGHTLY_BIN';
  }



  exports.Firefox = FirefoxBrowser;
  exports.FirefoxAurora = FirefoxAuroraBrowser;
  exports.FirefoxNightly = FirefoxNightlyBrowser;

  return exports;
};
