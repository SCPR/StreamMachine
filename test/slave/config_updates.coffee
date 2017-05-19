_ = require "underscore"

Slave       = $src "slave"
Logger      = $src "logger"

MasterHelper    = require "../helpers/master"

# Test that stream config changes on master propagate correctly to a slave

describe "Slave Config Updates", ->
    master_info = null
    slave       = null

    before (done) ->
        # unfortunately, to test slave mode, we need a master. that means
        # we get to do a lot here that hopefully gets tested elsewhere

        MasterHelper.startMaster "mp3", (err,info) ->
            throw err if err
            master_info = info
            done()

    before (done) ->
        this.timeout 4000
        # start our slave
        config =
            slave:
                master: master_info.slave_uri
            port: 0
            logger: new Logger stdout:false

        slave = new Slave config

        slave.once_configured ->
            done()

    it "has the initial stream information", (done) ->
        expect(Object.keys(slave.streams)).to.have.length 1
        expect(slave.streams).to.have.key master_info.stream_key
        done()

    describe "Updates", ->
        it "gets a config update from master", (done) ->
            # find our stream on master
            stream = master_info.master.master.streams[ master_info.stream_key ]

            # submit an update
            master_info.master.master.updateStream stream, seconds:1234, (err,config) ->
                throw err if err

                # we now expect the config update to arrive in the slave worker
                slave.once "streams", ->
                    expect(slave.streams[master_info.stream_key].opts.seconds).to.eql 1234
                    done()

    describe "Creation and Deletion", ->
        new_key = null
        it "gets a new stream from master", (done) ->
            config = _.clone(MasterHelper.STREAMS.mp3)
            new_key = config.key = config.key + "_new"

            master_info.master.master.createStream config, (err,status) ->
                throw err if err

                # we now expect this new stream to arrive on the slave
                slave.once "streams", ->
                    expect(slave.streams).to.have.keys [master_info.stream_key,config.key]
                    done()

        it "deletes a stream when it is removed on master", (done) ->
            # we'll delete the stream we just created
            stream = master_info.master.master.streams[ new_key ]

            master_info.master.master.removeStream stream, (err) ->
                throw err if err

                slave.once "streams", ->
                    expect(slave.streams).to.have.key master_info.stream_key
                    done()
