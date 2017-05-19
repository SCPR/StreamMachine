StandaloneHelper    = require "./helpers/standalone"
StreamHelper        = require "./helpers/stream"

StreamListener  = $src "util/stream_listener"
IcecastSource   = $src "util/icecast_source"

mp3 = $file "mp3/mp3-44100-128-s.mp3"

debug = require("debug")("sm:tests:standalone")
request = require "request"

weak = require "weak"

describe "Standalone Mode", ->
    sa_info     = null
    standalone  = null

    before (done) ->
        StandaloneHelper.startStandalone 'mp3', (err,info) ->
            throw err if err

            sa_info = info
            standalone = info.standalone

            done()

    it "should map slave stream sources to master streams", (done) ->
        standalone.master.once_configured ->
            expect(standalone.master.streams).to.have.key sa_info.stream_key
            expect(standalone.slave.streams).to.have.key sa_info.stream_key

            expect(standalone.slave.streams[sa_info.stream_key].source).to.eql standalone.master.streams[sa_info.stream_key]

            done()

    it "should accept a source", (done) ->
        source = new IcecastSource
            format:     "mp3"
            filePath:   mp3
            host:       "127.0.0.1"
            port:       sa_info.source_port
            password:   sa_info.source_password
            stream:     sa_info.stream_key

        source.start (err) ->
            throw err if err

            status = standalone.master.streams[sa_info.stream_key].status()
            expect(status.source.sources).to.have.length 1
            done()

    it "should accept a listener and feed it data", (done) ->
        this.timeout 4000
        listener = new StreamListener "127.0.0.1", sa_info.port, sa_info.stream_key

        listener.connect (err) =>
            throw err if err

            listener.once "bytes", ->
                listener.disconnect()
                done()

    it "should accept an API call to /streams", (done) ->
        request.get url:"#{sa_info.api_uri}/streams", json:true, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200
            expect(json).to.be.instanceof Array
            expect(json).to.have.length 1
            expect(json[0].key).to.eql sa_info.stream_key

            done()

    describe "Config Updates", ->
        s2 = StreamHelper.getStream "mp3"

        it "should properly plumb a new stream", (done) ->
            standalone.master.createStream s2, (err,status) ->
                throw err if err

                expect(standalone.master.streams, "Master streams should include our new stream")
                    .to.include.key s2.key

                setTimeout ->
                    expect(standalone.slave.streams, "Slave streams should include our new stream")
                        .to.include.key s2.key

                    expect(standalone.slave.streams[s2.key].source, "Slave stream source should be the master stream")
                        .to.eql standalone.master.streams[s2.key]

                    done()
                , 50

        it "should properly unplumb a removed stream", (done) ->
            stream = weak(standalone.master.streams[s2.key])

            standalone.slave.once "streams", ->
                expect(standalone.master.streams).to.not.have.property s2.key
                expect(standalone.slave.streams).to.not.have.property s2.key

                if global.gc
                    global.gc()
                    expect(stream.key,"Hopefully GC'ed stream key").to.be.undefined
                    done()
                else
                    console.log "Skipping GC deref test. Run with --expose-gc"
                    done()

            standalone.master.removeStream stream, (err) ->
                throw err if err
