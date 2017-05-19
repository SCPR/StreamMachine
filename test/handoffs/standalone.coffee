# Testing handoffs in standalone mode means testing both master and slave
# functionality. We want a) rewind buffers to transfer, b) sources to stay
# connected and c) listeners to stay connected.

debug = require("debug")("sm:tests:handoffs:standalone")

StandaloneMode = $src "modes/standalone"

IcecastSource   = $src "util/icecast_source"
StreamListener  = $src "util/stream_listener"

RPC             = require "ipc-rpc"
RPCProxy        = $src "util/rpc_proxy"

cp  = require "child_process"

STREAM1 =
    key:                "test1"
    source_password:    "abc123"
    root_route:         true
    seconds:            60*60*4
    format:             "mp3"

mp3 = $file "mp3/mp3-44100-128-s.mp3"

standalone_config = [
    "--mode=standalone"
    "--port=0",
    "--source_port=0",
    "--api_port=0",
    "--no-log:stdout"
    "--chunk_duration:0.1"
]

describe "Standalone Handoffs", ->
    s1      = null
    s1rpc   = null
    s2      = null
    s2rpc   = null

    main_port   = null
    source_port = null
    api_port    = null

    ice_source  = null
    listener    = null

    after (done) ->
        s1?.kill()
        s2?.kill()
        done()

    describe "Initial Process", ->
        before (done) ->
            this.timeout 10000
            s1 = cp.fork "./index.js", standalone_config

            new RPC s1, (err,r) ->
                s1rpc = r

                debug "Starting loop for s1 OK"

                tries = 0

                okF = ->
                    tries += 1
                    s1rpc.request "OK", null, null, timeout:500, (err,msg) ->
                        if err
                            debug "s1 OK error. Tries: #{tries}"
                            okF() if tries < 20
                        else
                            debug "s1 OK success after #{tries} tries"
                            done()

                okF()

        it "is listening on a main port", (done) ->
            s1rpc.request "standalone_port", (err,port) ->
                throw err if err
                main_port = port
                expect(port).to.be.number
                done()

        it "is listening on a source port", (done) ->
            s1rpc.request "source_port", (err,port) ->
                source_port = port
                expect(source_port).to.be.number
                done()


        it "is listening on an API port", (done) ->
            s1rpc.request "api_port", (err,port) ->
                api_port = port
                expect(api_port).to.be.number
                done()

        it "is configured with our test stream", (done) ->
            config = streams:{}
            config.streams[ STREAM1.key ] = STREAM1
            s1rpc.request "config", config, (err,rconfig) ->
                throw err if err
                expect(rconfig.streams).to.have.key STREAM1.key
                done()

        it "can accept a source connection", (done) ->
            ice_source = new IcecastSource
                format:     "mp3"
                filePath:   mp3
                host:       "127.0.0.1"
                port:       source_port
                password:   STREAM1.source_password
                stream:     STREAM1.key

            ice_source.start (err) ->
                throw err if err
                done()

        it "can accept a listener connection", (done) ->
            this.timeout 5000
            debug "Connecting listener to 127.0.0.1:#{main_port}/#{STREAM1.key}"
            listener = new StreamListener "127.0.0.1", main_port, STREAM1.key

            listener.connect 1500, (err) =>
                throw err if err

                debug "listener connected"

                listener.once "bytes", ->
                    debug "listener got bytes"
                    done()

    describe "Handoff Process", ->
        s2config = null

        before (done) ->
            this.timeout 10000
            s2 = cp.fork "./index.js", ["--handoff",standalone_config...]

            s2rpc = new RPC s2, functions:
                config: (msg,handle,cb) ->
                    debug "got s2config of ", msg
                    s2config = msg
                    cb null, "OK"

            debug "Starting loop for s2 OK"

            tries = 0

            okF = ->
                tries += 1
                s2rpc.request "OK", null, null, timeout:500, (err,msg) ->
                    if err
                        debug "s2 OK error. Tries: #{tries}"
                        okF() if tries < 20
                    else
                        debug "s2 OK success after #{tries} tries"
                        done()

            okF()

        it "should not be listening on a main port", (done) ->
            s2rpc.request "standalone_port", (err,port) ->
                throw err if err
                expect(port).to.eql "NONE"
                done()

        it "should not be listening on a source port", (done) ->
            s2rpc.request "source_port", (err,port) ->
                throw err if err
                expect(port).to.eql "NONE"
                done()

        it "should not be listening on an API port", (done) ->
            s2rpc.request "api_port", (err,port) ->
                throw err if err
                expect(port).to.eql "NONE"
                done()

    describe "Handoff", ->
        proxy = null

        before (done) ->
            # we need to disconnect our listeners, and then attach our proxy
            # RPC to bind the two together
            s1rpc.disconnect()
            s2rpc.disconnect()

            proxy = new RPCProxy s1, s2
            done()

        it "should run a handoff and initial process should exit", (done) ->
            this.timeout 12000
            # we trigger the handoff by sending USR2 to s1
            s1.kill("SIGUSR2")

            proxy.on "error", (msg) =>
                err = new Error msg.error
                err.stack = msg.err_stack

                throw err

            t = setTimeout =>
                throw new Error "Initial master did not exit within 10 seconds."
            , 10000

            s1.on "exit", (code) =>
                expect(code).to.eql 0
                clearTimeout t

                proxy.disconnect()

                new RPC s2, (err,r) ->
                    s2rpc = r
                    s2rpc.request "OK", (err,msg) ->
                        throw err if err
                        debug "s2rpc reconnected and got OK"
                        done()

        it "source should be connected to new process", (done) ->
            expect(ice_source._connected).to.eql true
            done()

        it "new process should show a connected listener", (done) ->
            s2rpc.request "status", (err,status) ->
                throw err if err
                expect(status.slave[STREAM1.key].listeners).to.eql 1
                done()

        it "listener should still receive data", (done) ->
            this.timeout 5000
            listener.once "bytes", ->
                done()

        it "new process should accept a new listener connection", (done) ->
            this.timeout 5000
            l2 = new StreamListener "127.0.0.1", main_port, STREAM1.key

            l2.connect 4500, (err) =>
                throw err if err

                l2.once "bytes", ->
                    done()
