# RPC Requests

Valid communications between StreamMachine's master and slaves.

## Master to Slave

### config

Broadcast of an updated config. Slave is expected to reconfigure itself accordingly.

_Expected response:_ None

### status

Request for a stream status report. Used in slave sync checks.

_Expected response:_ Hash containing timing information for the slave's stream rewind buffers.

### audio

Broadcast of a chunk of stream audio data. Sent as `{stream:KEY,chunk:chunk}`.

_Expected Response:_ None

## Slave to Master

### ok

Part of the initial connection handshake.

_Expected response:_ "OK"

### vitals

Request for a stream's "vitals" (ie emit duration and stream key).

_Expected response:_ Vitals hash

### log

Log entry being proxied to master. Expects an object with `level`, `msg` and `meta`

_Expected Response:_ None

### interaction

Analytics event being proxied to master.