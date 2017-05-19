_ = require "underscore"

CoreObj =
    time:
        type:   "date"
        format: "date_time"
        doc_values: true
    stream:
        type:   "string"
        index:  "not_analyzed"
        doc_values: true
    session_id:
        type:   "string"
        index:  "not_analyzed"
        doc_values: true
    client:
        type:   "object"
        properties:
            session_id:
                type:   "string"
                index:  "not_analyzed"
                doc_values: true
            user_id:
                type:   "string"
                index:  "not_analyzed"
                doc_values: true
            output:
                type:   "string"
                index:  "not_analyzed"
                doc_values: true
            ip:
                type:   "string"
                index:  "not_analyzed"
                doc_values: true
            ua:
                type:   "string"
                index:  "not_analyzed"
                doc_values: true
            path:
                type:   "string"
                index:  "not_analyzed"
                doc_values: true

module.exports =
    sessions:
        settings:
            index:
                number_of_shards:   3
                number_of_replicas: 1
        mappings:
            session:
                "_all": { enabled: false }
                properties: _.extend {}, CoreObj,
                    duration:
                        type:   "float"
                    kbytes:
                        type:   "long"
    listens:
        settings:
            index:
                number_of_shards:   3
                number_of_replicas: 1
        mappings:
            start:
                "_all": { enabled: false }
                properties: _.extend {}, CoreObj

            listen:
                "_all": { enabled: false }
                properties:
                    _.extend {}, CoreObj,
                        duration:
                            type:   "float"
                        kbytes:
                            type:   "long"
                        offsetSeconds:
                            type:   "integer"
                            doc_values: true
                        contentTime:
                            type:   "date"
                            format: "date_time"
                            doc_values: true
