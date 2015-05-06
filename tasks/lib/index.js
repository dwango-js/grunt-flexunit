exports.init = function(grunt){
  'use strict';

  exports.server = require('./server.js').init(grunt);
  exports.browser = require('./browser').init(grunt);

  return exports;
};
