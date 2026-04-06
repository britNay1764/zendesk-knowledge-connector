"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zendeskConnector = void 0;
const extension_tools_1 = require("@cognigy/extension-tools");
const axios_1 = __importDefault(require("axios"));
exports.zendeskConnector = (0, extension_tools_1.createKnowledgeConnector)({
    type: "zendeskConnector",
    label: "Zendesk Knowledge Connector",
    summary: "Imports Zendesk Help Center FAQs into Cognigy Knowledge AI.",
    fields: [
        {
            key: "domain",
            label: "Zendesk Domain",
            type: "text",
            params: { required: true },
        },
        {
            key: "email",
            label: "Zendesk Email",
            type: "text",
            params: { required: true },
        },
        {
            key: "apiToken",
            label: "Zendesk API Token",
            type: "text",
            params: { required: true },
        },
        {
            key: "locale",
            label: "Locale",
            type: "text",
            defaultValue: "en-us",
        },
        {
            key: "sourceTags",
            label: "Source Tags",
            type: "chipInput",
            defaultValue: ["zendesk"],
        },
    ],
    function: async ({ config, api, sources: currentSources }) => {
        const { domain, email, apiToken, locale, sourceTags } = config;
        const response = await axios_1.default.get(`${domain}/api/v2/help_center/${locale}/articles.json?per_page=100`, {
            auth: {
                username: `${email}/token`,
                password: apiToken,
            },
        });
        const articles = response.data.articles || [];
        const updatedSources = new Set();
        for (const article of articles) {
            const externalId = article.id.toString();
            const content = article.body.replace(/<[^>]*>?/gm, "").trim();
            const result = await api.upsertKnowledgeSource({
                name: article.title,
                description: `Zendesk FAQ: ${article.title}`,
                tags: sourceTags,
                chunkCount: 1,
                externalIdentifier: externalId,
                contentHashOrTimestamp: article.updated_at,
            });
            updatedSources.add(externalId);
            if (!result)
                continue;
            await api.createKnowledgeChunk({
                knowledgeSourceId: result.knowledgeSourceId,
                text: content,
            });
        }
        for (const source of currentSources) {
            if (updatedSources.has(source.externalIdentifier) ||
                !source.externalIdentifier) {
                continue;
            }
            await api.deleteKnowledgeSource({
                knowledgeSourceId: source.knowledgeSourceId,
            });
        }
    },
});
//# sourceMappingURL=zendeskConnector.js.map