MemoryStore     = $src "rewind/memory_store"

ChunkGenerator  = $src "util/chunk_generator"
Debounce        = $src "util/debounce"

_ = require "underscore"

describe "Rewind Stores", ->
    start_ts = new Date()

    for stype in [["Memory Store",MemoryStore]]
        describe stype[0], ->
            store       = null
            generator   = null

            describe "Clean Buffer", ->
                before (done) ->
                    # create new store for 120 chunks
                    store = new stype[1] 120

                    # create new generator at our start_ts, using 1 sec chunks
                    generator = new ChunkGenerator start_ts, 1000

                    generator.on "readable", ->
                        while c = generator.read()
                            store.insert c

                    done()

                it "can insert data forward", (done) ->
                    pushes = 0

                    pF = ->
                        pushes += 1
                        bounce.ping()

                    bounce = new Debounce 50, ->
                        expect(pushes).to.eql 30
                        store.removeListener "push", pF
                        bounce.kill()
                        done()

                    store.addListener "push", pF

                    generator.forward 30

                it "can insert backward data", (done) ->
                    unshifts = 0

                    sF = ->
                        unshifts += 1
                        bounce.ping()

                    bounce = new Debounce 50, ->
                        expect(unshifts).to.eql 30
                        store.removeListener "unshift", sF
                        bounce.kill()
                        done()

                    store.addListener "unshift", sF

                    generator.backward 30

                it "truncates when it goes over max length", (done) ->
                    shifts = 0

                    sF = ->
                        shifts += 1
                        bounce.ping()

                    bounce = new Debounce 50, ->
                        expect(shifts).to.eql 15
                        store.removeListener "shift", sF
                        bounce.kill()
                        done()

                    store.addListener "shift", sF

                    generator.forward 75

                it "can return its length", (done) ->
                    expect( store.length() ).to.eql 120
                    done()

                it "can return its first buffer", (done) ->
                    # we've inserted 105 forward chunks, so our first buffer
                    # should be 15 before start_ts

                    b = store.first()

                    expect( b.ts ).to.eql new Date( Number(start_ts) - 15*1000 )
                    done()

                it "can return its last buffer", (done) ->
                    # there are 105 forward chunks inserted, so it should be
                    # 104 chunks _after_ start_ts

                    b = store.last()

                    expect( b.ts ).to.eql new Date( Number(start_ts) + 104*1000 )
                    done()

                it "can return a buffer using .at()", (done) ->
                    # start_ts should be at offset 104
                    store.at 104, (err,b) ->
                        throw err if err

                        expect(b).to.not.be.undefined
                        expect( b.ts ).to.eql start_ts
                        done()

                it "can return several buffers using .range()", (done) ->
                    # start..start+2
                    store.range 104, 3, (err,bufs) ->
                        throw err if err

                        expect(bufs).to.be.instanceof Array
                        for b,i in bufs
                            expect( b.ts ).to.eql new Date( Number(start_ts) + i*1000 )

                        done()

                it "can clone the buffers", (done) ->
                    store.clone (err,clone1) ->
                        throw err if err

                        expect(clone1).to.be.instanceof Array
                        expect(clone1).to.have.length store.length()

                        # we shift off a buffer to make sure this isn't the live array
                        clone1.shift()

                        store.clone (err,clone2) ->
                            throw err if err

                            expect(clone2).to.be.instanceof Array
                            expect( clone2 ).to.have.length store.length()
                            expect( clone2 ).to.have.length clone1.length + 1

                            done()

                it "can find a buffer by exact timestamp", (done) ->
                    store.at start_ts, (err,b) ->
                        throw err if err

                        expect(b).to.not.be.undefined
                        expect( b.ts ).to.eql start_ts
                        done()

                it "can find a buffer by closest timestamp", (done) ->
                    fuzz_ts = new Date( Number(start_ts) + 300 )

                    store.at fuzz_ts, (err,b) ->
                        throw err if err

                        expect(b).to.not.be.undefined
                        expect( b.ts ).to.eql start_ts
                        done()

            #describe "Buffer with discontinuity", ->



    # -- clean
    # -- with discontinuities
