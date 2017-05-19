module.exports = (grunt) ->
    grunt.initConfig
        pkg: grunt.file.readJSON 'package.json'
        coffee:
            coffee_to_js:
                options:
                    bare: true
                    sourceMap: true
                expand: true
                flatten: false
                src: ["src/**/*.coffee","streamer.coffee","runner.coffee","util.coffee","util/*.coffee"]
                dest: 'js/'
                ext: ".js"

        copy:
            copy_slave_worker:
                files: 'js/src/streammachine/modes/slave_worker.js': ['src/streammachine/modes/slave_worker_js.js']

    grunt.loadNpmTasks 'grunt-contrib-coffee'
    grunt.loadNpmTasks 'grunt-contrib-copy'

    grunt.registerTask 'default', ['coffee','copy']