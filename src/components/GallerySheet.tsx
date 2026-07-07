"use client";

import { useCallback, useRef, useEffect } from "react";
import { useAppStore, type GalleryItem } from "@/lib/store";
import { ImageIcon, Download, Trash2, CheckCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function downloadImage(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const byteString = atob(imageUrl.split(",")[1]);
    const mimeMatch = imageUrl.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `muse-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `muse-${Date.now()}.png`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export default function GallerySheet() {
  const { galleryOpen, setGalleryOpen, setGalleryItems, galleryItems } = useAppStore();
  const loadingRef = useRef(false);

  const loadGallery = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const userId = useAppStore.getState().userId;
      const res = await fetch("/api/gallery", userId ? { headers: { "x-user-id": userId } } : undefined);
      const data = await res.json();
      setGalleryItems(data);
    } catch { /* silent */ }
    loadingRef.current = false;
  }, [setGalleryItems]);

  useEffect(() => {
    if (galleryOpen) loadGallery();
  }, [galleryOpen, loadGallery]);

  const handleSelect = (item: GalleryItem) => {
    const input = document.querySelector("textarea");
    if (input) {
      const cursorPos = input.selectionStart;
      const before = input.value.slice(0, cursorPos);
      const after = input.value.slice(cursorPos);
      const insert = `[Image: ${item.prompt}]`;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      nativeInputValueSetter?.call(input, before + insert + after);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      input.setSelectionRange(cursorPos + insert.length, cursorPos + insert.length);
    }
    toast.success("Image reference added to input");
    setGalleryOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, item: GalleryItem) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/media/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Image deleted");
        loadGallery();
      }
    } catch { toast.error("Failed to delete"); }
  };

  const handleDownload = (e: React.MouseEvent, item: GalleryItem) => {
    e.stopPropagation();
    downloadImage(item.imageUrl);
    toast.success("Downloading image");
  };

  const handleOpenChange = useCallback((open: boolean) => setGalleryOpen(open), [setGalleryOpen]);

  return (
    <Sheet open={galleryOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Gallery
            <span className="text-xs text-muted-foreground font-normal ml-1">Click to use in chat</span>
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-60px)]">
          {galleryItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <ImageIcon className="w-12 h-12 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No images yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Use Generate Image to create your first one</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4">
              {galleryItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="group relative rounded-xl overflow-hidden border border-border/40 bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
                >
                  <img src={item.imageUrl} alt={item.prompt} className="w-full aspect-square object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[11px] text-white line-clamp-2 leading-tight">{item.prompt}</p>
                    <p className="text-[10px] text-white/50 mt-1">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => handleDownload(e, item)}
                      className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                      title="Download">
                      <Download className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => handleDelete(e, item)}
                      className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-red-600 transition-colors"
                      title="Delete">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-primary-foreground">
                      <CheckCircle className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}