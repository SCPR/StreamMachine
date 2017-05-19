## StreamMachine Roadmap

* __Replace Stream Groups with Multi-Variant Streams:__ The stream group
    concept was a hack to get HLS variants up and running quickly. It
    should be replaced with a stream that can produce multiple variants.

* __Separate Streams and Source Mounts:__ Currently a source connects to
    a stream or stream group. It makes sense to allow source mounts to be
    specified independently, so that one source mount can be used for
    multiple streams.

* __Add Support for a Source Stream with Timestamps:__ We want to write an
    encoder that would include timestamps on the source side, carrying them
    over from our broadcast systems. To do so, we need to spec and implement
    timestamp-bearing source support in StreamMachine. This would preferably
    be an existing standard such as RTP, but could be a new format if
    implementation would be far easier.

* __Rebuild Storage around HLS Segments:__ Currently, HLS segments are a
    mapping on top of the RewindBuffer storage layer, which is implemented as
    an in-memory array. Storing the rewind buffer to disk currently means
    reversing it to store most-recent data first, so that loads are ready to
    serve as quickly as possible.

    This project would rebuild our primary storage mechanism around HLS-style
    segments, and would implement Shoutcast-style streaming as a compatibility
    layer on top. The goal is to handle segment persistence on a per-segment
    basis, reducing the IO load from Dump/Restore and allowing more direct
    access to segments based on ID and timestamp rather than always needing
    to look up offset numbers.
