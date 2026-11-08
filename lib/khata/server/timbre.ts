import { apiKey, vachanaFetch } from "./vachana";

const URL_TTS = "https://api.vachana.ai/api/v1/tts/inference";
const TIMEOUT_MS = 20_000;

/** Speaks Hindi text with Timbre v3.0, returns mp3 bytes. */
export async function speak(text: string): Promise<ArrayBuffer> {
  const key = apiKey();
  const body = JSON.stringify({
    text,
    voice: "Shivani",
    model: "timbre-v3.0",
    language: "hi-IN",
    speed: 1.0,
    audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, container: "mp3", bitrate: "64k" },
  });
  const res = await vachanaFetch(
    "timbre",
    URL_TTS,
    () => ({ method: "POST", headers: { "Content-Type": "application/json", "X-API-Key-ID": key }, body }),
    TIMEOUT_MS,
  );
  return res.arrayBuffer();
}

const inr = (n: number) => n.toLocaleString("en-IN");

function balanceLine(balance: number): string {
  if (balance > 0) return `अब कुल बाकी ${inr(balance)} रुपये है।`;
  if (balance < 0) return `अब आपके ${inr(-balance)} रुपये एडवांस जमा हैं।`;
  return "अब आपका कोई बाकी नहीं है।";
}

/** Text for one saved entry, built only from stored numbers and names. */
export function entryText(name: string, kind: "udhaar" | "jama", total: number, balance: number): string {
  const what =
    kind === "jama"
      ? `आपने ${inr(total)} रुपये जमा किए।`
      : `आज ${inr(total)} रुपये का सामान खाते में लिखा गया।`;
  return `${name} जी, ${what} ${balanceLine(balance)}`;
}

export function balanceText(name: string, balance: number): string {
  if (balance > 0) return `${name} जी, आपका कुल बाकी ${inr(balance)} रुपये है।`;
  if (balance < 0) return `${name} जी, आपके ${inr(-balance)} रुपये एडवांस जमा हैं।`;
  return `${name} जी, आपका कोई बाकी नहीं है।`;
}
