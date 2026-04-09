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
        console.log("new build test - 12345")
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
            const rawBody = article.body || "";
            const content = rawBody.replace(/<[^>]*>?/gm, "").trim();

            if (!content || content.length < 5) {
                continue; // skip any empty or invalid articles
            }

            console.log("processing article:", article.title);

            const sanitizedName = article.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
            
            const uniqueName = `${sanitizedName}-${externalId}`;

            console.log("sanitized name:", uniqueName);

            const result = await api.upsertKnowledgeSource({
                name: uniqueName,
                description: `Zendesk FAQ: ${article.title}`,
                tags: sourceTags as string[],
                chunkCount: Math.ceil(content.length / 1000),
                externalIdentifier: externalId,
                contentHashOrTimestamp: article.updated_at ?? externalId,

            });


            // updatedSources.add(externalId);

            if (!result) {
                updatedSources.add(externalId);
                continue;
            }

           const MAX_CHUNK_LENGTH = 1000;

try {
    for (let i = 0; i < content.length; i += MAX_CHUNK_LENGTH) {
        const chunk = content.substring(i, i + MAX_CHUNK_LENGTH);

        await api.createKnowledgeChunk({
            knowledgeSourceId: result.knowledgeSourceId,
            text: chunk,
        });
    }

    updatedSources.add(externalId);

            } catch (chunkError) {
                console.log("Chunk failed for article", article.title, "Error:", chunkError);
                continue;
            }

        }

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