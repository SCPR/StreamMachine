FileSource      = $src "sources/file"
Logger          = $src "logger"

STREAM1 =
    key:                "test1"
    source_password:    "abc123"
    root_route:         true
    seconds:            60*60*4
    format:             "mp3"

mp3 = $file "mp3/mp3-44100-64-s.mp3"

describe "File Source", ->
    logger = new Logger {}
    source = new FileSource format:"mp3", filePath:mp3, chunkDuration:0.1

    it "should set the correct streamKey", (done) ->
        source.getStreamKey (key) ->
            expect(key).to.equal "mp3-44100-64-s"
            done()

    it "should emit data", (done) ->
        source.once "data", (data) ->
            expect(data).to.be.an.object
            expect(data.duration).to.be.a.number
            expect(data.data).to.be.an.instanceof Buffer
            done()

    it "should not emit data after disconnect", (done) ->
        did_emit = false

        setTimeout ->
            expect(did_emit).to.equal false
            done()
        , 300

        source.disconnect()

        source.once "data", (data) ->
            did_emit = true