_u = require 'underscore'
moment = require 'moment'

module.exports = class LiveStreaming
    constructor: (@stream,@req,@res,@opts) ->
        @secs_per_ts = 10
        @chunks_per_ts = @secs_per_ts / @stream._rsecsPerChunk
        
        # opts.ts will be the increment number for the start of our chunk
        # we'll need to look at the ID from the end of the buffer to see 
        # how far back we're seeking
        last_id= @stream._rbuffer[ @stream._rbuffer.length - 1 ]?.i
        offset = last_id - @opts.ts
                
        headers = 
            "Content-Type":         "audio/mpeg"
        
        # write out our headers
        res.writeHead 200, headers
        
        # need to insert an id3 tag with com.apple.streaming.transportStreamTimestamp
        
        # ID3 (04 00:version) (00:flags) (00 00 00 63:size)
        # Frame:  PRIV (00 00 00 53:size) (00 00:flags)
        
        @res.end @stream.pumpFrom(offset,@chunks_per_ts)
    
    #----------
    
    class @Index
        constructor: (@stream,@req,@res,@opts) ->
            @secs_per_ts = 10
            
            # query the rewind buffer to find out how many segments we should 
            # present in the index. we need a globally incrementing integer 
            # for the seguence ID.
            
            first_id = @stream._rbuffer[0]?.i
            
            # the rewind buffer has chunks of ~0.5 seconds.  We want to present 
            # roughly 10 second chunks
            
            @chunks_per_ts = @secs_per_ts / @stream._rsecsPerChunk
            
            # we can only start with a chunk that is on an even chunks_per_ts 
            # bound (0, 20, etc)
            
            @first_chunk = Math.ceil( first_id / @chunks_per_ts ) * @chunks_per_ts
            
            @last_chunk = Math.floor( @stream._rbuffer[ @stream._rbuffer.length - 1 ]?.i / @chunks_per_ts ) * @chunks_per_ts
            
            # figure out the start time
            max_chunk = @stream._rbuffer[ @stream._rbuffer.length - 1 ]?.i
            now = Number(new Date())
                        
            # now iterate through each ts
            
            headers = 
                "Content-Type":         "application/x-mpegURL"
            
            @res.writeHead 200, headers
            
            @res.write """
            #EXTM3U
            #EXT-X-VERSION:3
            #EXT-X-TARGETDURATION:#{@secs_per_ts}
            #EXT-X-MEDIA-SEQUENCE:#{(@first_chunk / @chunks_per_ts) + 1}
            
            
            """
            
            
            for chunk in _u.range(@first_chunk,@last_chunk,@chunks_per_ts)
                #i = chunk / @chunks_per_ts
                
                # get the timestamp of the chunk
                #ts = @stream._rbuffer[chunk]?.ts
                timestamp = now - ( (max_chunk - chunk) * @stream._rsecsPerChunk * 1000 )
                
                @res.write """
                #EXTINF:#{@secs_per_ts}
                #EXT-X-PROGRAM-DATE-TIME:#{moment(timestamp).format("YYYY-MM-DDTHH:mm:ssZ")}
                http://#{@opts.host}/#{@stream.key}?ts=#{chunk}
                
                """
                
            @res.end()
            
            
            