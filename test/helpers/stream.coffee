uuid    = require "node-uuid"
_ = require "underscore"

debug = require("debug")("sm:tests:helpers:stream")

STREAMS =
    mp3:
        key:                "test"
        source_password:    "abc123"
        root_route:         true
        seconds:            60*60*4
        format:             "mp3"


module.exports =
    getStream: (stream) ->
        return null if !stream

        s = STREAMS[stream]

        throw new Error "Invalid stream spec" if !s

        # generate a random stream key
        streamkey = uuid.v4()

        _.extend {}, s, key:streamkey
