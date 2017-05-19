RewindBuffer    = $src "rewind_buffer"
FileSource      = $src "sources/file"
Logger          = $src "logger"

mp3 = $file "mp3/mp3-44100-128-s.mp3"

class BytesReceived extends require("stream").Writable
    constructor: ->
        super
        @bytes = 0

    _write: (chunk,encoding,cb) ->
        @bytes += chunk.length
        @emit "bytes", @bytes
        cb()

describe "Rewinder", ->
    rewind      = null
    source_a    = null

    logger = new Logger {}

    before (done) ->
        rewind = new RewindBuffer seconds:60, burst:30, log:logger
        done()

    before (done) ->
        source = new FileSource format:"mp3", filePath:mp3, do_not_emit:true, chunkDuration:0.1
        source.once "_loaded", ->
            rewind._rConnectSource source, ->
                # dump in 30 secs
                source.emitSeconds 30, ->
                    # then also start emitting normally
                    source.start()
                    done()

    describe "Raw audio, not pumped", ->
        rewinder = null

        it "can connect to the rewind buffer", (done) ->
            rewind.getRewinder 0, offsetSeconds:0, burst:0, (err,r) ->
                throw err if err
                rewinder = r
                done()

        it "should emit data", (done) ->
            this.timeout 4000

            bytes = new BytesReceived

            rewinder.pipe(bytes)

            bytes.once "bytes", =>
                done()

    describe "Pumped", ->
        rewinder = null
        info = null

        it "connects to the rewind buffer", (done) ->
            rewind.getRewinder 0, offsetSecs:10, pumpOnly:true, pump:10, (err,r,i) ->
                throw err if err
                rewinder = r
                info = i

                expect(info).to.not.be.null

                done()

        it "gets the proper length of data pumped", (done) ->
            bytes = new BytesReceived
            rewinder.pipe(bytes)

            bytes.on "finish", ->
                expect(bytes.bytes).to.be.eql info.length
                done()




