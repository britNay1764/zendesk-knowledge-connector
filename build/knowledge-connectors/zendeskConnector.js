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
        const response = await axios_1.default.get(`${domain}/api/v2/help_center/${locale}/articles.json?per_page=100`, {
            auth: {
                username: `${email}/token`,
                password: apiToken,
            },
        });
        const rawArticles = response.data.articles || [];
        const articlesMap = new Map();
        for (const article of rawArticles) {
            articlesMap.set(article.id.toString(), article);
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
            const sanitizedName = article.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
            const uniqueName = `${sanitizedName}-${externalId}`;
            const paragraphs = content
                .split(/\n+/)
                .map((p) => p.trim())
                .filter((p) => p.length > 50);
            const result = await api.upsertKnowledgeSource({
                name: uniqueName,
                description: `Zendesk FAQ: ${article.title}`,
                tags: sourceTags,
                chunkCount: paragraphs.length,
                externalIdentifier: externalId,
                contentHashOrTimestamp: (_a = article.updated_at) !== null && _a !== void 0 ? _a : externalId,
            });
            if (!result) {
                updatedSources.add(externalId);
                continue;
            }
            try {
                for (const paragraph of paragraphs) {
                    await api.createKnowledgeChunk({
                        knowledgeSourceId: result.knowledgeSourceId,
                        text: `${article.title}\n\n${paragraph}`,
                    });
                }
                updatedSources.add(externalId);
            }
            catch (chunkError) {
                console.log("Chunk failed for article:", article.title, chunkError);
                continue;
            }
        }
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