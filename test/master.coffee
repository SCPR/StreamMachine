MasterMode      = $src "modes/master"
Master          = $src "master"
MasterStream    = $src "master/stream"

SlaveIO         = $src "slave/slave_io"
Logger          = $src "logger"

MasterHelper    = require "./helpers/master"
StreamHelper    = require "./helpers/stream"

weak = require "weak"

debug = require("debug")("sm:tests:master")

_       = require "underscore"

STREAM1 =
    key:                "test1"
    source_password:    "abc123"
    root_route:         true
    seconds:            60*60*4
    format:             "mp3"

class FakeSlave extends require("events").EventEmitter
    constructor: ->
        @streams = null

    configureStreams: (s) ->
        @streams = s
        @emit "config"

    onceConfigured: (cb) ->
        if @streams
            cb()
        else
            @once "config", cb

describe "StreamMachine Master Mode", ->
    mm = null

    port_master = null
    port_source = null

    # -- Initialize our master -- #

    before (done) ->
        MasterHelper.startMaster "mp3", (err,info) ->
            throw err if err
            mm = info

            debug "started master. Connect at: #{mm.slave_uri}"
            debug "Stream Key is #{mm.stream_key}"

            done()

    after (done) ->
        mm.master.master.monitoring.shutdown()
        done()

    # -- Test our startup state -- #

    describe "Startup", ->
        it "should have started a Master instance", (done) ->
            expect(mm.master).to.be.a.instanceof(MasterMode)
            done()

        it "should be listening on a source port", (done) ->
            expect(mm.source_port).not.to.be.undefined
            done()

        it "should be listening on an admin port", (done) ->
            expect(mm.master_port).not.to.be.undefined
            done()

        it "should have no streams configured", (done) ->
            expect(mm.master.streams).to.be.empty
            done()

        it "should have no slaves", (done) ->
            expect(mm.master.master.slaves.slaves).to.be.empty
            done()

        it "should be listening for slaves"

    # -- Configure a Stream -- #

    describe "Stream Configuration", ->
        streams_emitted = false
        before (done) ->
            mm.master.master.once "streams", -> streams_emitted = true
            done()

        it "should accept a new stream", (done) ->
            c = streams:{}, sources:{}
            c.streams[ STREAM1.key ] = STREAM1

            mm.master.master.configure c, (err,config) ->
                expect(err).to.be.null
                expect(config).to.have.property 'streams'
                expect(config.streams).to.have.property STREAM1.key
                expect(config.streams?[STREAM1.key]).to.be.an.instanceof MasterStream
                done()

        it "should have emitted 'streams' when configured", (done) ->
            expect(streams_emitted).to.be.true
            done()

        it "should destroy a stream when asked", (done) ->
            stream2 = StreamHelper.getStream "mp3"

            mm.master.master.createStream stream2, (err,status) ->
                throw err if err

                expect(mm.master.master.streams).to.have.property stream2.key

                stream = weak(mm.master.master.streams[stream2.key])
                mm.master.master.removeStream stream, (err) =>
                    throw err if err

                    expect(mm.master.master.streams).to.not.have.property stream2.key

                    if global.gc
                        global.gc()
                        expect(stream.key).to.be.undefined
                        done()
                    else
                        console.log "Skipping GC deref test. Run with --expose-gc"
                        done()

    # -- Slaves -- #

    describe "Slave Connections", ->
        s_log   = new Logger stdout:false
        slave   = null
        s_io    = null

        it "should allow a slave connection", (done) ->
            slave   = new FakeSlave
            s_io    = new SlaveIO slave, s_log, master:"ws://localhost:#{mm.master_port}?password=#{mm.config.master.password}"

            err_f = (err) -> throw err

            s_io.once "error", err_f

            s_io.once_connected (err,io) ->
                throw err if err
                s_io.removeListener "error", err_f

                expect(io.connected).to.be.true
                expect(s_io.connected).to.be.true

                done()

        it "should emit configuration to the slave", (done) ->
            # it's possible (and fine) to not get config immediately if the master
            # hasn't finished its config
            slave.onceConfigured ->
                expect(slave.streams).to.be.object
                expect(slave.streams).to.have.property STREAM1.key
                done()

        it "should deny a slave that provides the wrong password"
