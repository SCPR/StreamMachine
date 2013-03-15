express = require "express"
_u = require("underscore")
util = require 'util'
fs = require 'fs'
path = require 'path'

module.exports = class Server extends require('events').EventEmitter
    DefaultOptions:
        core:           null
        slave_mode:     false
        mount_admin:    true
    
    constructor: (opts) ->
        @opts = _u.defaults opts||{}, @DefaultOptions
        
        @core = @opts.core
        
        @server = express()
        @server.httpAllowHalfOpen = true
        @server.useChunkedEncodingByDefault = false
                                    
        @server.use (req,res,next) => @streamRouter(req,res,next)
        
    #----------
    
    listen: (port) ->
        console.log "Start listening"
        @hserver = @server.listen port
        @io = require("socket.io").listen @hserver
        @emit "io_connected", @io
        @hserver
        
    #----------
        
    stopListening: ->
        console.log "stopListening"
        @hserver?.close => console.log "listening stopped."
    
    #----------
    
    streamRouter: (req,res,next) ->
        res.removeHeader("X-Powered-By");
    
        # -- default routes -- #
                    
        # default URL (and also a mapping for weird stream.nsv route)
        if @core.root_route && (req.url == '/' || req.url == "/;stream.nsv" || req.url == "/;")
            # pretend the request came in on the default stream
            req.url = "/#{@core.root_route}"
        
        # default playlist
        if @core.root_route && req.url == "/listen.pls"
            req.url = "/#{@core.root_route}.pls"
        
        # -- utility routes -- #
    
        # index.html
        if req.url == "/index.html"
            res.writeHead 200,
                "content-type": "text/html"
                "connection": "close"
        
            res.end """
                    <html>
                        <head><title>StreamMachine</title></head>
                        <body>
                            <h1>OK</h1>
                        </body>
                    </html>
                    """
        
            return true
        
        # crossdomain.xml
        if req.url == "/crossdomain.xml"
            res.writeHead 200, 
                "content-type": "text/xml"
                "connection": "close"
            
            res.end """
                    <?xml version="1.0"?>
                    <!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">
                    <cross-domain-policy>
                    <allow-access-from domain="*" />
                    </cross-domain-policy>
                    """
        
            return true
        
        # -- Stream Routing -- #
        
        # does the request match one of our streams?
        if m = ///^\/(#{_u(@core.streams).keys().join("|")})(?:\.(mp3|pls|m3u8))?///.exec req.url     
            res.header("X-Powered-By","StreamMachine")
        
            #console.log "match is ", m
            stream = @core.streams[ m[1] ]
        
            # fend off any HEAD requests
            if req.method == "HEAD"
                res.writeHead 200, 
                    "content-type": "audio/mpeg"
                    "connection":   "close"
                
                res.end()
                return true
        
            # -- Handle playlist request -- #
            
            #console.log "format is ", m[2]
        
            if m[2] && m[2] == "pls"
                host = req.headers?.host || stream.options.host
            
                res.writeHead 200,
                    "content-type": "audio/x-scpls"
                    "connection":   "close"
                                    
                res.end("[playlist]\nNumberOfEntries=1\nFile1=http://#{host}/#{stream.key}/\n")
                return true
                
            # -- HTTP Live Streaming Playlist -- #
            
            if m[2] && m[2] == "m3u8"
                new @core.Outputs.live_streaming.Index stream, req, res, host:(req.headers?.host || stream.options.host)
                return true
        
            # -- Stream match! -- #
        
            if req.param("socket")
                # socket listener
                @core.sockets.addListener stream,req,res
                
            else if req.param("pump")
                # pump listener pushes from the buffer as fast as possible
                new @core.Outputs.pumper stream, req, res
                
            else if req.param("ts")
                # return a LiveStreaming ts chunk
                new @core.Outputs.live_streaming stream, req, res, ts:req.param("ts")
                
            else
                # normal live stream (with or without shoutcast)
                if req.headers['icy-metadata']
                    # -- shoutcast listener -- #
                    new @core.Outputs.shoutcast stream, req, res
                else
                    # -- straight mp3 listener -- #
                    new @core.Outputs.mp3 stream, req, res
            
        else
            @core.log.debug "Not Found", req:req
            next()