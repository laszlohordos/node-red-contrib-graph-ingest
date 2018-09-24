module.exports = function (RED) {
  function RemoteServerNode (n) {
    RED.nodes.createNode(this, n)
  }
  RED.nodes.registerType('openam-server', RemoteServerNode)
}
