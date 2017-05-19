COMMANDS =
    "source":   ["icecast_source2","Create an Icecast source connection"]
    "listener": ["stream_listener","Create a stream listener"]

args = require("yargs")
    .usage("Usage: $0 [command] [command args]")
    .help('h')
    .alias('h','help')
    .demand(1)

for k,v of COMMANDS
    do (k,v) ->
        args.command k, v[1], (yargs) ->
            args.$0 = "#{args.$0} #{k}"
            sm_util = require "./util/#{v[0]}"

args.argv
