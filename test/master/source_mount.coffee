MasterMode      = $src "modes/master"
Master          = $src "master"
MasterStream    = $src "master/stream"
Logger          = $src "logger"
FileSource      = $src "sources/file"
RewindBuffer    = $src "rewind_buffer"
HLSSegmenter    = $src "rewind/hls_segmenter"

SourceMount     = $src "master/source_mount"

mp3 = $file "mp3/mp3-44100-64-m.mp3"

_       = require "underscore"

#process.exit()

STREAM1 =
    key:                "test1"
    source_password:    "abc123"
    format:             "mp3"

describe "Master Source Mount", ->
    logger = new Logger stdout:false

    #----------

    describe "Configuration", ->
        it "can be configured during creation", (done) ->
            mount = new SourceMount "test1", logger, STREAM1

            expect(mount.password).to.equal STREAM1.source_password
            expect(mount.config().format).to.equal STREAM1.format
            done()

        it "can be reconfigured after creation", (done) ->
            mount = new SourceMount "test1", logger, STREAM1

            new_password = "def456"

            mount.configure password:new_password, (err,config) ->
                throw err if err
                expect(config.password).to.equal new_password
                expect(mount.password).to.equal new_password
                done()

    #----------

    describe "Typical Source Connections", ->
        mount = new SourceMount "test1", logger, STREAM1

        source  = new FileSource format:"mp3", filePath:mp3, chunkDuration:0.1
        source2 = new FileSource format:"mp3", filePath:mp3, chunkDuration:0.1

        it "activates the first source to connect", (done) ->
            expect(mount.source).to.be.null

            mount.addSource source, (err) ->
                throw err if err
                expect(mount.source).to.equal source
                done()

        it "queues the second source to connect", (done) ->
            expect(mount.sources).to.have.length 1

            mount.addSource source2, (err) ->
                throw err if err
                expect(mount.sources).to.have.length 2
                expect(mount.source).to.equal source
                expect(mount.sources[1]).to.equal source2
                done()

        it "promotes an alternative source when requested", (done) ->
            expect(mount.source).to.equal source

            mount.promoteSource source2.uuid, (err) ->
                throw err if err
                expect(mount.source).to.equal source2

                mount.promoteSource source.uuid, (err) ->
                    throw err if err
                    expect(mount.source).to.equal source
                    done()

        it "switches to the second source if the first disconnects", (done) ->
            mount.once "source", (s) ->
                expect(s).to.equal source2
                done()

            source.disconnect()

    describe "Source Connection Scenarios", ->
        mp3a = $file "mp3/tone250Hz-44100-128-m.mp3"
        mp3b = $file "mp3/tone440Hz-44100-128-m.mp3"
        mp3c = $file "mp3/tone1kHz-44100-128-m.mp3"

        mount  = null
        source1 = null
        source2 = null
        source3 = null

        beforeEach (done) ->
            mount = new SourceMount "test1", logger, STREAM1
            source1 = new FileSource format:"mp3", filePath:mp3a, chunkDuration:0.1
            source2 = new FileSource format:"mp3", filePath:mp3b, chunkDuration:0.1
            source3 = new FileSource format:"mp3", filePath:mp3c, chunkDuration:0.1
            done()

        afterEach (done) ->
            mount.removeAllListeners()
            source1.removeAllListeners()
            source2.removeAllListeners()
            source3.removeAllListeners()
            done()

        it "doesn't get confused by simultaneous addSource calls", (done) ->
            mount.once "source", ->
                # listen for five data emits.  they should all come from
                # the same source uuid
                emits = []

                af = _.after 5, ->
                    uuid = mount.source.uuid

                    expect(emits[0].uuid).to.equal uuid
                    expect(emits[1].uuid).to.equal uuid
                    expect(emits[2].uuid).to.equal uuid
                    expect(emits[3].uuid).to.equal uuid
                    expect(emits[4].uuid).to.equal uuid

                    done()

                mount.on "data", (data) ->
                    emits.push data
                    af()

            mount.addSource source1
            mount.addSource source2

            source1.start()
            source2.start()

        it "doesn't get confused by quick promoteSource calls", (done) ->
            mount.addSource source1, ->
                mount.addSource source2, ->
                    mount.addSource source3, ->
                        source1.start()
                        source2.start()
                        source3.start()

                        # listen for five data emits.  they should all come from
                        # the same source uuid
                        emits = []

                        af = _.after 5, ->
                            uuid = mount.source.uuid

                            expect(emits[0].uuid).to.equal uuid
                            expect(emits[1].uuid).to.equal uuid
                            expect(emits[2].uuid).to.equal uuid
                            expect(emits[3].uuid).to.equal uuid
                            expect(emits[4].uuid).to.equal uuid

                            done()

                        mount.on "data", (data) ->
                            emits.push data
                            af()

                        mount.promoteSource source2.uuid
                        mount.promoteSource source3.uuid