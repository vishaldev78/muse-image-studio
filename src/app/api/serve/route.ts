import { NextRequest, NextResponse } from "next/server";
import { downloadFromB2 } from "@/lib/b2";

export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const { buffer, contentType } = await downloadFromB2(key);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="${key.split("/").pop()}"`,
      },
    });
  } catch (error) {
    console.error("Serve error:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}