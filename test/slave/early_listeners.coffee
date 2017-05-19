# When a slave starts up, it will accept incoming connections right away,
# even though it won't have any workers ready to go. We need to make sure that
# those early listeners end up making it through to the worker and that their
# requests succeed.

debug = require("debug")("sm:tests:slave_early_listeners")

MasterHelper = require "../helpers/master"
SlaveHelper = require "../helpers/slave"

StreamListener  = $src "util/stream_listener"
IcecastSource   = $src "util/icecast_source"

_ = require "underscore"

mp3 = $file "mp3/mp3-44100-128-s.mp3"

describe "Slave Early Listeners", ->
    master_info = null
    slave_info  = null
    slave       = null

    before (done) ->
        MasterHelper.startMaster "mp3", (err,info) ->
            throw err if err
            master_info = info

            debug "Master URI is #{ master_info.slave_uri }"
            debug "Stream key is #{ master_info.stream_key }"

            # connect a source
            source = new IcecastSource
                format:     "mp3"
                filePath:   mp3
                host:       "127.0.0.1"
                port:       master_info.source_port
                password:   master_info.source_password
                stream:     master_info.stream_key

            source.start (err) ->
                throw err if err

                debug "Stream source is connected."

                done()

    before (done) ->
        SlaveHelper.startSlave master_info.slave_uri, 0, (err,info) ->
            throw err if err
            slave_info = info
            slave = slave_info.slave
            done()

    listener = null

    it "should immediately accept a listener connection", (done) ->
        listener = new StreamListener "127.0.0.1", slave_info.port, master_info.stream_key

        # swallow anything that fires after our first response
        done = _.once done

        listener.connect (err) ->
            # we shouldn't get a response yet, so anything here is an error
            done err||new Error("Unexpected listener response")

        listener.once "socket", (sock) ->
            # give a tiny amount of time to make sure we don't get a response
            sock.once "connect", ->
                setTimeout ->
                    expect(slave.pool.loaded_count()).to.eql 0
                    done()
                , 100

    it "should get a response once a worker is ready", (done) ->
        this.timeout 4000

        listener.once "connected", (err) ->
            throw err if err
            done()

        # now resize the slave to get a worker
        slave.pool.size = 1
        slave.pool._spawn()

    it "should start feeding data to the listener", (done) ->
        this.timeout 4000
        
        listener.once "bytes", ->
            done()
