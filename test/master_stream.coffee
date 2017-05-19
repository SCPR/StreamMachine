MasterMode      = $src "modes/master"
Master          = $src "master"
MasterStream    = $src "master/stream"
SourceMount     = $src "master/source_mount"
Logger          = $src "logger"
FileSource      = $src "sources/file"
RewindBuffer    = $src "rewind_buffer"
HLSSegmenter    = $src "rewind/hls_segmenter"

mp3 = $file "mp3/mp3-44100-64-m.mp3"

_       = require "underscore"

#process.exit()

STREAM1 =
    key:                "test1"
    source_password:    "abc123"
    root_route:         true
    seconds:            60*60*4
    format:             "mp3"

describe "Master Stream", ->
    logger = new Logger stdout:false


    describe "Startup", ->
        mount = new SourceMount "test1", logger, STREAM1
        stream = new MasterStream "test1", logger, mount, STREAM1

        it "creates a Rewind Buffer", (done) ->
            expect(stream.rewind).to.be.an.instanceof RewindBuffer
            done()

    #----------

    describe "HLS", ->
        stream = null
        source = null
        before (done) ->
            mount   = new SourceMount "test1", logger, STREAM1
            stream  = new MasterStream "test1", logger, mount, _.extend {}, STREAM1, hls:{segment_duration:10}
            source  = new FileSource format:"mp3", filePath:mp3, chunkDuration:0.5, do_not_emit:true
            stream.addSource source

            source.once "_loaded", ->
                # emit 45 seconds of data
                # to make life easy to reason about, we'll put start_ts on a segment start.
                start_ts = new Date( Math.round(start_ts / 10) * 10 )

                for i in [0..90]
                    source._emitOnce new Date( start_ts + i*500 )

                done()

        it "should have created an HLS Segmenter", (done) ->
            expect( stream.rewind.hls_segmenter ).to.be.instanceof HLSSegmenter
            done()

        it "should have loaded data into the RewindBuffer", (done) ->
            expect( stream.rewind._rbuffer.length() ).to.be.gt 1
            done()

        it "should have created HLS segments", (done) ->
            this.timeout 5000
            stream.rewind.hls_segmenter.once "snapshot", (snapshot) =>
                # depending on how our segment boundary falls, this could be
                # three or four

                expect(snapshot.segments).to.have.length.within 3,4
                expect(snapshot.segment_duration).to.eq 10
                done()
