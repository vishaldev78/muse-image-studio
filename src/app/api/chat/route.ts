import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { uploadToB2, isB2Configured } from "@/lib/b2";

const SYSTEM_PROMPT = `You are Muse Image Studio, a friendly and helpful AI assistant created for a creative studio. You can help users with:
- Answering questions on any topic
- Creative writing, brainstorming, and ideation
- Helping craft better image generation prompts
- Explaining concepts clearly
- Code assistance and debugging

Be concise but thorough. Use markdown formatting when helpful. If the user asks you to generate an image, suggest they use the "Generate Image" tool in the sidebar, or help them craft a detailed prompt first.`;

export async function POST(req: NextRequest) {
  try {
    const { sessionId, message, userId } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Verify session ownership
    const existingSession = await db.chatSession.findUnique({ where: { id: sessionId } });
    if (!existingSession || (userId && existingSession.userId !== userId)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Save user message to DB
    await db.chatMessage.create({
      data: {
        sessionId,
        role: "user",
        content: message.trim(),
        type: "text",
      },
    });

    // Fetch conversation history for context
    const session = await db.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Build message history for LLM (last 20 messages max for context)
    const recentMessages = session.messages.slice(-20);
    const llmMessages = [
      { role: "assistant" as const, content: SYSTEM_PROMPT },
      ...recentMessages.map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Call LLM via z-ai-web-dev-sdk
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: llmMessages,
      thinking: { type: "disabled" },
    });

    const aiResponse = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

    // Save assistant message to DB
    const savedMessage = await db.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: aiResponse,
        type: "text",
      },
    });

    // Store text conversation to B2 (fire-and-forget, non-blocking)
    if (isB2Configured()) {
      const textId = randomUUID();
      const chatPayload = JSON.stringify({
        id: textId,
        sessionId,
        userId,
        role: "assistant",
        content: aiResponse,
        userMessage: message.trim(),
        messageId: savedMessage.id,
        storedAt: new Date().toISOString(),
      }, null, 2);

      uploadToB2(Buffer.from(chatPayload, "utf-8"), "text", `${textId}.json`, "application/json")
        .then((result) => {
          console.log(`[b2] Text stored: ${result.key}`);
        })
        .catch((e) => {
          console.error("[b2] Text store error:", e);
        });
    }

    // Auto-update session title from first user message
    if (session.messages.length <= 1 && session.title === "New Chat") {
      const title = message.trim().slice(0, 50) + (message.trim().length > 50 ? "..." : "");
      await db.chatSession.update({ where: { id: sessionId }, data: { title } });
    }

    return NextResponse.json({
      id: savedMessage.id,
      role: "assistant",
      content: aiResponse,
      type: "text",
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    );
  }
}