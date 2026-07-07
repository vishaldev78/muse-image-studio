import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    const assets = await db.mediaAsset.findMany({
      where: { userId, type: "image", status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const items = assets.map((a) => ({
      id: a.id,
      prompt: a.prompt,
      imageUrl: a.b2Url || a.fileName,
      b2Key: a.b2Key,
      sha256: a.sha256,
      createdAt: a.createdAt,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Gallery fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch gallery" }, { status: 500 });
  }
}