import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    const sessions = await db.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Sessions fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    const { title } = await req.json();
    const session = await db.chatSession.create({
      data: { userId, title: title || "New Chat" },
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error("Session create error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}