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
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 50);

        const result = await api.upsertKnowledgeSource({
            name: uniqueName,
            description: `Zendesk FAQ: ${article.title}`,
            tags: sourceTags as string[],
            chunkCount: paragraphs.length,
            externalIdentifier: externalId,
            contentHashOrTimestamp: article.updated_at ?? externalId,
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

        } catch (chunkError) {
            console.log("Chunk failed for article:", article.title, chunkError);
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
