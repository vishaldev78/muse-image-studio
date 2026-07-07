"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { useAppStore } from "@/lib/store";
import { Send, Loader2, Paperclip, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Attachment {
  file: File;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Detect if user is asking to generate an image (even in chat mode)
const IMAGE_GEN_PATTERNS = [
  /^\s*(generate|create|make|draw|paint|render|produce|design|build)\s+(a\s+)?(an?\s+)?image\s+(of|about|for)/i,
  /^\s*(generate|create|make|draw|paint|render|produce|design|build)\s+(a\s+)?(an?\s+)?(picture|photo|illustration|artwork|painting|sketch|portrait|logo|banner|icon|poster|thumbnail)/i,
  /^\s*(generate|create|make|draw|paint|render|produce)\s+(a\s+)?(an?\s+)?/i,
  /\b(image|picture|photo|illustration|artwork|painting)\s+(of|about|for|showing|depicting)\s+/i,
  /^\s*(show me|give me|i want|i need)\s+(a\s+)?(an?\s+)?(image|picture|photo|illustration)/i,
  /^\s*(can you|could you|please)\s+(generate|create|make|draw)\s/i,
  /^\s*(muse|ai),?\s*(generate|create|make|draw)\s/i,
];

function looksLikeImageRequest(text: string): boolean {
  const t = text.trim();
  if (t.length < 5) return false;
  return IMAGE_GEN_PATTERNS.some((p) => p.test(t));
}

// Shared hook for input logic
export function useChatInput() {
  const {
    activeSessionId, inputMode, isLoading, isGenerating,
    addMessage, setLoading, setGenerating, updateSessionTitle,
    addSession, setActiveSession,
  } = useAppStore();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const disabled = isLoading || isGenerating || (!input.trim() && attachments.length === 0);

  const ensureSession = useCallback(async (): Promise<string> => {
    let sid: string | null = activeSessionId;
    if (!sid) {
      const userId = useAppStore.getState().userId;
      const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json", ...(userId ? { "x-user-id": userId } : {}) }, body: JSON.stringify({}) });
      const session = await res.json();
      addSession(session);
      setActiveSession(session.id);
      sid = session.id;
    }
    return sid as string;
  }, [activeSessionId, addSession, setActiveSession]);

  const handleSend = useCallback(async () => {
    if (disabled) return;
    const text = input.trim();

    const content = attachments.length > 0 && text
      ? `${text}\n\nAttached: ${attachments.map((a) => a.file.name).join(", ")}`
      : attachments.length > 0
        ? `Attached: ${attachments.map((a) => a.file.name).join(", ")}`
        : text;

    setInput("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const sessionId = await ensureSession();

    addMessage({ id: `temp-${Date.now()}`, role: "user", content, type: "text", createdAt: new Date().toISOString() });

    try {
      // Auto-detect image generation requests even in chat mode
      const shouldGenerateImage = inputMode === "image" || (inputMode === "chat" && looksLikeImageRequest(text));

      if (shouldGenerateImage) {
        setGenerating(true);
        const userId = useAppStore.getState().userId;
        const res = await fetch("/api/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, type: "image", sessionId, userId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        addMessage({ id: data.id, role: "assistant", content: data.content, type: data.type, imageUrl: data.imageUrl, b2Key: data.b2Key, createdAt: new Date().toISOString() });
        setGenerating(false);
      } else {
        setLoading(true);
        const userId = useAppStore.getState().userId;
        const res = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text, userId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Chat failed");
        addMessage({ id: data.id, role: "assistant", content: data.content, type: data.type || "text", createdAt: new Date().toISOString() });
        setLoading(false);
      }
      const title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
      updateSessionTitle(sessionId, title);
    } catch (err) {
      setGenerating(false);
      setLoading(false);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }, [input, disabled, inputMode, attachments, addMessage, setLoading, setGenerating, updateSessionTitle, ensureSession]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast.error(`File${oversized.length > 1 ? "s" : ""} too large (max 10MB)`);
    }
    const valid = files.filter((f) => f.size <= MAX_FILE_SIZE);
    const remaining = MAX_FILES - attachments.length;
    if (valid.length > remaining) {
      toast.error(`Max ${MAX_FILES} files allowed`);
      setAttachments((prev) => [...prev, ...valid.slice(0, remaining).map((file) => ({ file }))]);
    } else {
      setAttachments((prev) => [...prev, ...valid.map((file) => ({ file }))]);
    }
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!isLoading && !isGenerating) {
      textareaRef.current?.focus();
    }
  }, [isLoading, isGenerating]);

  return {
    input, setInput, attachments, textareaRef, fileInputRef,
    disabled, isLoading, isGenerating, inputMode,
    handleSend, handleKeyDown, handleInput, handleFileSelect, removeAttachment,
  };
}

// The actual input box — reusable in both bottom bar and centered welcome
export function InputBox({
  state,
  className,
}: {
  state: ReturnType<typeof useChatInput>;
  className?: string;
}) {
  const {
    input, attachments, textareaRef, fileInputRef,
    disabled, isLoading, isGenerating, inputMode,
    handleSend, handleKeyDown, handleInput, handleFileSelect, removeAttachment,
  } = state;

  return (
    <div className={cn("border border-border rounded-2xl bg-card transition-all focus-within:border-primary/30", className)}>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-3 pb-1">
          {attachments.map((att, i) => (
            <span
              key={`${att.file.name}-${i}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-xs text-muted-foreground max-w-[180px] truncate"
            >
              <Paperclip className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{att.file.name}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="flex-shrink-0 ml-0.5 hover:text-foreground transition-colors"
                aria-label={`Remove ${att.file.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1 p-1.5 sm:p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isGenerating}
          className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
          aria-label="Attach files"
        >
          <Paperclip className="w-[17px] h-[17px]" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
          onChange={handleFileSelect}
          className="hidden"
        />

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={inputMode === "image" ? "Describe the image you want..." : "Message Muse Image Studio..."}
          className={cn(
            "flex-1 min-h-[44px] max-h-[200px] resize-none bg-transparent text-sm leading-relaxed",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none",
            "py-2.5 px-1",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          rows={1}
          disabled={isLoading || isGenerating}
        />

        <Button
          onClick={handleSend}
          disabled={disabled}
          size="icon"
          className={cn(
            "h-10 w-10 min-h-[44px] min-w-[44px] rounded-full flex-shrink-0",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            "disabled:opacity-20",
            "transition-all duration-150"
          )}
        >
          {isLoading || isGenerating ? (
            <Loader2 className="w-[17px] h-[17px] animate-spin" />
          ) : (
            <Send className="w-[17px] h-[17px]" />
          )}
        </Button>
      </div>
    </div>
  );
}

// Default export: bottom-bar variant
export default function ChatInput() {
  const state = useChatInput();
  const { inputMode } = state;

  return (
    <div className="bg-background shrink-0">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3">
        <InputBox state={state} />
        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-[10px] text-muted-foreground/40">
            {inputMode === "image" && (
              <>
                <Sparkles className="w-2.5 h-2.5 inline mr-0.5 text-primary" />
                Image Generation Mode
              </>
            )}
          </p>
          <p className="text-[10px] text-muted-foreground/30">Muse Image Studio can make mistakes</p>
        </div>
      </div>
    </div>
  );
}