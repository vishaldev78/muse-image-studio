import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteFromB2 } from "@/lib/b2";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await db.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (asset.b2Key) {
      try { await deleteFromB2(asset.b2Key); } catch { /* ignore */ }
    }
    await db.mediaAsset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Media delete error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}