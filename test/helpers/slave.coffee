SlaveMode = $src "modes/slave"

module.exports =
    startSlave: (master_uri,count,cb) ->

        config =
            slave:
                master: master_uri
            port:       0
            cluster:    count
            log:
                stdout: false

        new SlaveMode config, (err,s) ->
            throw err if err

            slave_info =
                slave: s
                port:  s.slavePort()

            cb null, slave_info
