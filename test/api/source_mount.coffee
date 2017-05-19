MasterHelper = require "../helpers/master"

request = require "request"
_       = require "underscore"

describe "API: Source Mounts", ->
    mount_config =
        key:        "test"
        password:   "abc123"
        format:     "mp3"

    m = null
    before (done) ->
        MasterHelper.startMaster null, (err,obj) ->
            throw err if err
            m = obj
            done()

    it "should return an empty array for GET /sources", (done) ->
        request.get url:"#{m.api_uri}/sources", json:true, (err,res,json) ->
            throw err if err

            expect(json).to.be.instanceof Array
            expect(json).to.have.length 0
            done()

    it "rejects a POST to /sources that is missing a key", (done) ->
        invalid = {title:"Invalid Source Config"}
        request.post url:"#{m.api_uri}/sources", json:true, body:invalid, (err,res,json) ->
            throw err if err
            expect(res.statusCode).to.be.eql 422
            expect(json.errors).to.have.length.gt 0

            done()

    it "creates a source mount via a valid POST to /sources", (done) ->
        request.post url:"#{m.api_uri}/sources", json:true, body:mount_config, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200

            # test that stream exists inside our master
            expect(m.master.master.source_mounts).to.have.key mount_config.key

            done()

    it "returns that source mount via GET /sources/:source", (done) ->
        request.get url:"#{m.api_uri}/sources/#{mount_config.key}", json:true, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200
            expect(json.key).to.eql mount_config.key

            done()

    it "returns config via GET /sources/:source/config", (done) ->
        request.get url:"#{m.api_uri}/sources/#{mount_config.key}/config", json:true, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200

            # it will have other default config settings, but it should
            # include all the config we gave it
            expect(json).to.contain.all.keys mount_config

            done()

    it "allows source mount config update via PUT /sources/:source/config", (done) ->
        update      = password:"zxcvbnm"
        change_back = seconds:mount_config.password

        request.put url:"#{m.api_uri}/sources/#{mount_config.key}/config", json:true, body:update, (err,res,json) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200

            # should have all original config, except what we updated
            expect(json).to.contain.all.keys _.extend {}, mount_config, update

            # master should still know our stream
            expect(m.master.master.source_mounts).to.have.key mount_config.key

            # now change it back
            request.put url:"#{m.api_uri}/sources/#{mount_config.key}/config", json:true, body:update, (err,res,json) ->
                throw err if err

                expect(res.statusCode).to.be.eql 200
                expect(json).to.contain.all.keys mount_config

                done()

    it "allows source mount to be removed via DELETE /sources/:source", (done) ->
        request.del url:"#{m.api_uri}/sources/#{mount_config.key}", (err,res) ->
            throw err if err

            expect(res.statusCode).to.be.eql 200

            # master should no longer know our source
            expect(m.master.master.source_mounts).to.not.have.key mount_config.key

            done()
