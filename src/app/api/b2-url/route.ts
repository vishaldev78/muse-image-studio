import { NextRequest, NextResponse } from "next/server";
import { getB2SignedUrl } from "@/lib/b2";

export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const url = await getB2SignedUrl(key);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Sign URL error:", error);
    return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
  }
}