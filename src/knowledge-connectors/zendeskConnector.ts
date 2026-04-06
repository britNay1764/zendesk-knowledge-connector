import { createKnowledgeConnector } from "@cognigy/extension-tools";
import axios from "axios";

export const zendeskConnector = createKnowledgeConnector({
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
    ] as const,

    function: async ({ config, api, sources: currentSources }) => {
        const { domain, email, apiToken, locale, sourceTags } = config;

        const response = await axios.get(
            `${domain}/api/v2/help_center/${locale}/articles.json?per_page=100`,
            {
                auth: {
                    username: `${email}/token`,
                    password: apiToken,
                },
            }
        );

        const articles = response.data.articles || [];
        const updatedSources = new Set<string>();

        for (const article of articles) {
            const externalId = article.id.toString();
            const content = article.body.replace(/<[^>]*>?/gm, "").trim();

            const result = await api.upsertKnowledgeSource({
                name: article.title,
                description: `Zendesk FAQ: ${article.title}`,
                tags: sourceTags as string[],
                chunkCount: 1,
                externalIdentifier: externalId,
                contentHashOrTimestamp: article.updated_at,
            });

            updatedSources.add(externalId);

            if (!result) continue;

            await api.createKnowledgeChunk({
                knowledgeSourceId: result.knowledgeSourceId,
                text: content,
            });
        }

        for (const source of currentSources) {
            if (
                updatedSources.has(source.externalIdentifier) ||
                !source.externalIdentifier
            ) {
                continue;
            }

            await api.deleteKnowledgeSource({
                knowledgeSourceId: source.knowledgeSourceId,
            });
        }
    },
});