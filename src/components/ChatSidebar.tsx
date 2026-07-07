"use client";

import { useState, useCallback, useRef } from "react";
import { useAppStore, type Session } from "@/lib/store";
import {
  Plus,
  MessageSquare,
  Sparkles,
  Trash2,
  ImageIcon,
  Images,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: Session;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
      onClick={() => onSelect(session.id)}
    >
      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
      <span className="flex-1 truncate text-[13px] text-left">{session.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(session.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
        aria-label="Delete conversation"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function SidebarInner({ onClose }: { onClose?: () => void }) {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    inputMode,
    setInputMode,
    setGalleryOpen,
    userName,
    removeSession,
    setSidebarOpen,
    setProfileOpen,
  } = useAppStore();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const creatingRef = useRef(false);

  const handleNewChat = async () => {
    const state = useAppStore.getState();
    if (state.activeSessionId && state.messages.length === 0) return;
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const userId = useAppStore.getState().userId;
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(userId ? { "x-user-id": userId } : {}) },
        body: JSON.stringify({}),
      });
      const session = await res.json();
      useAppStore.getState().addSession(session);
      setActiveSession(session.id);
    } finally {
      creatingRef.current = false;
    }
  };

  const handleSelect = (id: string) => {
    setActiveSession(id);
    onClose?.();
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const userId = useAppStore.getState().userId;
    await fetch(`/api/sessions/${deleteTarget}`, {
      method: "DELETE",
      ...(userId ? { headers: { "x-user-id": userId } } : {}),
    });
    removeSession(deleteTarget);
    setDeleteTarget(null);
  };

  const now = Date.now();
  const today = sessions.filter(
    (s) => now - new Date(s.updatedAt).getTime() < 86400000
  );
  const yesterday = sessions.filter((s) => {
    const d = now - new Date(s.updatedAt).getTime();
    return d >= 86400000 && d < 172800000;
  });
  const older = sessions.filter(
    (s) => now - new Date(s.updatedAt).getTime() >= 172800000
  );

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      {/* Header: Logo + Action buttons */}
      <div className="shrink-0">
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sidebar-foreground text-[15px] tracking-tight">
            Muse Image Studio
          </span>
        </div>

        <div className="px-2 pb-2 space-y-0.5">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
          <button
            onClick={() => setInputMode(inputMode === "image" ? "chat" : "image")}
            className={cn(
              "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] transition-colors text-left",
              inputMode === "image"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Generate Image</span>
          </button>
          <button
            onClick={() => {
              setInputMode("chat");
              setGalleryOpen(true);
            }}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-left"
          >
            <Images className="w-4 h-4" />
            <span>Gallery</span>
          </button>
        </div>

        <div className="border-t border-sidebar-border" />
      </div>

      {/* Scrollable session list — padded bottom so profile doesn't overlap */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-16">
        {sessions.length > 0 ? (
          <div className="py-1 space-y-0.5">
            {today.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground/40 px-3 mb-1 uppercase tracking-widest">
                  Today
                </p>
                {today.map((s) => (
                  <SessionItem key={s.id} session={s} isActive={activeSessionId === s.id} onSelect={handleSelect} onDelete={setDeleteTarget} />
                ))}
              </>
            )}
            {yesterday.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground/40 px-3 mb-1 mt-3 uppercase tracking-widest">
                  Yesterday
                </p>
                {yesterday.map((s) => (
                  <SessionItem key={s.id} session={s} isActive={activeSessionId === s.id} onSelect={handleSelect} onDelete={setDeleteTarget} />
                ))}
              </>
            )}
            {older.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground/40 px-3 mb-1 mt-3 uppercase tracking-widest">
                  Previous
                </p>
                {older.map((s) => (
                  <SessionItem key={s.id} session={s} isActive={activeSessionId === s.id} onSelect={handleSelect} onDelete={setDeleteTarget} />
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="w-7 h-7 mx-auto mb-2 text-muted-foreground/15" />
            <p className="text-xs text-muted-foreground/40">
              No conversations yet
            </p>
          </div>
        )}
      </div>

      {/* Profile: ABSOLUTELY pinned to bottom — never moves */}
      <div className="absolute bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border z-10">
        <button
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2.5 w-full p-3 hover:bg-sidebar-accent transition-colors text-left"
          aria-label="Open profile"
        >
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold uppercase flex-shrink-0">
            {userName?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-sidebar-foreground truncate">
              {userName || "User"}
            </p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </button>
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This permanently deletes the conversation and all its messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ChatSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  return (
    <>
      {/* Mobile: overlay sidebar */}
      {sidebarOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed z-50 top-0 left-0 bottom-0 w-[280px] flex flex-col bg-sidebar text-sidebar-foreground">
            <SidebarInner onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}
      {/* Desktop: fixed sidebar — never scrolls with page content */}
      <aside
        className={cn(
          "hidden md:block fixed top-0 left-0 bottom-0 z-10 bg-sidebar text-sidebar-foreground border-r border-border transition-all duration-200 ease-in-out overflow-hidden",
          sidebarOpen ? "w-[260px]" : "w-0"
        )}
      >
        <div className="w-[260px] h-full">
          <SidebarInner onClose={() => setSidebarOpen(false)} />
        </div>
      </aside>
    </>
  );
}