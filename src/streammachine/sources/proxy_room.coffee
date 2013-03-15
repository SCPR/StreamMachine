{EventEmitter}  = require "events"
Icecast = require("icecast-stack")
IcecastClient = require('icecast-stack/client')
_u = require('underscore')
Parser = require("../parsers/mp3")

util = require 'util'

module.exports = class ProxyRoom extends require("./base")
    DefaultOptions:
        url:     ""
        
    #----------
    
    TYPE: -> "Proxy (#{@url})"
    constructor: (@stream,options) ->
        @options = _u.defaults options||{}, @DefaultOptions
        
        super()
        
        @url            = @options.url
        @connected      = false
        @framesPerSec   = null
        
        @_in_disconnect = false
        
        @emit_duration  = 0.5
        
        @_chunk_queue = []
        
        @log = @stream.log
        
        @last_header = null
        
        # connection drop handling
        # (FIXME: bouncing not yet implemented)
        @_maxBounces    = 10
        @_bounces       = 0
        @_bounceInt     = 5
        
        @metaTitle = @options.metaTitle || null
        @metaURL = @options.metaURL || null
    
    #----------
    
    info: ->
        source:     @TYPE?() ? @TYPE
        connected:  @connected
        url:        @url
        stream_key: @stream_key
        uuid:       @uuid
    
    #----------
        
    connect: ->
        @log.debug "connecting to #{@url}"
        @icecast = IcecastClient.createClient @url, "user-agent":"StreamMachine 0.1.0"
        
        @icecast.on "close", =>
            console.log "proxy got close event"
            unless @_in_disconnect
                setTimeout ( => @connect() ), 5000
            
                @log.debug "Lost connection to #{@url}. Retrying in 5 seconds"
                @connected = false
            
        @icecast.on "metadata", (data) =>
            unless @_in_disconnect
                console.log "parsing ", data
                meta = Icecast.parseMetadata(data)
            
                if meta.StreamTitle
                    @metaTitle = meta.StreamTitle
            
                if meta.StreamUrl
                    @metaURL = meta.StreamUrl
                
                @emit "metadata", StreamTitle:@metaTitle, StreamUrl:@metaURL

        # attach mp3 parser for rewind buffer
        @parser = new Parser()
        
        # incoming -> Parser
        @icecast.on "data", (chunk) => @parser.write chunk
        
        # outgoing -> Stream
        @parser.on "frame", (frame) =>
            @emit "frame", frame

            # -- queue up frames until we get to @emit_duration -- #
            if @last_header
                # -- recombine frame and header -- #
                
                fbuf = new Buffer( @last_header.length + frame.length )
                @last_header.copy(fbuf,0)
                frame.copy(fbuf,@last_header.length)
                @_chunk_queue.push fbuf
                
                if @framesPerSec && ( @_chunk_queue.length / @framesPerSec > @emit_duration )
                    len = 0
                    len += b.length for b in @_chunk_queue
                
                    # make this into one buffer
                    buf = new Buffer(len)
                    pos = 0
                
                    for fb in @_chunk_queue
                        fb.copy(buf,pos)
                        pos += fb.length
                    
                    # reset chunk array
                    @_chunk_queue.length = 0
                
                    # emit new buffer
                    @emit "data", data:buf, ts:Number(new Date())
        
        # we need to grab one frame to compute framesPerSec
        @parser.on "header", (data,header) =>
            if !@framesPerSec || !@stream_key
                # -- compute frames per second -- #
                
                @framesPerSec = header.samplingRateHz / header.samplesPerFrame
                @log.debug "setting framesPerSec to ", frames:@framesPerSec
                @log.debug "first header is ", header
                
                # -- compute stream key -- #
                
                @stream_key = ['mp3',header.samplingRateHz,header.bitrateKBPS,(if header.modeName == "Stereo" then "s" else "m")].join("-")
                
            @last_header = data
            @emit "header", data, header

        # return with success
        @connected = true
        
    #----------
        
    disconnect: ->
        @_in_disconnect = true
        
        @icecast.removeAllListeners()
        @parser.removeAllListeners()
        @removeAllListeners()
        
        @icecast.destroy()        
        
        @parser = null
        @icecast = null
        
        console.log "Shut down proxy source using #{@url}"
    