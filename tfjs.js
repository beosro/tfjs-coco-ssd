
module.exports = function (RED) {
    function TensorFlowCoCo(n) {
        var fs = require('fs');
        var express = require("express");
        var compression = require("compression");

        /* suggestion from https://github.com/tensorflow/tfjs/issues/2029 */
        const nodeFetch = require('node-fetch'); // <<--- ADD
        global.fetch = nodeFetch; // <<--- ADD
        /* ************************************************************** */

        var tf = require('@tensorflow/tfjs-node');
        var cocoSsd = require('@tensorflow-models/coco-ssd');
        
        RED.nodes.createNode(this, n);
        this.scoreThreshold = n.scoreThreshould;
        this.maxDetections = n.maxDetections;
        this.passthru = n.passthru || false;
        this.modelUrl = n.modelUrl || undefined; // "http://localhost:1880/coco/model.json"
        var node = this;

        RED.httpNode.use(compression());
        RED.httpNode.use('/coco', express.static(__dirname + '/models/coco-ssd'));

        async function loadModel() {
            node.model = await cocoSsd.load({modelUrl: node.modelUrl});
            node.ready = true;
            node.status({fill:'green', shape:'dot', text:'Model ready'});
        }
        node.status({fill:'yellow', shape:'ring', text:'Loading model...'});
        loadModel();

        node.on('input', function (msg) {
            async function reco(img) {
                msg.maxDetections = msg.maxDetections || node.maxDetections || 20;
                msg.payload = await node.model.detect(img, msg.maxDetections);
                msg.shape = img.shape;
                msg.classes = {};
                msg.scoreThreshold = msg.scoreThreshold || node.scoreThreshold || 0.5;
                
                for (var i=0; i<msg.payload.length; i++) {
                    if (msg.payload[i].score < msg.scoreThreshold) {
                        msg.payload.splice(i,1);
                        i = i - 1;
                    }
                }
                for (var j=0; j<msg.payload.length; j++) {
                    msg.classes[msg.payload[j].class] = (msg.classes[msg.payload[j].class] || 0 ) + 1;
                }
                node.send(msg);
            }
            try {
                if (node.ready) {
                    var p = msg.payload;
                    if (typeof p === "string") { p = fs.readFileSync(p); }
                    if (node.passthru === true) { msg.image = p; }
                    reco(tf.node.decodeImage(p));
                }
            } catch (error) {
                node.error(error, msg);
            }
        });

        node.on("close", function () {
            node.status({});
        });
    }
    RED.nodes.registerType("tensorflowCoco", TensorFlowCoCo);
};
