'use strict'
const rp = require('request-promise')
module.exports = function(RED) {
    function GraphIngestServerNode(config) {
        RED.nodes.createNode(this, config)
        const node = this

        if (this.credentials.clientId &&
            this.credentials.clientSecret &&
            this.credentials.username &&
            this.credentials.password &&
            config.tokenEndpoint &&
            config.tokenEndpoint) {

            node.tokenOps = {
                method: 'POST',
                uri: config.tokenEndpoint,
                form: {
                    'grant_type': 'password',
                    username: node.credentials.username,
                    password: node.credentials.password
                },
                auth: {
                    user: node.credentials.clientId,
                    pass: node.credentials.clientSecret
                },
                json: true
            }
            if (typeof config.scope === 'string' && !config.scope === '') {
                node.tokenOps.form.scope = config.scope
            }

            node.shouldRefresh = 0

            node.ingestOption = {
                method: 'POST',
                uri: `${config.ingestEndpoint}/${config.clusterName}/update`,
                headers: {
                    'content-type': 'application/json'
                },
                json: true
            }
        }
        this.on('close', function(removed, done) {
            //TODO Revoke refresh token
            if (removed) {
                // This node has been deleted
            } else {
                // This node is being restarted
            }
            done()
        })

    }
    RED.nodes.registerType('graph-ingest-server', GraphIngestServerNode, {
        credentials: {
            username: {
                type: "text"
            },
            password: {
                type: "password"
            },
            clientId: {
                type: "text"
            },
            clientSecret: {
                type: "password"
            }
        }
    })

    GraphIngestServerNode.prototype.getToken = function() {
        const node = this
        if (!node.tokenOps) {
            return Promise.reject(Error('invalid graph-ingest-server configuration'))
        }
        if (false) {
            return Promise.resolve('ee75254b-80c8-4a36-a5cc-24d2bbdff93f')
        }
        if (!node.tokenPromise || (new Date()).getTime() > node.shouldRefresh) {
            node.tokenPromise = rp(node.tokenOps).then(token => {
                if ('expires_in' in token) {
                    node.shouldRefresh = ((new Date()).getTime() / 1000 + token['expires_in'] - 300) * 1000;
                }
                if ('refresh_token' in token) {
                    node.refreshOps = {
                        ...node.tokenOps,
                        ...{
                            form: {
                                'grant_type': 'refresh_token',
                                'refresh_token': token['refresh_token']
                            }
                        }
                    }
                }
                return token['access_token']
            })
        }
        return node.tokenPromise
    }
    GraphIngestServerNode.prototype.getIngestOptions = function() {
        const node = this
        return this.getToken().then(accessToken => {
            return {
                ...node.ingestOption,
                ...{
                    auth: {
                        'bearer': accessToken
                    }
                }
            }
        })
    }
}
