BatchedQueue = $src "util/batched_queue"

describe "Batched Queue", ->
  # The intent of BatchedQueue is to try to batch messages, but to enforce
  # a maximum latency for sitting messages.  Here we test that a non-full
  # batch does get through after maxLatency ms

  it "sends a single message through within maxLatency", (done) ->
    bq = new BatchedQueue batch:1000, latency:50

    msgs = []
    bq.on "readable", ->
      while chunk = bq.read()
        msgs.push(chunk)

    bq.write "1"

    setTimeout ->
      expect(msgs).to.have.length(0)
    , 20

    setTimeout ->
      expect(msgs).to.have.length(1)
      done()
    , 55 # a few ms of wiggle room

  #----------

  it "batches up a chunk of writes and delivers them at once", (done) ->
    bq = new BatchedQueue batch:1000, latency:50

    bq.on "readable", ->
      queue = bq.read()
      expect(queue).to.have.length(100)
      done()

    bq.write i for i in [0..99]

  #----------

  it "must create backpressure with no reader", (done) ->
    bq = new BatchedQueue batch:50, latency:50, writable:100

    sent = 0

    for i in [0..1500]
      if bq.write i
        sent += 1

      else
        # backpressure will trigger at writable.high + (readable.high * batchSize) - 1
        expect(sent).to.equal 50 + 100 - 1
        done()
        break

  it "must respect backpressure from a reader", (done) ->
    bq = new BatchedQueue batch:50, latency:50, writable:100

    sent = 0
    received = 0

    # we'll read one time
    bq.once "readable", ->
      received = bq.read().length

    for i in [0..1500]
      if bq.write i
        sent += 1

      else
        expect(sent).to.equal 100 + 100 - 1
        expect(received).to.equal 50
        done()
        break

  it "must correctly signal end", (done) ->
    bq = new BatchedQueue batch:1000, latency:50

    bq.on "readable", ->
      while l = bq.read()
        # do nothing
        true

    bq.on "end", ->
      expect(true).to.equal true
      done()

    bq.end()