
# Logging

## Shoutcast

Use the `Rewinder` interval timer to send listen events every 30 seconds with
duration and bytes.

_TODO:_ Skip sessions that don't get to 60 seconds? Easy to do for Shoutcast.

## HTTP Live Streaming

### Session Start

On master playlist request, we look for the `X-Playback-Session-Id` header.
If not found, we generate a session ID. We record a zero-duration listen
event with the stream set to the stream group key.

### Stream Playlist

Carries the session id through if it is in the URL. Does not record any
stats of its own.

### Segment

Record the send as a listen event with bytes and duration. Set stream to
the stream that we are delivering.

# Processing

## Listens to Sessions

When a session has been inactive for 5 (10? X?) minutes, check the sessions
table to make sure we haven't already finalized this session. If we have
not, query all listen events for the session ID and sum the bytes and
duration.  Also compute the difference between the initial event time and
the final listen time.

If we have previously finalized the session, do the same thing but for
listen events that are newer than the timestamp of the finalized session.

If delivered duration is less than one minute, ignore the session.

Write the session to the sessions table using the stream key of the first
listen event (stream group for HLS master; stream for shoutcast).

_QUESTION:_ Is listening time the duration delivered, or the elapsed time
between the first and last listen events?

#### What Sessions are Inactive?

On Analytics startup, get the timestamp of the last finalized session.
Query `session_id,max(time)` grouped by session id.  Active sessions are
those that have a max time within the last five minutes.  Sessions that
should be finalized are those that have a max time between the timestamp
of the last finalized session and five minutes ago.



## Counting Listeners

Options:

* Query distinct session ids, grouped by minute?
* Sum duration grouped by minute, divide by 60? (Similar to cube stats)

_QUESTION:_ How could either of these skip stats for HLS listeners with
sessions less than one minute? Does that matter?


## Other Stats?

### AQH

Would need to take finalized sessions and apportion listening to quarter-hour
buckets.

### ATSL

`sessions.duration / count(sessions)`?