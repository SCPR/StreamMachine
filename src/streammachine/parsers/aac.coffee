strtok = require('strtok')
assert = require("assert")

PROFILES = [
    "Null",
    "AAC Main"
    "AAC LC"
    "AAC SSR"
    "AAC LTP"
    "SBR"
    "AAC Scalable"
    "TwinVQ"
]

SAMPLE_FREQUENCIES = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350
]

CHANNEL_COUNTS = [
    0,1,2,3,4,5,6,8
]


module.exports = class AAC extends require("stream").Writable

    FIRST_BYTE = new strtok.BufferType(1)

    constructor: ->
        super

        # create an internal stream to pass to strtok
        @istream = new (require("events").EventEmitter)

        @outbuf = []

        # set up status
        @frameSize = -1
        @beginning = true
        @gotFF = false
        @byteTwo = null
        @frameHeader = null
        @isCRC = false

        @id3v2 = null
        @_parsingId3v2 = false
        @_finishingId3v2 = false
        @_id3v2_1 = null
        @_id3v2_2 = null

        #@on "frame", (frame) =>
        #    @outbuf.push frame

        strtok.parse @istream, (v,cb) =>
            # -- initial request -- #

            if v == undefined
                # we need to examine each byte until we get a FF
                return FIRST_BYTE

            # -- frame header -- #

            if @frameSize == -1 && @frameHeader
                # we're on-schedule now... we've had a valid frame.
                # buffer should be seven or nine bytes

                try
                    h = @parseFrame(v)
                catch e
                    # uh oh...  bad news
                    console.log "invalid header... ", v, @frameHeader
                    @frameHeader = null
                    return FIRST_BYTE

                @frameHeader = h
                @emit "header", v, h
                @frameSize = @frameHeader.frame_length

                if @frameSize == 1
                    # problem...  just start over
                    console.log "Invalid frame header: ", h
                    return FIRST_BYTE
                else
                    return new strtok.BufferType(@frameSize - v.length);

            # -- first header -- #

            if @gotFF and @byteTwo
                buf = new Buffer(2+v.length)
                buf[0] = 0xFF
                buf[1] = @byteTwo
                v.copy(buf,2)

                try
                    h = @parseFrame(buf)
                catch e
                    # invalid header...  chuck everything and try again
                    console.log "chucking invalid try at header: ", buf
                    @gotFF = false
                    @byteTwo = null
                    return FIRST_BYTE

                # valid header...  we're on schedule now
                @gotFF = false
                @byteTwo = null
                @beginning = false

                @frameHeader = h
                @emit "header", buf, h
                @frameSize = @frameHeader.frame_length

                @isCRC = h.crc

                if @frameSize == 1
                    # problem...  just start over
                    console.log "Invalid frame header: ", h

                    return FIRST_BYTE
                else
                    console.log "On-tracking with frame of: ", @frameSize - buf.length
                    return new strtok.BufferType(@frameSize - buf.length);

            if @gotFF
                if v[0]>>4 == 0xF
                    @byteTwo = v[0]

                    # make sure the layer bits are zero...  still need to make
                    # sure we're on a valid header

                    if (v[0] & 6) == 0
                        # good... both zeros...

                        # we need to figure out whether we're looking for CRC.  If
                        # not, we need five more bytes for the header.  If so, we
                        # need seven more. 1 == No CRC, 0 == CRC

                        return new strtok.BufferType( if (v[0] & 1) == 1 then 5 else 7 )
                    else
                        @gotFF = false

                else
                    @gotFF = false

            if @frameSize == -1 && !@gotFF
                if v[0] == 0xFF
                    # possible start of frame header. need next byte to know more
                    @gotFF = true
                    return FIRST_BYTE
                else
                    # keep looking
                    return FIRST_BYTE

            # -- data frame -- #

            @emit "frame", v

            @frameSize = -1

            # what's next depends on whether we've been seeing CRC
            return new strtok.BufferType( if @isCRC then 9 else 7 )

    #----------

    _write: (chunk,encoding,callback) ->
        @istream.emit "data", chunk
        callback?()

    #----------

    _flush: (cb) ->
        console.log "Parser: got flush."

    #----------

    parseFrame: (b) ->
        assert.ok Buffer.isBuffer(b)
        assert.ok b.length >=7

        # -- first twelve bits must be FFF -- #

        assert.ok ( b[0] == 0xFF && (b[1] >> 4) == 0xF ), "Buffer does not start with FFF"

        # -- is this a CRC Frame? -- #

        no_crc          = b[1] & 0x1

        mpeg_2          = b[1] & 0x8

        # -- AAC Stream Info -- #

        obj_type        = b[2] >> 6
        sample_freq     = b[2] >> 2 & 0xE

        channels        = (b[2] & 1) << 2 | b[3] >> 6

        # -- Frame Length -- #

        frame_length    = (b[3] & 0x3) << 11 | b[4] << 3 | b[5] >> 5

        # -- Buffer Fullness -- #

        buffer_full     = (b[5] & 0x1F) << 6 | b[6] >> 2
        num_frames      = (b[6] & 0x3) + 1

        # -- CRC Checksum -- #

        if !no_crc
            true

        # -- Compile Header -- #

        header =
            crc:                !no_crc
            mpeg_type:          if mpeg_2 then "MPEG2" else "MPEG4"
            profile:            obj_type + 1
            profile_name:       PROFILES[ obj_type + 1]
            sample_freq:        SAMPLE_FREQUENCIES[sample_freq]
            channel_config:     channels
            channels:           CHANNEL_COUNTS[ channels ]
            frame_length:       frame_length
            buffer_fullness:    buffer_full
            number_of_frames:   num_frames

