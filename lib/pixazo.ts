const PIXAZO_LTX_ENDPOINT = "https://gateway.pixazo.ai/ltx-video/v1/text-to-video";
const PIXAZO_GATEWAY_HOST = "gateway.pixazo.ai";

export type PixazoResult = {
  request_id?: string;
  status?: string;
  polling_url?: string;
  [key: string]: unknown;
};

function apiKey() {
  const key = process.env.PIXAZO_API_KEY;
  if (!key) throw new Error("PIXAZO_API_KEY is not configured.");
  return key;
}

export async function submitPixazo(prompt: string, options?: {
  aspect?: string;
  width?: number;
  height?: number;
  num_frames?: number;
  frame_rate?: number;
}) {
  if (!prompt.trim()) throw new Error("Prompt is required.");

  const response = await fetch(PIXAZO_LTX_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": apiKey(),
    },
    body: JSON.stringify({
      prompt: prompt.trim(),
      ...(options || {}),
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.error === "string" ? data.error :
      typeof data?.message === "string" ? data.message :
      `Pixazo returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  if (!data?.request_id || !data?.polling_url) {
    throw new Error("Pixazo returned an invalid generation response.");
  }

  return data as PixazoResult & { request_id: string; polling_url: string };
}

export async function getPixazoStatus(pollingUrl: string) {
  const parsed = new URL(pollingUrl);
  if (parsed.protocol !== "https:" || parsed.hostname !== PIXAZO_GATEWAY_HOST) {
    throw new Error("Invalid Pixazo polling URL.");
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": apiKey(),
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.error === "string" ? data.error :
      typeof data?.message === "string" ? data.message :
      `Pixazo status returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  return data;
}

export function pixazoJobId(pollingUrl: string) {
  return `px:${Buffer.from(pollingUrl, "utf8").toString("base64url")}`;
}

export function pixazoPollingUrlFromJobId(id: string) {
  return Buffer.from(id.slice(3), "base64url").toString("utf8");
}
