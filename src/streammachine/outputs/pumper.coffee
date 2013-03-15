_u = require 'underscore'

module.exports = class Pumper
    constructor: (stream,req,res) ->
        @req = req
        @res = res
        @stream = stream                
        
        # figure out what we're pulling
        playHead = @stream.checkOffset req.param("from") || req.param("pump")
        console.log "requested offset of #{ req.query.from || req.query.pump } seconds. providing #{playHead} chunks."
        
        # grab our pump buffer
        pumpBuf = @stream.pumpFrom playHead, req.param("pump")
                
        secs = playHead / @stream.rewind.framesPerSec
        @stream.log.debug output:"pump", seconds:secs, bytes:pumpBuf.length, "Pumping"
        
        headers = 
            "Content-Type":         "audio/mpeg"
            "Connection":           "close"
            "Content-Length":       pumpBuf.length
        
        # write out our headers
        res.writeHead 200, headers
        
        # send our pump buffer to the client
        @res.end pumpBuf
