MasterHelper = require "../helpers/master"

request = require "request"
_       = require "underscore"

describe "API: Streams", ->
    stream_config =
        key:                "test"
        source_password:    "abc123"
        root_route:         true
        seconds:            3600
        format:             "mp3"

    m = null
    before (done) ->
        MasterHelper.startMaster null, (err,obj) ->
            throw err if err
            m = obj
            done()

    it "should return an empty array for GET /streams", (done) ->
        request.get url:"#{m.api_uri}/streams", json:true, (err,res,json) ->
            throw err if err

            expect(json).to.be.instanceof Array
            expect(json).to.have.length 0
            done()

    it "rejects a POST to /streams that is missing a key", (done) ->
        invalid = {title:"Invalid Stream Config"}
        request.post url:"#{m.api_uri}/streams", json:true, body:invalid, (err,res,json) ->
            throw err if err
            expect(res.statusCode).to.be.eql 422
            expect(json.errors).to.have.length.gt 0

            done()

    it "creates a stream via a valid POST to /streams", (done) ->
        request.post url:"#{m.api_uri}/streams", json:true, body:stream_config, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200

            # test that stream exists inside our master
            expect(m.master.master.streams).to.have.key stream_config.key

            done()

    it "returns that stream via GET /streams", (done) ->
        request.get url:"#{m.api_uri}/streams", json:true, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200
            expect(json).to.be.instanceof Array
            expect(json).to.have.length 1
            expect(json[0].key).to.eql stream_config.key

            done()

    it "returns that stream via GET /stream/:stream", (done) ->
        request.get url:"#{m.api_uri}/streams/#{stream_config.key}", json:true, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200
            expect(json.key).to.eql stream_config.key

            done()

    it "returns config via GET /stream/:stream/config", (done) ->
        request.get url:"#{m.api_uri}/streams/#{stream_config.key}/config", json:true, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200

            # it will have other default config settings, but it should
            # include all the config we gave it
            expect(json).to.contain.all.keys stream_config

            done()

    it "allows stream config update via PUT /streams/:stream/config", (done) ->
        update      = seconds:7200
        change_back = seconds:stream_config.seconds

        request.put url:"#{m.api_uri}/streams/#{stream_config.key}/config", json:true, body:update, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200

            # should have all original config, except what we updated
            expect(json).to.contain.all.keys _.extend {}, stream_config, update

            # master should still know our stream
            expect(m.master.master.streams).to.have.key stream_config.key

            # now change it back
            request.put url:"#{m.api_uri}/streams/#{stream_config.key}/config", json:true, body:update, (err,res,json) ->
                throw err if err

                expect(res.statusCode).to.be.eql 200
                expect(json).to.contain.all.keys stream_config

                done()

    it "allows a stream to be deleted via DELETE /streams/:stream", (done) ->
        request.del url:"#{m.api_uri}/streams/#{stream_config.key}", json:true, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200

            # master should no longer know our stream
            expect(m.master.master.streams).to.not.have.key stream_config.key

            done()

    describe "Stream Key Change", ->
        stream_config =
            key:                "test"
            source_password:    "abc123"
            root_route:         true
            seconds:            3600
            format:             "mp3"

        new_key = "testing"

        m = null
        before (done) ->
            MasterHelper.startMaster null, (err,obj) ->
                throw err if err
                m = obj
                done()

        before (done) ->
            # create the stream
            request.post url:"#{m.api_uri}/streams", json:true, body:stream_config, (err,res,json) ->
                throw err if err
                done()

        it "allows a key change via PUT /streams/#{stream_config.key}/config", (done) ->
            update      = key:new_key

            request.put url:"#{m.api_uri}/streams/#{stream_config.key}/config", json:true, body:update, (err,res,json) ->
                throw err if err

                expect(res.statusCode).to.be.eql 200
                expect(json).to.contain.all.keys _.extend {}, update
                done()

        it "allows key to be changed back via PUT /streams/#{new_key}/config", (done) ->
            change_back = key:stream_config.key
            request.put url:"#{m.api_uri}/streams/#{new_key}/config", json:true, body:change_back, (err,res,json) ->
                throw err if err

                expect(res.statusCode).to.be.eql 200
                expect(json).to.contain.all.keys stream_config

                done()

    describe "Stream Groups", ->
