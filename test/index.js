describe('grunt-flexunit', function() {

  var net = require('net');
  var fs = require('fs');

  var expect = require('chai').expect;
  var which = require('which').sync;
  var grunt = require('grunt');
  var lib = require('../tasks/lib').init(grunt);
  var rimraf = require('rimraf');

  var testURLs = ["http://info.dwango.co.jp"];

  describe('server', function(){

    it('should start and close server gracefully', function(done) {
      var server = lib.server.start({ port: 1024, reporter: "Raw" },
                                    function(){});
      server.on('close', function(){ done(); });
      server.close();
    });

    it('should start and close server gracefully2', function(done) {
      var server = lib.server.start({ port: 1024, reporter: "Raw" },
                                    done);
      server.close();
    });

    const TOKEN_END_OF_TEST_RUN = new Buffer('<endOfTestRun/>\x00');
    const ACK_END_OF_TEST_RUN = new Buffer('<endOfTestRunAck/>\x00');

    // More detailed tests are done in flexunit-server module itself,
    // so here just ensure that the server seems to be a flexunit-server
    it('should work as a flexunit-server', function(done) {
      var server = lib.server.start({port: 1024, reporter: "Raw"},
                                    function(){}
                                   );
      var client = net.connect(1024, '127.0.0.1');
      client.setEncoding('ascii');
      client.on('data', function(data){
        expect(data).to.equal(ACK_END_OF_TEST_RUN.toString());
        done();
      });
      client.write(TOKEN_END_OF_TEST_RUN);
    });

    const FIXTURE = __dirname + '/fixtures/';
    const EXPECTED = __dirname + '/expected/';
    const OUTPUT_DIR = __dirname + '/test_result';
    const OUTPUT_FILE = OUTPUT_DIR + '/a.xml';

    it('should make directory recursively', function(done){
      var path = OUTPUT_DIR + '/b';
      rimraf.sync(path);
      fs.stat(path, function(e){
        // ensure directory is not exists
        expect(e).to.instanceof(Error);
        expect(e.code).to.equal('ENOENT');
        lib.server.mkdirIfNotExistsSync(path);
        fs.stat(path, function(e, stats){
          expect(e).to.null;
          expect(stats.isDirectory()).to.true;
          done();
        });
      });
    });

    it('should output result to specified file in specified format', function(done){
      // FIXME: This variable is not used!
      var flexunitResult = fs.readFileSync(FIXTURE + 'flexunit_result.xml');
      var expectedOutputContent = fs.readFileSync(EXPECTED + 'output.xml',
                                                  'utf8');

      rimraf.sync(OUTPUT_DIR);
      var server = lib.server.start(
        {port: 1025, reporter: "Junit", output: OUTPUT_FILE},
        function(e){
          if (e) {
            throw e;
          }
          var outputContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
          expect(outputContent).to.equal(expectedOutputContent);
          done();
        }
      );

      // client connects and writes token of end-of-test immediately,
      // which causes the close of server
      var client = net.connect(1025, '127.0.0.1');
      client.setEncoding('utf8');
      client.write(TOKEN_END_OF_TEST_RUN);

    });

    it('should run two server at once by choosing ports randomly', function(done){
      var server1 = lib.server.start({reporter: 'Raw'}, function(){});
      server1.on('listening', function(){
        var server2 = lib.server.start({reporter: 'Raw'}, function(){});
        server2.on('listening', function(){
          server1.close(function(){
            server2.close(done);
          });
        });
      })
    });

  });

  describe('browser', function(){

    it('should fail to start firefox without DISPLAY env', function(done){
      // copy environment variables excluding DISPLAY
      var browserEnv = makeEnvWoDISPLAY();

      var firefox = new lib.browser.Firefox({
        urls: testURLs,
        env: browserEnv,
        useXvfb: 'no'
      });
      firefox.on('error', function(e){
        expect(e).is.instanceof(Error);
        // FAILED
        expect(firefox.state).to.equal(5);
        done();
      });

      // PREPARED
      expect(firefox.state).to.equal(0);
      expect(firefox._getOptions()).to.deep.equal(
        testURLs.concat(['-profile', firefox._tmpDir, '-no-remote'])
      );

      firefox.start();
    });

    it('should throw error with invalid useXvfb value', function(done){
      // copy environment variables excluding DISPLAY
      var browserEnv = makeEnvWoDISPLAY();

      var firefox = new lib.browser.Firefox({
        urls: testURLs,
        env: browserEnv,
        useXvfb: false
      });
      firefox.on('error', function(e){
        expect(e).is.instanceof(Error);
        // FAILED
        expect(firefox.state).to.equal(5);
        done();
      });

      firefox.start();
    });

    it('should try to spawn process $FIREFOX_BIN', function(done){
      this.timeout(1000);
      // Firefox object gets firefox name from FIREFOX_BIN of current
      // environment if exists
      process.env.FIREFOX_BIN = 'lslslsls';
      var browserEnv = makeEnvWoDISPLAY();
      var firefox = new lib.browser.Firefox({
        urls: testURLs,
        useXvfb: 'no'
      });
      firefox.on('error', function(e){
        expect(e).to.instanceof(Error);
        // FAILED
        expect(firefox.state).to.equal(5);
        delete process.env.FIREFOX_BIN;
        done();
      });

      expect(firefox._getCommand()).to.equal('lslslsls');

      firefox.start();
    });

    it('should fail to start firefox without urls', function(done){
      var firefox = new lib.browser.Firefox({
        useXvfb: 'no'
      });
      firefox.on('error', function(e){
        expect(e).to.instanceof(Error);
        expect(firefox.state).to.equal(5);
        done();
      });

      firefox.start();
    });

    if (safeWhich('xvfb-run')) {
      // test only if xvfb-run is found
      it('should try to spawn firefox with xvfb-run', function(done){
        var browserEnv = makeEnvWoDISPLAY();
        for (var key in process.env) {
          if (key !== 'DISPLAY') {
            browserEnv[key] = process.env[key];
          }
        }
        var firefox = new lib.browser.Firefox({
          urls: testURLs,
          useXvfb: 'yes',
          env: browserEnv
        });

        firefox.on('exit', function(code, signal){
          // FINISHED
          expect(firefox.state).to.equal(4);
          expect(code).to.equal(0);
          done();
        });

        firefox.start();

        // kill running firefox process after 0.5 secs
        setTimeout(function(){
          expect(firefox.error).to.be.null;
          // STARTED
          expect(firefox.state).to.equal(2);
          firefox.kill();
        }, 500);
      });
    }

  });


  function makeEnvWoDISPLAY(){
    var e = {};
    for (var key in process.env) {
      if (key !== 'DISPLAY') {
        e[key] = process.env[key];
      }
    }
    return e;
  }

  function safeWhich(cmd){
    try {
      return which(cmd);
    } catch (e) {
      return null;
    }
  }

});
