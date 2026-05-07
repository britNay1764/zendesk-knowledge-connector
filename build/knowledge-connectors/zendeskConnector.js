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
        var _a;
        const { domain, email, apiToken, locale, sourceTags } = config;
        const response = await axios_1.default.get(`${domain}/api/v2/help_center/articles/search.json?locale=${locale}&query=*`, {
            auth: {
                username: `${email}/token`,
                password: apiToken,
            },
        });
        const rawArticles = response.data.results || [];
        // Dups by article ID
        const articlesMap = new Map();
        for (const article of rawArticles) {
            const id = article.id.toString();
            if (!articlesMap.has(id)) {
                articlesMap.set(id, article);
            }
        }
        const articles = Array.from(articlesMap.values());
        const updatedSources = new Set();
        for (const article of articles) {
            const externalId = article.id.toString();
            const rawBody = article.body || "";
            const content = rawBody.replace(/<[^>]*>?/gm, "").trim();
            if (!content || content.length < 5) {
                continue;
            }
            // Sanitize resource name
            const sanitizedName = article.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .substring(0, 40);
            const uniqueName = `${sanitizedName}-${externalId}`;
            try {
                const fullText = `${article.title}\n\n${content}`;
                const MAX_CHUNK_LENGTH = 2000;
                const totalChunks = Math.ceil(fullText.length / MAX_CHUNK_LENGTH);
                const result = await api.upsertKnowledgeSource({
                    name: uniqueName,
                    description: `Zendesk FAQ: ${article.title}`,
                    tags: sourceTags,
                    chunkCount: totalChunks,
                    externalIdentifier: externalId,
                    contentHashOrTimestamp: (_a = article.updated_at) !== null && _a !== void 0 ? _a : externalId,
                });
                if (!result) {
                    updatedSources.add(externalId);
                    continue;
                }
                for (let i = 0; i < fullText.length; i += MAX_CHUNK_LENGTH) {
                    const chunk = fullText.substring(i, i + MAX_CHUNK_LENGTH);
                    await api.createKnowledgeChunk({
                        knowledgeSourceId: result.knowledgeSourceId,
                        text: chunk,
                    });
                }
                updatedSources.add(externalId);
            }
            catch (error) {
                throw new Error(`FAILED → ${article.title} | ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
            }
        }
        // Cleanup old sources
        for (const source of currentSources) {
            const extId = source.externalIdentifier;
            if (!extId || updatedSources.has(extId)) {
                continue;
            }
            await api.deleteKnowledgeSource({
                knowledgeSourceId: source.knowledgeSourceId,
            });
        }
    },
});
//# sourceMappingURL=zendeskConnector.js.map