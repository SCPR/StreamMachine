MasterMode = $src "modes/master"

uuid    = require "node-uuid"
_       = require "underscore"

STREAMS =
    mp3:
        key:                "test"
        source_password:    "abc123"
        root_route:         true
        seconds:            60*60*4
        format:             "mp3"


module.exports =
    STREAMS:    STREAMS

    startMaster: (stream,extra_config,cb) ->
        if _.isFunction(extra_config)
            cb = extra_config
            extra_config = null

        s = STREAMS[stream]

        if stream && !s
            cb new Error "Invalid stream spec"
            return false

        master_config =
            master:
                port:       0
                password:   "zxcasdqwe"
            source_port:    0
            log:
                stdout:     false
            streams: {}

        sconfig = null

        if stream
            # generate a random stream key
            streamkey = uuid.v4()

            sconfig = master_config.streams[ streamkey ] = _.extend {}, s, key:streamkey

        new MasterMode _.extend(master_config,extra_config||{}), (err,m) ->
            throw err if err

            info =
                master:             m
                master_port:        m.handle.address().port
                source_port:        m.master.sourcein.server.address().port
                stream_key:         sconfig?.key
                source_password:    sconfig?.source_password
                slave_uri:          ""
                config:             master_config

            info.slave_uri  = "ws://127.0.0.1:#{info.master_port}?password=#{info.config.master.password}"
            info.api_uri    = "http://127.0.0.1:#{info.master_port}/api"

            cb null, info
