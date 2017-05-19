StandaloneHelper = require "../helpers/standalone"
FileSource = $src "sources/file"
ProxySource = $src "sources/proxy"

debug = require("debug")("sm:tests:sources:proxy")

mp3 = $file "mp3/mp3-44100-128-s.mp3"

describe "Proxy Source", ->
    # we'll set up a standalone mode instance as our source
    sa_info = null
    standalone = null

    proxy = null

    before (done) ->
        debug "Starting standalone instance as source"
        StandaloneHelper.startStandalone 'mp3', (err,info) ->
            throw err if err

            sa_info = info
            standalone = info.standalone

            standalone.master.once_configured ->
                # connect a file source to the created stream
                debug "Creating file source for #{info.stream_key}"
                fsource = new FileSource filePath:mp3, format:"mp3", chunkDuration:0.1
                standalone.master.source_mounts[info.stream_key].addSource fsource, (err) ->
                    throw err if err
                    debug "File source connected."
                    done()

    it "connects to the URL given and streams data", (done) ->
        url = "http://127.0.0.1:#{sa_info.port}/#{sa_info.stream_key}"
        debug "Connecting proxy to #{url}"
        proxy = new ProxySource url:url, format:"mp3", chunkDuration:0.1
        proxy.once "connect", ->
            debug "Connected"

            proxy.once "_chunk", ->
                debug "Got data chunk"
                done()

    it "reconnects if the connection goes down", (done) ->
        # re-use the same connection. Disconnect from the standalone side and
        # then make sure we see a new connection
        stream = standalone.slave.streams[sa_info.stream_key]
        expect(Object.keys(stream._lmeta).length).to.eql 1

        proxy.once "connect", ->
            # we've reconnected
            debug "Reconnect successful"
            done()

        # disconnect
        l.obj.disconnect() for k,l of stream._lmeta
