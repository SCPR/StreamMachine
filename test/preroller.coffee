Preroller   = $src "slave/preroller"
SlaveStream = $src "slave/stream"
Logger      = $src "logger"

AdServer    = $src "util/fake_ad_server"
Transcoder  = $src "util/fake_transcoder"

_ = require "underscore"

fs = require "fs"
debug = require("debug")("sm:tests:preroller")

mp3 = $file "mp3/tone250Hz-44100-128-m.mp3"

STREAM1 =
    key:                "test1"
    source_password:    "abc123"
    root_route:         true
    seconds:            60*60*4
    format:             "mp3"
    log_minutes:        false
    max_buffer:         2*1024*1024

CLIENT =
    ip:         "127.0.0.1"
    ua:         "SCPRWEB | Mozilla/5.0 (Macintosh; Intel Mac OS X 10.6; rv:39.0) Gecko/20100101 Firefox/39.0"
    session_id: 1234

class FakeStream
    constructor: (@key) ->
        @log = new Logger {}

    getStreamKey: (cb) ->
        cb @key

class FakeOutput extends require('events').EventEmitter
    constructor: ->
        @client = CLIENT

class WriteCollector extends require("stream").Writable
    constructor: ->
        @length = 0
        super()

    _write: (chunk,encoding,cb) ->
        @length += chunk.length
        @emit "write"
        cb()

    onceWritten: (cb) ->
        if @length > 0
            cb()
        else
            @once "write", cb


describe "Preroller", ->
    logger = new Logger {}

    describe "XML Ad Formats", ->
        describe "VAST", ->
            doc = ""

            before (done) ->
                debug "Loading VAST doc"
                s = fs.readFile $file("ads/VAST.xml"), (err,data) ->
                    throw err if err

                    doc = data.toString()
                    debug "VAST XML loaded. Length is #{doc.length}."
                    done()

            it "Parses VAST ad", (done) ->
                new Preroller.AdObject doc, (err,obj) ->
                    throw err if err

                    expect(obj.creativeURL).to.eql "AUDIO"
                    expect(obj.impressionURL).to.eql "IMPRESSION"
                    done()

        describe "DAAST", ->
            doc = ""

            before (done) ->
                debug "Loading DAAST doc"
                s = fs.readFile $file("ads/DAAST.xml"), (err,data) ->
                    throw err if err

                    doc = data.toString()
                    debug "DAAST XML loaded. Length is #{doc.length}."
                    done()

            it "Parses Inline DAAST ad", (done) ->
                new Preroller.AdObject doc, (err,obj) ->
                    throw err if err

                    expect(obj.creativeURL).to.eql "AUDIO"
                    expect(obj.impressionURL).to.eql "IMPRESSION"
                    done()

            describe "No Ad", ->
                edoc = ""

                before (done) ->
                    fs.readFile $file("ads/DAAST-error.xml"), (err,data) ->
                        throw err if err
                        edoc = data.toString()
                        debug "DAAST error XML loaded. Length is #{edoc.length}."
                        done()

                it "Selects Error element if there is no ad", (done) ->
                    new Preroller.AdObject edoc, (err,obj) ->
                        throw err if err

                        expect(obj.creativeURL).to.be.nil
                        expect(obj.impressionURL).to.contain "NOAD_IMPRESSION"
                        done()

                it "Replaces [ERRORCODE] with 303", (done) ->
                    new Preroller.AdObject edoc, (err,obj) ->
                        throw err if err

                        expect(obj.creativeURL).to.be.nil
                        expect(obj.impressionURL).to.contain "e303"
                        done()



    describe "Preroll Scenarios", ->
        adserver = null
        transcoder = null

        before (done) ->
            debug "Setting up fake services"

            transcoder = new Transcoder 0, $file "mp3/"
            debug "Transcoder is listening on port #{transcoder.port}"

            adserver = new AdServer 0, $file("ads/VAST.xml"), =>
                debug "Ad server is listening on port #{adserver.port}"
                done()

        describe "Happy Path", ->
            stream      = null
            output      = null
            preroller   = null

            before (done) ->
                stream = new FakeStream "mp3-44100-128-s"
                output = new FakeOutput

                new Preroller stream,
                    "test",
                    "http://127.0.0.1:#{adserver.port}/ad",
                    "http://127.0.0.1:#{transcoder.port}/encoding",
                    100
                    (err,p) =>
                        preroller = p
                        debug "Preroller init"
                        done()

            it "pumps data when preroll is active", (done) ->
                writer = new WriteCollector()

                preroller.pump output, writer, (err) ->
                    throw err if err

                    writer.onceWritten ->
                        debug "writer got bytes"
                        done()

            it "hits impression URL", (done) ->
                adserver.once "impression", (req_id) ->
                    debug "Got impression from req_id #{req_id}"
                    done()

        describe "Many Requests", ->
            stream      = null
            output      = null
            preroller   = null

            before (done) ->
                stream = new FakeStream "mp3-44100-128-s"
                output = new FakeOutput

                new Preroller stream,
                    "test",
                    "http://127.0.0.1:#{adserver.port}/ad",
                    "http://127.0.0.1:#{transcoder.port}/encoding",
                    100
                    (err,p) =>
                        preroller = p
                        debug "Preroller init"
                        done()

            it "should return identical results to many requests", (done) ->
                succeeded = 0
                first_length = null

                count = 25

                aFunc = _.after count, ->
                    expect(succeeded).to.eql count
                    # this will disconnect all impressions
                    output.emit "disconnect"
                    done()

                _(count).times (i) ->
                    writer = new WriteCollector()
                    preroller.pump output, writer, (err) ->
                        throw err if err

                        debug "Finished request #{i}"

                        first_length ||= writer.length

                        expect(writer.length).to.eql first_length
                        succeeded += 1
                        aFunc()

        describe "Abort", ->
            stream      = null
            output      = null
            preroller   = null

            before (done) ->
                stream = new FakeStream "mp3-44100-128-s"
                output = new FakeOutput

                new Preroller stream,
                    "test",
                    "http://127.0.0.1:#{adserver.port}/ad",
                    "http://127.0.0.1:#{transcoder.port}/encoding",
                    100
                    (err,p) =>
                        preroller = p
                        debug "Preroller init"
                        done()

            it "does not hit impression URL for aborted client", (done) ->
                writer = new WriteCollector()

                preroller.pump output, writer, (err) ->
                    throw err if err

                    impression = false
                    bytes = false

                    adserver.once "impression", (req_id) ->
                        debug "Got impression from req_id #{req_id}"
                        impression = true

                    writer.onceWritten ->
                        debug "writer got bytes. Triggering disconnect."
                        output.emit "disconnect"
                        bytes = true

                    setTimeout ->
                        expect(bytes).to.be.true
                        expect(impression).to.be.false
                        done()




