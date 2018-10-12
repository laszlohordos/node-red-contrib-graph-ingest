'use strict'
const rp = require('request-promise')
module.exports = function(RED) {
    function GraphIngest(config) {
        RED.nodes.createNode(this, config)
        const node = this
        node.server = RED.nodes.getNode(config.server)
        this.on('input', msg => {
            try {
                node.status({
                    fill: 'blue',
                    shape: 'dot',
                    text: ' '
                })
                const policyName = msg.payload.policyName || config.policyName
                let ingestEvent = null

                if (typeof msg.payload === 'object') {
                    if (typeof msg.payload.update === 'object') {
                        ingestEvent = msg.payload.update
                    } else {
                        const objectId = msg.payload.objectId || msg.payload.id
                        const objectType = msg.payload.objectType || msg.payload.type
                        const newObject = msg.payload.newObject
                        const oldObject = msg.payload.oldObject

                        if (objectId || objectType) {
                            if (typeof newObject === 'object') {
                                const changes = {}
                                Object.keys(newObject).forEach(function(key) {
                                    const value = newObject[key]
                                    //https://neo4j.com/docs/developer-manual/current/cypher/syntax/values/
                                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                                        changes[key] = {
                                            value,
                                            change: 'SET'
                                        }
                                    } else if (typeof value === 'object' && 'id' in value) {
                                        changes[key] = {
                                            change: 'SET',
                                            id: value.id
                                        }
                                        if (typeof value.type === 'string') {
                                            changes[key].type = value.type
                                        }
                                        if (value.direction === 'INCOMING' || value.in === true) {
                                            changes[key].direction = 'INCOMING'
                                        }
                                        if (value.direction === 'OUTGOING' || value.out === true) {
                                            changes[key].direction = 'OUTGOING'
                                        }
                                        if (typeof value.properties === 'object') {
                                            changes[key].properties = value.properties
                                        }
                                    }
                                })

                                if (typeof oldObject === 'object') {
                                    Object.keys(oldObject).forEach(function(key) {
                                        if (!(key in changes)) {
                                            changes[key] = {
                                                change: 'DELETE'
                                            }
                                            const value = oldObject[key]
                                            if (typeof value === 'object' && value.id) {
                                                changes[key].id = value.id
                                                if (typeof value.type === 'string') {
                                                    changes[key].type = value.type
                                                }
                                            }
                                        }
                                    })
                                }
                                ingestEvent = {
                                    update: {
                                        [objectId]: {
                                            changes,
                                            type: objectType,
                                            change: 'SET'
                                        }
                                    }
                                }
                            } else if (typeof oldObject === 'object') {
                                ingestEvent = {
                                    update: {
                                        [objectId]: {
                                            type: objectType,
                                            change: 'DELETE'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (config.dryRun) {
                    msg.payload = ingestEvent
                    node.send([msg]);
                } else if (ingestEvent) {
                    node.server.getIngestOptions().then(options => {
                        return rp({
                            ...options,
                            ...{
                                qs: {
                                    policyName
                                },
                                body: ingestEvent
                            }
                        })
                    }).then(body => {
                        msg.payload = body
                        node.send([msg]);
                    }).catch(e => {
                        node.status({
                            fill: 'red',
                            shape: 'dot',
                            text: e.message
                        })
                        node.error(e)
                        msg.payload = e
                        node.send([null, msg]);
                    })
                }
            } catch (err) {
                node.status({
                    fill: 'red',
                    shape: 'dot',
                    text: err.message
                })
                node.error(err)
                return
            }
        })

        this.on('close', () => {
            node.status({})
        })
    }
    RED.nodes.registerType('graph-ingest', GraphIngest)
}
