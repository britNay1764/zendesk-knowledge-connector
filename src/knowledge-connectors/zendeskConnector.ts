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

        const rawArticles = response.data.articles || [];

        // Deduplicate by article ID
        const articlesMap = new Map<string, any>();
        for (const article of rawArticles) {
            articlesMap.set(article.id.toString(), article);
        }

        const articles = Array.from(articlesMap.values());
        const updatedSources = new Set<string>();

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
                    tags: sourceTags as string[],
                    chunkCount: totalChunks,
                    externalIdentifier: externalId,
                    contentHashOrTimestamp: article.updated_at ?? externalId,
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

            } catch (error: any) {

                throw new Error(
                    `FAILED → ${article.title} | ${error?.message || error}`
                );
            }
        }

        // Cleanup old sources
        for (const source of currentSources) {

            const extId = source.externalIdentifier as string | undefined;

            if (!extId || updatedSources.has(extId)) {
                continue;
            }

            await api.deleteKnowledgeSource({
                knowledgeSourceId: source.knowledgeSourceId,
            });
        }
    },
});