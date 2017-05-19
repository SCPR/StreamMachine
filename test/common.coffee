StreamMachine   = require "../src/streammachine"
nconf           = require "nconf"

chai            = require "chai"
global.expect   = chai.expect

nconf.env().argv()
nconf.defaults StreamMachine.Defaults

path = require "path"

if process.env['SM_TEST_JS']
    global.$src     = (module) -> require path.resolve(__dirname,"..","js","src","streammachine",module)
else
    global.$src     = (module) -> require path.resolve(__dirname,"..","src","streammachine",module)

global.$file    = (file) -> path.resolve(__dirname,"files",file)
