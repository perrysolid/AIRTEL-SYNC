import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { orderCard, quoteCard } from "./cards";
import { store } from "./store";
import type { BotMessage } from "./bots/types";

/**
 * Neon Object Storage (S3-compatible) for chat cards. Each card is rendered
 * once when the message is sent, uploaded under a versioned key and sent as a
 * presigned link, so WhatsApp and Telegram fetch it from storage, not from
 * the app server (which may be waking from sleep). Private bucket; links
 * expire after 7 days, the longest S3 signatures allow.
 */

const BUCKET = process.env.CARDS_BUCKET ?? "assets";
export const storageEnabled = () => !!(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

const g = globalThis as unknown as { __udyamS3?: S3Client };
// Credentials, endpoint and region come from the AWS_* env vars Neon injects.
const s3 = () => (g.__udyamS3 ??= new S3Client({ forcePathStyle: true }));

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=604800, immutable" }));
}

export async function getObject(key: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return res.Body?.transformToByteArray();
}

export const signedUrl = (key: string, expiresIn = 7 * 24 * 3600) => getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });

/** /api/card/<kind>/<id>?v=<version> → the rendered PNG, or undefined if gone. */
function renderCard(kind: string, id: string) {
  if (kind === "order") {
    const o = store.getOrder(id);
    return o && orderCard(o);
  }
  const s = store.getSession(id);
  return s?.quote && quoteCard(s);
}

/** Renders an app card URL (/api/card/<kind>/<id>?v=…) in-process: its PNG and a stable key. */
export async function cardPng(url: string) {
  const m = url.match(/\/api\/card\/(order|quote)\/([^/?]+)\?v=([^&]+)/);
  const res = m && renderCard(m[1], m[2]);
  if (!m || !res) return undefined;
  return { key: `cards/${m[1]}/${m[2]}/${m[3].replace(/[^\w.-]/g, "_")}.png`, bytes: new Uint8Array(await res.arrayBuffer()) };
}

/** Swaps an app-hosted card URL for a stored copy; leaves anything else alone. */
export async function stageImage(msg: BotMessage): Promise<BotMessage> {
  if (!msg.image || !storageEnabled()) return msg;
  try {
    const card = await cardPng(msg.image);
    if (!card) return msg;
    await putObject(card.key, card.bytes, "image/png");
    return { ...msg, image: await signedUrl(card.key) };
  } catch (e) {
    console.warn(`[media] card upload failed, sending the app URL: ${(e as Error).message}`);
    return msg;
  }
}
