import { createExtension } from "@cognigy/extension-tools";
import { zendeskConnector } from "./knowledge-connectors/zendeskConnector";

export default createExtension({
    nodes: [],  // REQUIRED by SDK even if unused

    knowledge: [zendeskConnector],

    options: {
        label: "Zendesk Knowledge Connector",
    },
});