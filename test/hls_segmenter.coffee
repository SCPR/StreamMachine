RewindBuffer    = $src "rewind_buffer"
HLSSegmenter    = $src "rewind/hls_segmenter"
Logger          = $src "logger"

ChunkGenerator  = $src "util/chunk_generator"

debug = require("debug")("sm:tests:hls_segmenter")

_ = require "underscore"

#----------

class FakeStreamGroup extends require("events").EventEmitter
    constructor: (rewinds) ->
        @updates = []
        @hls_min_id = null

        for r in rewinds
            r.hls_segmenter.syncToGroup @

    hlsUpdateMinSegment: (id) ->
        if !@hls_min_id || id > @hls_min_id
            @updates.push id
            prev = @hls_min_id
            @hls_min_id = id
            @emit "hls_update_min_segment", id

#----------

describe "HTTP Live Streaming Segmenter", ->
    rewind      = null

    chunk_duration      = 1000
    segment_duration    = 10000

    start_ts = new Date()

    # to make life easy to reason about, we'll put start_ts on a segment start.
    start_ts = new Date( Math.round(start_ts / segment_duration) * segment_duration )

    console.log "Start ts is ", start_ts

    #----------

    # The chunk injector takes a stream of audio chunks going forward and/or
    # backward from a common starting point, emitting segments each time a
    # segment length boundary is crossed. These semi-baked segments will have
    # start and end timestamps and a `buffers` array that contains the matching
    # chunks. It will reject pushes that aren't at the edges of the segment list.

    describe "Chunk Injector", ->
        injector    = null
        generator   = null

        beforeEach (done) ->
            injector = new HLSSegmenter.Injector segment_duration, (new Logger {})
            generator = new ChunkGenerator start_ts, chunk_duration
            generator.pipe(injector)
            done()

        afterEach (done) ->
            generator.unpipe()
            injector.removeAllListeners()
            done()

        it "accepts forward chunks and produces segments", (done) ->
            segments = []
            injector.on "readable", ->
                while s = injector.read()
                    segments.push s

            injector.once "finish", ->
                expect(segments.length).to.be.eql 3
                expect( Number(segments[1].ts) - Number(segments[0].ts) ).to.eql segment_duration

                done()

            # producing 31 seconds of audio should give us 3 pushed segments
            generator.forward 31, ->
                generator.end()

        it "doesn't emit a segment if not given enough data", (done) ->
            injector.once "segment", ->
                throw new Error "No segment was supposed to be created."

            injector.once "finish", ->
                done()

            # since we emit when _segments.length > 2, 19 seconds can't produce
            # an emitted segment
            generator.forward 19, -> generator.end()

        it "emits segments when given backward data", (done) ->
            segments = []
            injector.on "readable", ->
                while s = injector.read()
                    segments.push s

            injector.once "finish", ->
                expect(segments.length).to.be.eql 3
                expect( Number(segments[0].ts) - Number(segments[1].ts) ).to.eql segment_duration

                done()

            generator.backward 31, ->
                generator.end()

        it "emits mixed segments when given mixed data", (done) ->
            segments = []
            injector.on "readable", ->
                while s = injector.read()
                    segments.push s

            injector.once "finish", ->
                expect(segments).to.have.length.within 6,7

                # sort by ts
                segments = _(segments).sortBy (s) -> Number(s.ts)

                # five segments should cover 40 seconds going by timestamp
                expect( Number(segments[4].ts) - Number(segments[0].ts) ).to.eql 4 * segment_duration

                done()

            af = _.after 2, -> generator.end()

            generator.forward 30, -> af()
            generator.backward 30, -> af()

    #----------

    # The Finalizer sits after the Injector. It takes the half-baked segments
    # that the Injector emits and gives them sequence IDs. These can be from a
    # loaded sequence map (to reload data on startup, for instance), or they
    # can be generated sequence numbers going forward. The Finalizer is also
    # in charge of spotting gaps in the segment array, inserting discontinuity
    # objects where appropriate and keeping track of the discontinuity sequence.

    describe "Segment Finalizer", ->
        generator   = null
        injector    = null
        beforeEach (done) ->
            injector = new HLSSegmenter.Injector segment_duration, (new Logger {})
            generator = new ChunkGenerator start_ts, chunk_duration
            generator.pipe(injector)
            done()

        afterEach (done) ->
            generator.unpipe()
            injector.unpipe()
            done()

        describe "assigning sequenced IDs to new segments", ->
            finalizer = null
            it "generates segments", (done) ->
                finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration
                injector.pipe(finalizer)

                finalizer.on "finish", ->
                    done()

                generator.forward 31, -> generator.end()

            it "assigned the right ID sequence", (done) ->
                # even though three segments worth of data gets pushed into
                # the injector, it currently doesn't know how to trigger the
                # emit of its first segment into the finalizer.
                expect( finalizer.segmentSeq ).to.be.eql 2
                expect( finalizer.discontinuitySeq ).to.eql 0
                expect( finalizer.segments ).to.have.length 2
                expect( finalizer.segments[0].id ).to.eql 0
                expect( finalizer.segments[1].id ).to.eql 1
                done()


            it "assigned valid PTS values", (done) ->
                seg_pts_units = segment_duration * 90

                expect( finalizer.segmentPTS ).to.be.closeTo seg_pts_units*2, 100
                expect( finalizer.segments[0].pts ).to.be.eql 0
                expect( finalizer.segments[1].pts ).to.be.closeTo seg_pts_units*1, 100

                done()


        it "creates a discontinuity when given a gap", (done) ->
            finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration
            injector.pipe(finalizer)

            finalizer.on "finish", ->
                expect( finalizer.segmentSeq ).to.be.eql 3
                expect( finalizer.discontinuitySeq ).to.eql 1

                expect( finalizer.segments[ 0 ].discontinuitySeq ).to.eql 0
                expect( finalizer.segments[ finalizer.segments.length - 1 ].discontinuitySeq ).to.eql 1

                done()

            generator.forward 30, -> generator.skip_forward 15, ->
                generator.forward 11, -> generator.end()

        it "will use a segment map to assign sequence numbers", (done) ->
            f_seg = injector._createSegment start_ts

            seq = 5
            seg_map = {}
            for i in [0..2]
                seg_map[ Number(f_seg.ts) + i*segment_duration ] = seq + i

            finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration,
                segmentSeq:         8
                nextSegment:        f_seg.ts
                discontinuitySeq:   0
                segmentMap:         seg_map

            injector.pipe(finalizer)

            finalizer.on "finish", ->
                expect(finalizer.segments).to.have.length.within 4,5

                if finalizer.segments.length == 4
                    expect(finalizer.segments[ finalizer.segments.length - 4 ].id).to.eql 5

                expect(finalizer.segments[ finalizer.segments.length - 3 ].id).to.eql 6
                expect(finalizer.segments[ finalizer.segments.length - 2 ].id).to.eql 7
                expect(finalizer.segments[ finalizer.segments.length - 1 ].id).to.eql 8

                done()

            generator.forward 40, -> generator.end()

        it "will use a segment map to assign sequence numbers to back data", (done) ->
            f_seg = injector._createSegment start_ts

            seq = 5
            seg_map = {}
            for i in [3..1]
                seg_map[ Number(f_seg.ts) - i*segment_duration ] = seq
                seq += 1

            finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration,
                segmentSeq:         8
                nextSegment:        f_seg.ts
                discontinuitySeq:   0
                segmentMap:         seg_map

            injector.pipe(finalizer)

            finalizer.on "finish", ->
                expect(finalizer.segments).to.have.length 4

                for seg in finalizer.segments
                    if seg.id < 8
                        map_id = seg_map[ Number( seg.ts ) ]
                        expect(map_id).to.not.be.undefined
                        expect(seg.id).to.eql map_id

                    else
                        expect(seg.id).to.eql 8

                done()

            af = _.after 2, ->
                generator.end()

            generator.forward 10, af
            generator.backward 30, af

        it "will not publish a segment that is not in the segment map", (done) ->
            f_seg = injector._createSegment start_ts

            seq = 5
            seg_map = {}
            for i in [3..1]
                seg_map[ Number(f_seg.ts) - i*segment_duration ] = seq
                seq += 1

            for m in [[1,7],[3,6]]
                seg_map[ Number(f_seg.ts) - m[0]*segment_duration ] = m[1]

            finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration,
                segmentSeq:         8
                nextSegment:        f_seg.ts
                discontinuitySeq:   0
                segmentMap:         seg_map

            injector.pipe(finalizer)

            finalizer.on "finish", ->
                expect(finalizer.segments).to.have.length 3

                for seg in finalizer.segments
                    map_id = seg_map[ Number( seg.ts ) ]
                    expect(map_id).to.not.be.undefined
                    expect(seg.id).to.eql map_id

                done()

            generator.backward 40, -> generator.end()

        it "will correctly number discontinuities in back data", (done) ->
            f_seg = injector._createSegment start_ts

            seg_map = {}
            for m in [[1,7],[2,6],[4,5]]
                seg_map[ Number(f_seg.ts) - m[0]*segment_duration ] = m[1]

            finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration,
                segmentSeq:         8
                nextSegment:        f_seg.ts
                discontinuitySeq:   4
                segmentMap:         seg_map

            injector.pipe(finalizer)

            finalizer.on "finish", ->
                expect(finalizer.segments).to.have.length 3
                expect(finalizer.segments[0].discontinuitySeq).to.eql 3

                done()

            generator.backward 20, -> generator.skip_backward 10,
                -> generator.backward 10, -> generator.end()

        it "can dump map info", (done) ->

            finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration
            injector.pipe(finalizer)

            finalizer.on "finish", ->
                finalizer.dumpMap (err,map) ->
                    expect( map ).to.have.property "segmentMap"
                    expect( map ).to.have.property "segmentSeq"
                    expect( map ).to.have.property "discontinuitySeq"
                    expect( map ).to.have.property "nextSegment"
                    done()

            generator.forward 41, -> generator.end()

        it "can dump a snapshot", (done) ->
            finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration
            injector.pipe(finalizer)

            finalizer.on "finish", ->
                finalizer.snapshot (err,snapshot) ->
                    expect( snapshot ).to.be.instanceof Array
                    expect( snapshot ).to.have.length 3

                    for s,i in snapshot
                        expect(s.discontinuitySeq).to.eql 0
                        expect(s.id).to.eql i

                    done()

            generator.forward 41, -> generator.end()

        it "can expire segments using the expire function", (done) ->
            finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration
            injector.pipe(finalizer)

            finalizer.once "finish", ->
                expect(finalizer.segments.length).to.eql 5
                done()

            generator.forward 120, ->

                exp_ts = new Date( Number(start_ts) + 65*1000 )

                process.nextTick ->
                    expect(Number(finalizer.segments[0].ts)).to.be.lt Number(exp_ts)

                    finalizer.expire exp_ts, (err,min_id) ->
                        # we expect our new minimum segment to have a start_ts
                        # greater than the time we expired
                        expect(Number(finalizer.segments[0].ts)).to.be.gt Number(exp_ts)
                        generator.end()

    #----------

    # now put it all together. This time, create an HLSSegmenter and a
    # RewindBuffer and feed audio through its normal course.
    describe "RewindBuffer -> Segmenter", ->
        rewind      = null
        generator   = null
        r2          = null

        before (done) ->
            rewind = new RewindBuffer hls:10, seconds:120, burst:30, log:(new Logger stdout:false)
            rewind._rChunkLength emitDuration:1, streamKey:"testing"

            generator = new ChunkGenerator start_ts, 1000

            generator.on "readable", ->
                while c = generator.read()
                    rewind._insertBuffer c

            done()

        it "creates the HLS Segmenter", (done) ->
            expect(rewind.hls_segmenter).to.be.an.instanceof HLSSegmenter
            done()

        it "segments source data", (done) ->
            injector_pushes = 0
            rewind.hls_segmenter.injector.on "push", ->
                injector_pushes += 1

            rewind.hls_segmenter.once "_finalizer", ->
                setTimeout ->

                    expect(injector_pushes).to.be.within 4,5
                    expect(rewind.hls_segmenter.finalizer.segments).to.have.length.within 4,5
                    done()
                , 200

            generator.forward 60

        it "expires segments when the RewindBuffer fills", (done) ->
            rewind.hls_segmenter.once "snapshot", (snap) ->
                expect(rewind.bufferedSecs()).to.eql 120

                # we're sending in 121 seconds, so there will be one second in
                # a not-yet-created segment, and our first segment will have lost
                # its first segment and been expired. That leaves 11 active.
                expect(snap.segments).to.have.length 11
                done()

            generator.forward 121

        it "loads segment data from a RewindBuffer dump", (done) ->
            pt = new require("stream").PassThrough()

            r2 = new RewindBuffer hls:10, seconds:120, burst:30, log:(new Logger {stdout:false})
            r2._rChunkLength emitDuration:1, streamKey:"testing"

            rewind.hls_segmenter.snapshot (err,snap1) ->
                throw err if err

                debug "snap1 has #{snap1.segments.length} segments."
                debug "snap1 first segment is #{snap1.segments[0].id}.", snap1.segments[0]
                debug "snap1 last segment is #{snap1.segments[snap1.segments.length-1].id}.", snap1.segments[snap1.segments.length-1]

                r2.loadBuffer pt, (err,stats) ->
                    throw err if err

                    # -- r2 loaded -- #

                    r2.hls_segmenter.snapshot (err,snap2) ->
                        throw err if err

                        debug "snap2 has #{snap2.segments.length} segments."
                        debug "snap2 first segment is #{snap2.segments[0].id}.", snap2.segments[0]
                        debug "snap2 last segment is #{snap2.segments[snap2.segments.length-1].id}.", snap2.segments[snap2.segments.length-1]

                        expect(snap2.segments).to.have.length snap1.segments.length

                        done()

                rewind.dumpBuffer (err,writer) ->
                    throw err if err
                    writer.pipe(pt)

        it "receives new data cleanly after loading from a RewindBuffer dump", (done) ->
            throw new Error "Requires r2 to be populated." if !r2

            g2 = new ChunkGenerator generator.ts().forward, 1000

            g2.on "readable", ->
                while c = g2.read()
                    r2._insertBuffer c

            r2.hls_segmenter.once "snapshot", (snap)->
                debug "g2 snap is ", snap

                # we're checking to make sure that our snapshot numbering is intact,
                # as is our timestamp sequence
                last = null
                for s in snap.segments
                    if last
                        expect(s.id).to.eql last.id + 1
                        expect(s.ts).to.eql last.end_ts

                    last = s

                done()

            g2.forward 10

    #----------

    describe "Stream Group Coordination", ->
        r1 = null
        r2 = null
        sg = null

        g1 = null
        g2 = null

        before (done) ->
            r1 = new RewindBuffer hls:10, seconds:120, burst:30, log:(new Logger {})
            r1._rChunkLength emitDuration:0.5, streamKey:"testing"
            r1.loadBuffer null, (err,stats) ->

            r2 = new RewindBuffer hls:10, seconds:120, burst:30, log:(new Logger {})
            r2._rChunkLength emitDuration:0.5, streamKey:"testing"
            r2.loadBuffer null, (err,stats) ->

            sg = new FakeStreamGroup [r1,r2]

            d = new Date()
            g1 = new ChunkGenerator d, 1000
            g2 = new ChunkGenerator d, 1000

            g1.on "readable", ->
                r1._insertBuffer c while c = g1.read()

            g2.on "readable", ->
                r2._insertBuffer c while c = g2.read()

            done()

        it "should trigger updates to stream group min segment TS", (done) ->
            this.timeout 4000
            # stream all f_chunks into r1, but skip some for r2
            g1.forward 120
            g2.skip_forward 30, -> g2.forward 90

            af = _.after 2, ->
                expect(sg.updates.length).to.eql 2
                done()

            r1.hls_segmenter.once "snapshot", af
            r2.hls_segmenter.once "snapshot", af

        it "both RewindBuffers should have the correct first segment", (done) ->
            expect(Number(r1._rStatus().hls_first_seg_ts)).to.eql sg.hls_min_id
            expect(Number(r2._rStatus().hls_first_seg_ts)).to.eql sg.hls_min_id
            done()

        it "should stay correct when data is expired unevenly", (done) ->
            this.timeout 5000

            r1.setRewind(30,30)

            af = _.after 2, ->
                expect(Number(r1._rStatus().hls_first_seg_ts)).to.eql sg.hls_min_id
                expect(Number(r2._rStatus().hls_first_seg_ts)).to.eql sg.hls_min_id
                done()

            r1.hls_segmenter.once "snapshot", af
            r2.hls_segmenter.once "snapshot", af

    #----------

    describe "Segment PTS values", ->
        generator   = null
        injector    = null
        finalizer   = null

        before (done) ->
            injector = new HLSSegmenter.Injector segment_duration, (new Logger {})
            generator = new ChunkGenerator start_ts, chunk_duration
            generator.pipe(injector)

            finalizer = new HLSSegmenter.Finalizer (new Logger {}), segment_duration
            injector.pipe(finalizer)

            done()

        after (done) ->
            generator.unpipe()
            injector.unpipe()
            done()

        it "generates correct PTS at 24 hours", (done) ->
            generator.forward (86400 * 1000 / chunk_duration), ->
                # PTS will have started at 0 since we didn't send in a map, so a
                # segment's PTS should be seg.id * segment_duration * 90

                last_seg = finalizer.segments[finalizer.segments.length-1]

                expect(last_seg.pts).to.eql last_seg.id * segment_duration * 90

                done()

        it "generates correct PTS at 48 hours", (done) ->
            generator.forward (86400 * 1000 / chunk_duration), ->
                # PTS is a 33-bit integer, so it will roll over after 26.5 hours
                # when it hits Math.pow(2,33) - 1
                last_seg = finalizer.segments[finalizer.segments.length-1]
                # we can't test actaul equality here because javascript doesn't believe in ints
                expect(last_seg.pts).to.be.closeTo ((last_seg.id * segment_duration * 90) - Math.pow(2,33) - 1), 10
                done()
