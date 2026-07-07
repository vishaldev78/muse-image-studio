"use client";

import { useAppStore } from "@/lib/store";
import ChatSidebar from "./ChatSidebar";
import ChatArea from "./ChatArea";
import ChatInput from "./ChatInput";
import GallerySheet from "./GallerySheet";
import ProfileSheet from "./ProfileSheet";
import { PanelLeftOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export default function AppShell() {
  const {
    sidebarOpen, setSidebarOpen, activeSessionId,
    setSessions, setMessages, sessions, inputMode, messages,
  } = useAppStore();

  useEffect(() => {
    const userId = useAppStore.getState().userId;
    fetch("/api/sessions", userId ? { headers: { "x-user-id": userId } } : undefined)
      .then((r) => r.json()).then(setSessions).catch(() => {});
  }, [setSessions]);

  const loadSession = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const userId = useAppStore.getState().userId;
      const res = await fetch(`/api/sessions/${sessionId}`, userId ? { headers: { "x-user-id": userId } } : undefined);
      const data = await res.json();
      setMessages(
        (data.messages || []).map((m: Record<string, unknown>) => ({
          id: m.id as string,
          role: m.role as "user" | "assistant",
          content: m.content as string,
          type: (m.type as string) || "text",
          imageUrl: (m.imageUrl as string) || null,
          b2Key: (m.b2Key as string) || null,
          createdAt: (m.createdAt as string) || "",
        }))
      );
    } catch { setMessages([]); }
  }, [setMessages]);

  useEffect(() => {
    if (activeSessionId) loadSession(activeSessionId);
  }, [activeSessionId, loadSession]);

  const activeTitle = sessions.find((s) => s.id === activeSessionId)?.title;

  return (
    <div className="h-dvh w-full flex bg-background overflow-hidden">
      <ChatSidebar />
      <div className={cn(
        "flex-1 flex flex-col min-w-0 relative transition-all duration-200 ease-in-out",
        sidebarOpen ? "md:ml-[260px]" : "md:ml-0"
      )}>
        <header className="flex items-center justify-between h-12 px-3 sm:px-4 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground mr-0.5" onClick={() => setSidebarOpen(true)}>
                <PanelLeftOpen className="w-4 h-4" />
              </Button>
            )}
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {activeTitle || "Muse Image Studio"}
            </span>
            {inputMode === "image" && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                Image Mode
              </span>
            )}
          </div>
        </header>

        <ChatArea />
        {messages.length > 0 && <ChatInput />}
      </div>
      <GallerySheet />
      <ProfileSheet />
    </div>
  );
}