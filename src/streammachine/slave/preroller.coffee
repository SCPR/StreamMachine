_u = require "underscore"
http = require "http"
url = require "url"

module.exports = class Preroller
    DefaultOptions:
        server:     null
        path:       "/p"

    constructor: (@stream,@key,uri) ->
        #@options = _u.defaults opts||{}, @DefaultOptions

        @_counter = 1

        # make sure this is a valid URI
        @uri = url.parse uri

        if @uri.protocol != "http:"
            @stream.log.error("Preroller only supports HTTP connections.")
            return false

        # -- need to look at the stream to get characteristics -- #

        @stream.log.debug "waiting to call getStreamKey"

        _skFunc = (source) =>
            source.source.getStreamKey (@streamKey) =>
                @stream.log.debug "Preroller: Stream key is #{@streamKey}"

        if @stream.source
            _skFunc(@stream.source)

        else
            @stream.once "source", (source) => _skFunc(source)

    #----------

    pump: (socket,writer,cb) ->
        # short-circuit if we haven't gotten a stream key yet
        if !@streamKey
            cb?()
            return true

        # short-circuit if the socket has already disconnected
        if socket.destroyed
            cb?()
            return true

        count = @_counter++

        # -- make a request to the preroll server -- #

        opts =
            host:       @uri.host
            path:       [@uri.path,@key,@streamKey].join("/")
        @stream.log.debug "firing preroll request", count
        req = http.get opts, (res) =>
            @stream.log.debug "got preroll response ", count
            if res.statusCode == 200
                # stream preroll through to the output
                res.on "data", (chunk) =>
                    writer?.write(chunk)

                # when preroll is done, call the output's callback
                res.on "end", =>
                    socket.removeListener "close", conn_pre_abort
                    socket.removeListener "end", conn_pre_abort
                    cb?()
                    return true

            else
                socket.removeListener "close", conn_pre_abort
                socket.removeListener "end", conn_pre_abort
                cb?()
                return true

        req.on "socket", (sock) =>
            @stream.log.debug "socket granted for ", count

        req.on "error", (err) =>
            @stream.log.debug "got a request error for ", count, err

        # attach a close listener to the response, to be fired if it gets
        # shut down and we should abort the request

        conn_pre_abort = =>
            if socket.destroyed
                @stream.log.debug "aborting preroll ", count
                req.abort()

        socket.once "close", conn_pre_abort
        socket.once "end", conn_pre_abort


    #----------

    connect: ->


    #----------

    disconnect: ->

    #----------
