[![Build Status](https://travis-ci.org/dwango-js/grunt-flexunit.svg)](https://travis-ci.org/dwango-js/grunt-flexunit)


grunt-flexunit
==============


Grunt plugin for flexunit-server.



Additional Requisites
----------

In addition to npm module dependencies, following things are required to run
`grunt-flexunit`.

* Browser you want to use to open `swf` files

  Currently only `Firefox` is supported

* Flash Player plugin for the browser
* `xvfb-run` (optional: see doc of `options.useXvfb` for details)



The "flexunit" task
-------------------


### Overview ###

```js
grunt.initConfig({
    flexunit: {
        test: {
            options: {
                port: 0,
                host: '127.0.0.1',
                reporter: 'Junit',
                output: 'a.xml',
                swfFiles: ['http://localhost/swf/player_zero/a.swf'],
                browser: 'Firefox'
            }
        }
    }
});
```

### Options


#### options.port

Type: `Int`
Default value: `0`

A int value of port to listen to, defaults to 0.
The value 0 is a bit special: in this case, server will choose ports randomly
and try and retry listening to them until it succeed to listen.


#### options.host

Type: `String`
Default value: `null`

A string value or `null` that is used as a hostname the server listen to.
If set to `null` accept connections directed to any address.


#### options.reporter

Type: `String`
Default value: `'Junit'`

A string value of reporter name to use.
See document of `flexunit-server` to find available reporters.


#### options.output

Type: `String`
Default: `null`

A string value of filename the reporter writes the result to.
Set to null to stdout result.


#### options.httpServerRoot

Type: `String`
Default: `process.cwd()`

A string of directory path which http server should use as a root.
By default it will be the current directory where grunt is run.



#### options.swfFiles

Type: `Array`
Default: `[]`

An Array of URLs of flexunit swf files to run.
Should be relative to `options.httpServerRoot`.



#### options.browser

Type: `String`
Default: `'Firefox'`

The browser to open `swfFiles`.


#### options.useXvfb

Type: `String`
Default: `'auto'`

Must be either `'auto'`, `'always'`, `'yes'`, `'never'`, `'no'`.

A string that decides whether the browser should be run within `xvfb-run`.

When this option is enabled `xvfb-run` command is required, which is usually
included in `xvfb` or `X Virtual FrameBuffer` package.
Flexunit can run in headless when this option is enabled.
When set to `'auto'`, use xvfb if
  * `$DISPLAY` is not set
  * `xvfb-run` is found




Port to Connect
---------------

As described above, the port number where flexunit-server listens will be
decided randomly when `0` is specified as a `port` option.  The port
flexunit-server actually listens will be told to swf files by appending
`ciport=<port>` parameter to the URLs, so the swf files should get this value
for example by means of `loaderInfo.paramters` object.
