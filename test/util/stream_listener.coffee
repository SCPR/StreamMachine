StreamListener = $src "util/stream_listener"

debug = require("debug")("sm:tests:util:stream_listener")

http = require "http"

#----------

oneTimeServer = (port=0,delay=0,cb) ->
    server = http.createServer (req,res) ->
        debug "Incoming request"

        setTimeout ->
            cb()
            res.writeHead 200, "Content-type": "text/plain"

            # flushHeaders isn't in node 0.10. _send '' accomplishes the same thing
            res.flushHeaders?()
            res._send ''
        , delay

    server.listen port

    return server.address().port

#----------

describe "Stream Listener", ->
    it "should connect to a server", (done) ->
        connected = false
        port = oneTimeServer 0, 0, ->
            connected = true

        listener = new StreamListener "127.0.0.1", port, ""

        listener.connect (err) ->
            throw err if err
            expect(connected).to.be.true
            done()

    it "should connect to a late-arriving server", (done) ->
        # create our listener, and then 200ms later create our server
        connected = false
        port = 55555
        setTimeout ->
            oneTimeServer port, 0, ->
                connected = true
        , 200

        listener = new StreamListener "127.0.0.1", port, ""

        listener.connect 1000, (err) ->
            throw err if err
            expect(connected).to.be.true
            done()

    it "should connect to a late-responding server", (done) ->
        connected = false
        port = oneTimeServer 0, 200, ->
            connected = true

        listener = new StreamListener "127.0.0.1", port, ""

        listener.connect 1000, (err) ->
            throw err if err
            expect(connected).to.be.true
            done()

    it "should time out if a server never appears", (done) ->
        listener = new StreamListener "127.0.0.1", 55556, ""

        listener.connect 1000, (err) ->
            expect(err).to.be.error
            done()
