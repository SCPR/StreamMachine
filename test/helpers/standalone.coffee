StandaloneMode = $src "modes/standalone"
StreamHelper = require "./stream"

uuid    = require "node-uuid"
_       = require "underscore"

module.exports =
    startStandalone: (stream,cb) ->
        s = null
        if stream
            s = StreamHelper.getStream stream

        config =
            chunk_duration: 0.25
            port:           0
            source_port:    0
            log:
                stdout:     false
            streams: {}

        config.streams[s.key] = s if s

        new StandaloneMode config, (err,sa) ->
            throw err if err

            info =
                standalone:         sa
                port:               sa.handle?.address().port
                source_port:        sa.master.sourcein.server.address().port
                stream_key:         s?.key
                source_password:    s?.source_password
                slave_uri:          ""
                config:             config

            info.api_uri    = "http://127.0.0.1:#{info.port}/api"

            cb null, info
