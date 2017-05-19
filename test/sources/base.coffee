BaseSource      = $src "sources/base"

fs = require "fs"
Throttle = require "throttle"

mp3 = $file "mp3/mp3-44100-64-s.mp3"

#----------

class TestSource extends BaseSource
    constructor: (@file,format) ->
        @opts = {}
        @opts.format = format
        @opts.chunkDuration = 0.5
        @opts.heartbeatTimeout = 500

        super useHeartbeat:true

        @_throttle = new Throttle 64*1024
        @_throttle.pipe(@parser)

    start: ->
        return true if @_file

        @_file = fs.createReadStream @file
        @_file.pipe(@_throttle)
        @_file.once "end", =>
            @emit "_read"
            @_file = null

        true

    stop: ->
        if @_file
            @_file.unpipe()
            @_file.removeAllListeners()
            @_file = null

        true

    disconnect: ->
        @stop()
        super()
        @emit "disconnect"

#----------

describe "Base Source", ->
    s = null

    beforeEach (done) ->
        s = new TestSource mp3, "mp3"
        done()

    afterEach (done) ->
        s.disconnect()
        s.removeAllListeners()
        s = null
        done()

    describe "Frame Chunker", ->
        it "returns chunked data", (done) ->
            s.once "_chunk", (chunk) ->
                expect(chunk.duration).to.be.within(450,550)
                done()

            s.start()

    describe "Heartbeat Disconnect", ->
        it "detects stopped data", (done) ->
            s.once "_chunk", (chunk) ->
                s_ts = Number(new Date())

                dead = false
                s.once "_source_dead", (last_ts,dead_ts) ->
                    expect(dead_ts-last_ts).to.be.below(600)
                    dead = true

                s.once "disconnect", ->
                    expect(dead).to.be.true
                    done()

                s.stop()

            s.start()