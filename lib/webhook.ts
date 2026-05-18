export type DeliveryResult = {
  ok: boolean;
  status: number | null;
  error?: string;
};

export async function postToWebhook(url: string, payload: unknown): Promise<DeliveryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let body: string;
  if (url.includes("hooks.slack.com")) {
    body = JSON.stringify(formatForSlack(payload));
  } else {
    body = JSON.stringify(payload);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timeout);
  }
}

function formatForSlack(payload: unknown): unknown {
  if (typeof payload !== "object" || !payload) return payload;

  const summary = payload as Record<string, unknown>;
  const actionItemsText = (summary.action_items as Array<any>)
    ?.map((a) => `• *${a.item}* (${a.priority})${a.owner ? ` — ${a.owner}` : ""}`)
    .join("\n") || "None";

  const entitiesText = (summary.entities as Array<any>)
    ?.map((e) => `${e.name} (${e.type})`)
    .join(", ") || "None";

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: String(summary.title),
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: String(summary.summary),
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Action Items:*\n${actionItemsText}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Entities:* ${entitiesText}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Sentiment: *${summary.sentiment}*`,
          },
        ],
      },
    ],
  };
}
