# DEPRECATED

If you are in here because you're trying to understand KPCC's instance of StreamMachine, you're in the wrong place. This repo no longer is what's running in prod.

##

StreamMachine is an open-source streaming audio server aimed at pushing 
innovation for radio stations that have spent too many years running old 
technology like Shoutcast and Icecast.

The project has two goals: emulating the traditional streaming experience and 
building support for new features that push the radio listening experience 
forward.

## The Rewind Buffer

StreamMachine's big idea is keeping a big buffer of audio data in memory, 
allowing clients to connect to "nearly-live" radio. Because audio data is 
relatively small, a station can easily keep hours of audio in memory.  For 
instance, a 64k MP3 stream will store 8 hours of audio data in just a little 
over 200MB of memory.

Using the Rewind Buffer, players can add support for concepts like "Play 
the current program from its start", or "Play the 9am broadcast." Unlike 
podcasts, these functions are available immediately and keep the user connected 
to the station's live stream.

You can read more about the implementation of the 
[RewindBuffer in the wiki](https://github.com/StreamMachine/StreamMachine/wiki/RewindBuffer).

## Architecture

StreamMachine is a [Node.js](http://nodejs.org) application.  It can run on 
one server, or in a master-slave configuration for load-balancing. 
StreamMachine is designed for Node 0.10.

#### Configuration

Static configuration can be done via a JSON configuration file.  Configuration 
changes will not be written back to the file. 

For a dynamic configuration, StreamMachine can store its stream information on 
a [Redis](http://redis.io) server.

#### Incoming Audio

Two modes are supported for incoming audio:

* __Icecast Source:__ The `SourceIn` module emulates the Icecast server's 
	source handling, allowing source clients to connect to a mount point and 
	provide a source password.
	
* __Proxy:__ The `ProxyRoom` module can connect to an existing Icecast server 
	and proxy its stream through the StreamMachine infrastructure.  

#### Supported Formats

Currently, MP3 and AAC streams are supported. 

#### Operation Modes

StreamMachine can operate as a single process or in a master-slave configuration.

* __Standalone:__ One process manages both incoming and outgoing audio. For 
    development and small installations.
  
* __Master:__ Master handles source connections and configuration. Provides the 
    admin UI and centralizes logging from slave processes. Handles no client traffic.
  
* __Slave:__ Slave handles all client requests. Stream audio is proxied from the 
    master over a single socket connection.

For more, see the 
[Mode documentation in the wiki](https://github.com/StreamMachine/StreamMachine/wiki/Modes).

## Outputs

#### Traditional

The `RawAudio` and `Shoutcast` outputs provide traditional output streams.

#### New

The `Pumper` output allows a chunk of audio to be downloaded as quick as 
possible.  

The `Sockets` output creates an audio stream that can seek through the Rewind
Buffer without having to reconnect.

## Alerts

Alerts are intended to provide a heads-up when something's going wrong in 
the streaming process. A similar alert will fire when the condition is ended. 
Where logging is intended to signal an event, alerts are about signalling 
that a condition exists.

Alerts can be sent via email or [Pagerduty](http://pagerduty.com).

#### Sourceless Stream

Emits 30 seconds after a monitored stream loses its only source connection.

#### Disconnected Slave

Emits when a slave has been unable to connect to the master server for more 
than 30 seconds.

## Configuration

StreamMachine uses [nconf](https://github.com/flatiron/nconf) to load 
configuration settings from a JSON file, from environment variables and from 
the command line. 

For more, see the 
[full documentation of configuration options](https://github.com/StreamMachine/StreamMachine/wiki/Configuration-settings).

## Getting Started

StreamMachine isn't the most user-friendly piece of software to install at the 
moment, but there are two options for quickly getting something running that 
you can play with:

#### Running Locally

To run StreamMachine locally with no service dependencies, try the included `config/standalone.json`. To do so:

* Install Node.js v0.10
* Download the StreamMachine repository
* Run `npm install` to install the Node modules that we depend on
* Run `./streammachine-cmd --config ./config/standalone.json` to start the StreamMachine service

Connect to the admin by going to http://localhost:8001/admin and using admin/admin. There is an 
MP3 stream configured at /test, with the source password "testing".  The source input listener is 
on port 8002, and that is where the broadcast should be pointed.

#### Vagrant

You can also [use the Vagrantfile included in streammachine-cookbook](https://github.com/StreamMachine/streammachine-cookbook) 
to install a standalone configuration in a virtual machine.

## Who?

StreamMachine was developed by [Eric Richardson](http://ewr.is) (e@ewr.is) 
while at [Southern California Public Radio](http://scpr.org). 
