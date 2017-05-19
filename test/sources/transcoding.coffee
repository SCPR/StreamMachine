_ = require "underscore"

FileSource  = $src "sources/file"
TransSource = $src "sources/transcoding"

AAC         = $src "parsers/aac"

Logger          = $src "logger"

FILE_STREAM =
    key:                "test"
    source_password:    "abc123"
    root_route:         true
    seconds:            60*60*4
    format:             "mp3"

TRANS_MP3_STREAM =
    key:                "_test"
    source_password:    "abc123"
    root_route:         true
    seconds:            60*60*4
    format:             "mp3"
    stream_key:         "mp3-44100-64-s"
    ffmpeg_args:        "-c:a libmp3lame -b:a 64k"

TRANS_AAC_STREAM =
    key:                "_test"
    source_password:    "abc123"
    root_route:         true
    seconds:            60*60*4
    format:             "aac"
    stream_key:         "aac-44100-2-2"
    ffmpeg_args:        "-c:a libfdk_aac|-b:a 64k|-f:a adts"


in_file = $file "aac-256.aac"

describe "Transcoding Source", ->
    return true if process.env['SKIP_TRANSCODING']

    logger = new Logger {stdout:false}

    file_source = null
    trans_source = null

    before (done) ->
        file_source = new FileSource format:"aac", filePath:in_file, chunkDuration:0.1
        done()

    beforeEach (done) ->
        trans_source = new TransSource
            stream:         file_source
            ffmpeg_args:    TRANS_AAC_STREAM.ffmpeg_args
            format:         "aac"
            stream_key:     "test"
            discontinuityTimeout: 150
            logger:         logger

        done()

    afterEach (done) ->
        file_source.stop()
        trans_source.removeAllListeners("disconnect")
        trans_source.disconnect()
        done()

    it "emits a chunk of data", (done) ->
        this.timeout(4000)

        trans_source.once "disconnect", ->
            done new Error("Source disconnected. FFMPEG missing?")

        trans_source.once "data", (chunk) ->
            done()

        file_source.start()

    it "detects a discontinuity", (done) ->
        this.timeout(4000)

        trans_source.once "disconnect", ->
            done new Error("Source disconnected. FFMPEG missing?")

        # Once we get first data, stop and start the stream. We should
        # get events for each occasion, and we should get the stop within
        # the 100ms we set as our discontinuityTimeout above

        trans_source.once "data", (chunk) ->
            first_data = Number(new Date())
            trans_source.once "discontinuity_begin", ->
                stopped = Number(new Date())
                expect(stopped-first_data).to.be.below(200)

                trans_source.once "discontinuity_end", ->
                    done()

                file_source.start()

            file_source.stop()

        file_source.start()
