import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { uploadToB2, uploadMetadataToB2, isB2Configured } from "@/lib/b2";

// ── Provider configuration ──────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-preview-image-generation";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 3000; // ms

const POLLINATIONS_MODELS = ["flux", "flux-realism", "flux-anime", "flux-3d", "turbo", ""];
const GEMINI_MODELS = [
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp",
  "gemini-1.5-pro",
];

// ── Helpers ──────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function detectMime(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "image/png";
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function bufferToBase64(buf: Buffer): string {
  return buf.toString("base64");
}

// ── Provider 1: Pollinations.ai (PRIMARY — free, no API key) ──
async function pollinationsFetch(
  prompt: string,
  model: string,
  width = 1024,
  height = 1024
): Promise<{ buf: Buffer; mime: string; model: string } | null> {
  const seed = Math.floor(Math.random() * 1e8);
  const encoded = encodeURIComponent(prompt);
  let url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
  if (model) url += `&model=${encodeURIComponent(model)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "MuseImageStudio/1.0" },
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html")) return null;

  const arrayBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  if (buf.length < 1000) return null;

  return { buf, mime: detectMime(buf), model: model || "flux" };
}

async function generateWithPollinations(prompt: string): Promise<{
  buf: Buffer; mime: string; provider: string; model: string;
} | null> {
  console.log("[generate] Trying Pollinations.ai...");
  for (const model of POLLINATIONS_MODELS) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await pollinationsFetch(prompt, model);
        if (result) {
          console.log(`[generate] Pollinations success: model=${model || "default"}`);
          return { ...result, provider: "Pollinations" };
        }
      } catch (e) {
        console.error(`[generate] Pollinations model=${model} attempt=${attempt + 1} error:`, e);
      }
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
    console.log(`[generate] Pollinations model '${model || "default"}' failed, trying next...`);
  }
  return null;
}

// ── Provider 2: Gemini API (FALLBACK) ───────────────────────
async function geminiFetch(
  prompt: string,
  model: string
): Promise<{ buf: Buffer; mime: string; model: string } | null> {
  if (!GEMINI_API_KEY) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Generate an image of: ${prompt}` }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) return null;

  const body = await res.json();
  const candidates = body?.candidates;
  if (!candidates?.length) return null;

  const parts = candidates[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const imgB64 = part.inlineData.data;
      const mime = part.inlineData.mimeType || "image/png";
      const buf = Buffer.from(imgB64, "base64");
      if (buf.length < 1000) continue;
      return { buf, mime, model };
    }
  }
  return null;
}

async function generateWithGemini(prompt: string): Promise<{
  buf: Buffer; mime: string; provider: string; model: string;
} | null> {
  if (!GEMINI_API_KEY) {
    console.log("[generate] Gemini API key not set, skipping");
    return null;
  }

  console.log("[generate] Trying Gemini API...");
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await geminiFetch(prompt, model);
        if (result) {
          console.log(`[generate] Gemini success: model=${model}`);
          return { ...result, provider: "Gemini" };
        }
      } catch (e) {
        console.error(`[generate] Gemini model=${model} attempt=${attempt + 1} error:`, e);
      }
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
    console.log(`[generate] Gemini model '${model}' failed, trying next...`);
  }
  return null;
}

// ── Main POST handler ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { prompt, type = "image", sessionId, userId } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Verify session ownership
    const existingSession = await db.chatSession.findUnique({ where: { id: sessionId } });
    if (!existingSession || (userId && existingSession.userId !== userId)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Save user message
    await db.chatMessage.create({
      data: {
        sessionId,
        role: "user",
        content: `[Image Generation] ${prompt.trim()}`,
        type: "text",
      },
    });

    const assetId = randomUUID();
    const isImage = type === "image";

    // ── Generate image (pure TypeScript, no Python) ──
    let result: { buf: Buffer; mime: string; provider: string; model: string } | null = null;

    // 1. Pollinations.ai (free, no API key)
    if (!result) result = await generateWithPollinations(prompt.trim());

    // 2. Gemini API (fallback)
    if (!result) result = await generateWithGemini(prompt.trim());

    if (!result) {
      return NextResponse.json(
        { error: "All image generation providers failed. Please try again." },
        { status: 500 }
      );
    }

    const { buf, mime, provider, model } = result;
    const sha = sha256Hex(buf);
    const base64 = bufferToBase64(buf);

    // ── Upload to B2 ──
    let b2Key: string | null = null;
    let b2Url: string | null = null;
    let storage = "local";

    if (isB2Configured() && buf) {
      try {
        const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
        const uploadResult = await uploadToB2(buf, "images", `${assetId}.${ext}`, mime);
        b2Key = uploadResult.key;
        b2Url = uploadResult.url;
        storage = "Backblaze B2";
        console.log(`[generate] B2 upload success: ${b2Key} (${buf.length} bytes)`);

        // Upload metadata JSON
        await uploadMetadataToB2({
          id: assetId,
          prompt: prompt.trim(),
          type: "image",
          model,
          provider,
          sha256: sha,
          fileSize: buf.length,
          mimeType: mime,
          b2ImageKey: b2Key,
          b2ImageUrl: b2Url,
          storage,
          createdAt: new Date().toISOString(),
        }).catch((e) => console.error("[generate] B2 metadata upload error:", e));
      } catch (e) {
        console.error("[generate] B2 upload error:", e);
      }
    }

    // ── Build URLs ──
    // For API response: ALWAYS prefer base64 (works instantly, no auth needed)
    const base64Url = isImage ? `data:${mime};base64,${base64}` : "";
    const responseImageUrl = base64Url || b2Url || "";
    // For DB: store B2 signed URL for future reference
    const dbImageUrl = b2Url || base64Url;

    // ── Save to MediaAsset (for gallery) ──
    try {
      await db.mediaAsset.create({
        data: {
          id: assetId,
          userId,
          prompt: prompt.trim(),
          type,
          model,
          fileName: `${assetId}.png`,
          fileSize: buf.length,
          mimeType: isImage ? mime : "text/plain",
          b2Url: dbImageUrl || null,
          b2Key: b2Key,
          sha256: sha,
          status: "completed",
        },
      });
    } catch (assetErr) {
      console.error("[generate] MediaAsset save error:", assetErr);
    }

    // ── Save assistant message with image to ChatMessage ──
    const assistantContent = isImage
      ? `Here's the generated image based on: "${prompt.trim()}"`
      : "Generated successfully.";

    const savedMessage = await db.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: assistantContent,
        type: isImage ? "image" : "text",
        imageUrl: dbImageUrl || null,
        b2Key: b2Key,
        sha256: sha,
      },
    });

    // ── Auto-update session title ──
    if (existingSession.title === "New Chat") {
      const title = prompt.trim().slice(0, 50) + (prompt.trim().length > 50 ? "..." : "");
      await db.chatSession.update({ where: { id: sessionId }, data: { title } }).catch(() => {});
    }

    return NextResponse.json({
      id: savedMessage.id,
      role: "assistant",
      content: assistantContent,
      type: savedMessage.type,
      imageUrl: responseImageUrl,
      b2Key,
      sha256: sha,
      storage,
      provider,
    });
  } catch (error) {
    console.error("[generate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}