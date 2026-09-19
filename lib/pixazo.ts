const PIXAZO_LTX_ENDPOINT = "https://gateway.pixazo.ai/ltx-2-3-quality-text-to-video/v1/ltx-2-3-quality-text-to-video-request";
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
      num_frames: options?.num_frames ?? 121,
      resolution: options?.aspect === "9:16"
        ? "portrait_16_9"
        : options?.aspect === "1:1"
          ? "square_hd"
          : "landscape_16_9",
      frames_per_second: options?.frame_rate ?? 24,
      num_inference_steps: 15,
      guidance_scale: 1,
      generate_audio: false,
      enable_prompt_expansion: true,
      enable_safety_checker: true,
      video_quality: "high",
      video_write_mode: "balanced",
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
