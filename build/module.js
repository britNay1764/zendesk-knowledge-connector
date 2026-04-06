"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const extension_tools_1 = require("@cognigy/extension-tools");
const zendeskConnector_1 = require("./knowledge-connectors/zendeskConnector");
exports.default = (0, extension_tools_1.createExtension)({
    nodes: [], // REQUIRED by SDK even if unused
    knowledge: [zendeskConnector_1.zendeskConnector],
    options: {
        label: "Zendesk Knowledge Connector",
    },
});
//# sourceMappingURL=module.js.map