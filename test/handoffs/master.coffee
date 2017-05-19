# Test handing off a populated rewind buffer and active source from one
# master to another, as we would during a graceful restart. Test that
# the new master is listening on the correct ports.

debug = require("debug")("sm:tests:handoffs:master")

MasterMode      = $src "modes/master"
IcecastSource   = $src "util/icecast_source"

RPC             = require "ipc-rpc"
RPCProxy        = $src "util/rpc_proxy"

cp  = require "child_process"
_   = require "underscore"

STREAM1 =
    key:                "test1"
    source_password:    "abc123"
    root_route:         true
    seconds:            60*60*4
    format:             "mp3"

mp3 = $file "mp3/mp3-44100-128-s.mp3"

master_config = [
    "--mode=master"
    "--master:port=0"
    "--source_port=0"
    "--no-log:stdout"
    "--chunk_duration=0.1"
]

#----------

describe "Master Handoffs", ->
    m1      = null
    m1rpc   = null
    m2      = null
    m2rpc   = null

    master_port = null
    source_port = null

    ice_source  = null

    after (done) ->
        m1?.kill()
        m2?.kill()
        done()

    describe "Initial Master", ->
        before (done) ->
            this.timeout 10000
            m1 = cp.fork "./index.js", master_config

            new RPC m1, (err,r) ->
                m1rpc = r

                debug "Starting loop for m1 OK"

                tries = 0

                okF = ->
                    tries += 1
                    m1rpc.request "OK", null, null, timeout:500, (err,msg) ->
                        if err
                            debug "m1 OK error. Tries: #{tries}"
                            okF() if tries < 20
                        else
                            debug "m1 OK success after #{tries} tries"
                            done()

                okF()

        it "is listening on a master port", (done) ->
            m1rpc.request "master_port", (err,port) ->
                throw err if err
                master_port = port
                expect(master_port).to.be.number
                done()


        it "is listening on a source port", (done) ->
            m1rpc.request "source_port", (err,port) ->
                source_port = port
                expect(source_port).to.be.number
                done()

        it "is configured with our test stream", (done) ->
            config = streams:{}
            config.streams[ STREAM1.key ] = STREAM1
            m1rpc.request "config", config, (err,rconfig) ->
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

    describe "New Master", ->
        m2config = null

        before (done) ->
            this.timeout 10000
            m2 = cp.fork "./index.js", ["--handoff",master_config...]

            m2rpc = new RPC m2, functions:
                config: (msg,handle,cb) ->
                    debug "got m2config of ", msg
                    m2config = msg
                    cb null, "OK"

            debug "Starting loop for m2 OK"

            tries = 0

            okF = ->
                tries += 1
                m2rpc.request "OK", null, null, timeout:500, (err,msg) ->
                    if err
                        debug "m2 OK error. Tries: #{tries}"
                        okF() if tries < 20
                    else
                        debug "m2 OK success after #{tries} tries"
                        done()

            okF()

        # this is getting masked by listening for our OK above
        it "should send HANDOFF_GO"

        it "should not be listening on a master port", (done) ->
            m2rpc.request "master_port", (err,port) ->
                throw err if err
                expect(port).to.eql "NONE"
                done()

        it "should not be listening on a source port", (done) ->
            m2rpc.request "source_port", (err,port) ->
                throw err if err
                expect(port).to.eql "NONE"
                done()

    describe "Handoff", ->
        proxy = null

        before (done) ->
            # we need to disconnect our listeners, and then attach our proxy
            # RPC to bind the two together
            m1rpc.disconnect()
            m2rpc.disconnect()

            proxy = new RPCProxy m1, m2
            done()

        it "should run a handoff and initial master should exit", (done) ->
            this.timeout 12000
            # we trigger the handoff by sending USR2 to m1
            m1.kill("SIGUSR2")

            proxy.on "error", (msg) =>
                err = new Error msg.error
                err.stack = msg.err_stack

                throw err

            t = setTimeout =>
                throw new Error "Initial master did not exit within 10 seconds."
            , 10000

            m1.on "exit", (code) =>
                expect(code).to.eql 0
                clearTimeout t
                done()

        it "source should be connected to new master", (done) ->
            expect(ice_source._connected).to.eql true
            done()
