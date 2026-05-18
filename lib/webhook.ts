export type DeliveryResult = {
  ok: boolean;
  status: number | null;
  error?: string;
};

export async function postToWebhook(url: string, payload: unknown): Promise<DeliveryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timeout);
  }
}
