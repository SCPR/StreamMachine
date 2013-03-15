_u = require "underscore"
uuid = require "node-uuid"

#Rewind = require('../rewind_buffer')
Proxy = require('../sources/proxy_room')

# Master streams are about source management. 

# Events:
# * source: emits when a source is promoted to active
# * add_source: emits when a source is added to the source list, but not made active
# * disconnect: emits when a source disconnects. `active` boolean indicates whether 
#   this was the live source. `count` integer indicates remaining sources

module.exports = class Stream extends require('events').EventEmitter
    constructor: (@core,@key,@log,@opts)->
        @sources = []
        @source = null
        
        @emit_duration = 0
        
        @STATUS = "Initializing"
        
        @i = 0
        
        # set up a rewind buffer
        #@rewind = new Rewind @, @opts.rewind
        
        @metaFunc = (meta) => @emit "metadata", meta
        @headFunc = (head) => @emit "header", head

        # merge in an incrementing value per-chunk
        @dataFunc = (data) => 
            @emit "data", _u.extend { i:@i }, data
            @i += 1
        
        # -- Hardcoded Source -- #
        
        # This is an initial source like a proxy that should be connected from 
        # our end, rather than waiting for an incoming connection
        
        if opts.source?
            console.log "Connecting initial source"
            newsource = new Proxy @, opts.source
            newsource.connect()
            @addSource newsource, (result) =>
                if result
                    @log.debug "Source connected."
                else
                    @log.error "Source connection failed."
                    
        # -- Listener Tracking -- #
        
        # We track listener counts from each slave. They get reported by 
        # the slave to the master, which then calls recordSlaveListeners 
        # to record them here.
        
        # We need to also get rid of old counts from a slave that goes 
        # offline, though, so we attach an interval function to remove 
        # numbers that haven't been updated in the last two minutes.
        
        @_listeners = {}
        
        setInterval =>
            now = Number(new Date)
            for s,c of @_listeners
                delete @_listeners[s] if now - (120 * 1000) > c.last_at||0
        , 60 * 1000

    #----------
    
    status: (detailed=false)->
        if detailed
            stream:             @key
            sources:            ( s.info() for s in @sources )
            listeners:          @listeners()
            listeners_by_slave: @listenersBySlave()            
            
        else
            stream:     @key
            listeners:  @listeners()
            sources:    ( s.info() for s in @sources )
    
    #----------
    
    addSource: (source,cb) ->
        # set the source's UUID
        source.setUUID uuid.v4()
        
        # add a disconnect monitor
        source.once "disconnect", =>
            # remove it from the list
            @sources = _u(@sources).without @source
            
            # was this our current source?
            if @source == source
                # yes...  need to promote the next one (if there is one)
                if @sources.length > 0
                    @useSource @sources[0]                    
                    @emit "disconnect", active:true, count:@sources.length, source:@source
                else
                    @log.debug "Source disconnected. None remaining."
                    @emit "disconnect", active:true, count:0, source:@source
            else
                # no... just remove it from the list
                @emit "disconnect", active:false, count:@sources.length, source:@source
        
        # check whether this source should be made active. It should be if 
        # the active source is defined as a fallback
        
        if !@sources[0] || @sources[0]?.options.fallback
            # go to the front
            @log.debug "Promoting new source to replace fallback."
            @useSource source, cb
        else
            # add the source to the end of our list
            @log.debug "Sticking new source on the end of the list."
            @sources.push source
        
            # and emit our source event
            @emit "add_source", source
            
            cb?()
            
    #----------

    useSource: (newsource,cb=null) ->
        # stash our existing source if we have one
        old_source = @source || null

        # set a five second timeout for the switchover
        alarm = setTimeout =>
            @log.debug "Failed to get source switchover in five seconds"
            cb?(false)
        , 5000
        
        # Look for a header before switching
        newsource.once "header", =>
            if old_source
                # unhook from the old source's events
                old_source.removeListener "metadata",   @metaFunc
                old_source.removeListener "data",       @dataFunc
                old_source.removeListener "header",     @headFunc
                    
            @source = newsource
                    
            # connect to the new source's events
            newsource.on "metadata",   @metaFunc
            newsource.on "data",       @dataFunc
            newsource.on "header",     @headFunc
            
            # how often will we be emitting?
            @emit_duration = @source.emit_duration
                
            # note that we've got a new source
            process.nextTick =>
                console.log "emit source event"
                @emit "source", newsource

            # jump our new source to the front of the list (and remove it from
            # anywhere else in the list)
            @sources = _u.flatten [newsource,_u(@sources).without newsource]
            
            # cancel our timeout
            clearTimeout alarm
            
            # give the a-ok to the callback
            cb?(true)
            
    #----------
    
    promoteSource: (uuid,cb) ->
        # do we have a source with this UUID?
        if ns = _u(@sources).find( (s) => s.uuid == uuid )
            # we do... 
            # make sure it isn't already the active source, though
            if ns == @sources[0]
                # it is.  nothing to be done.
                cb? "Source is already active"
            else
                # it isn't. we can try to promote it
                @useSource ns, (status) =>
                    if status
                        cb? null, msg:"Promoted source to active.", uuid:uuid
                    else
                        cb? "Source promotion hit five second timeout."
        else
            cb? "Unable to find a source with that UUID on #{@key}"
    
    #----------
    
    configure: (opts) ->
        # there's not currently any configuration done here on the master side
        
    #----------
    
    listeners: ->
        total = 0
        total += c.count for s,c of @_listeners
        total
        
    listenersBySlave: ->
        @_listeners
    
    #----------
    
    recordSlaveListeners: (slave,count) ->
        if !@_listeners[slave]
            @_listeners[slave] = count:0, last_at:null
            
        @_listeners[slave].count = count
        @_listeners[slave].last_at = Number(new Date)
    
    #----------
        
    destroy: ->
        # shut down our sources and go away
        s.disconnect() for s in @sources
        true
        