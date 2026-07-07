import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id");
    const session = await db.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (userId && session.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (error) {
    console.error("Session fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id");

    // Verify ownership
    const session = await db.chatSession.findUnique({ where: { id } });
    if (!session || (userId && session.userId !== userId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const msgs = await db.chatMessage.findMany({
      where: { sessionId: id, b2Key: { not: null } },
      select: { b2Key: true },
    });
    for (const m of msgs) {
      if (m.b2Key) {
        try { await (await import("@/lib/b2")).deleteFromB2(m.b2Key); } catch { /* ignore */ }
      }
    }
    await db.chatSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session delete error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title } = await req.json();
    const session = await db.chatSession.update({ where: { id }, data: { title } });
    return NextResponse.json(session);
  } catch (error) {
    console.error("Session update error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}