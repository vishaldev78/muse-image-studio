"use client";

import { useAppStore, type Message } from "@/lib/store";
import { useEffect, useRef, ReactNode, useState, useCallback } from "react";
import { Sparkles, User, Copy, Check, Download, Trash2, ImageOff } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { InputBox } from "./ChatInput";
import { useChatInput } from "./ChatInput";

function MarkdownText({ children }: { children: string }) {
  const text = children;
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).split("\n");
          const lang = lines[0]?.trim() || "";
          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");
          return (
            <pre key={i} className="my-2 p-3 rounded-lg bg-muted overflow-x-auto text-xs">
              {lang && <span className="text-[10px] text-muted-foreground block mb-1">{lang}</span>}
              <code className="font-mono whitespace-pre-wrap">{code}</code>
            </pre>
          );
        }
        return <span key={i}>{renderInline(part)}</span>;
      })}
    </>
  );
}

function renderInline(text: string): ReactNode {
  const elements: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\n)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) elements.push(text.slice(lastIndex, match.index));
    if (match[2]) elements.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
    else if (match[3]) elements.push(<em key={key++}>{match[3]}</em>);
    else if (match[4]) elements.push(<code key={key++} className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{match[4]}</code>);
    else if (match[0] === "\n") elements.push(<br key={key++} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) elements.push(text.slice(lastIndex));
  return elements.length > 0 ? <>{elements}</> : text;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ImageActions({ imageUrl, b2Key }: { imageUrl: string; b2Key?: string | null }) {
  const handleDownload = useCallback(() => {
    // For base64 data URLs, convert to blob for proper download
    if (imageUrl.startsWith('data:')) {
      const byteString = atob(imageUrl.split(',')[1]);
      const mimeMatch = imageUrl.match(/data:([^;]+)/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `muse-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `muse-${Date.now()}.png`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [imageUrl]);

  const handleDelete = useCallback(async () => {
    if (!b2Key) return;
    try {
      const res = await fetch(`/api/media/${b2Key}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Image deleted");
        window.location.reload();
      } else {
        toast.error("Failed to delete image");
      }
    } catch {
      toast.error("Failed to delete image");
    }
  }, [b2Key]);

  return (
    <div className="flex items-center gap-0.5 mt-1.5 px-1">
      <button onClick={handleDownload} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Download">
        <Download className="w-3.5 h-3.5" />
      </button>
      {b2Key && (
        <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isImage = message.type === "image";
  const [imgError, setImgError] = useState(false);
  const [imgSrc, setImgSrc] = useState(message.imageUrl || "");

  const handleImgError = useCallback(async () => {
    if (imgError || !message.b2Key) { setImgError(true); return; }
    try {
      const res = await fetch(`/api/b2-url?key=${encodeURIComponent(message.b2Key)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) { setImgSrc(data.url); return; }
      }
    } catch { /* fall through */ }
    setImgError(true);
  }, [imgError, message.b2Key]);

  return (
    <div className={`group flex gap-3 py-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
        isUser ? "bg-muted" : "bg-primary"
      }`}>
        {isUser ? <User className="w-3.5 h-3.5 text-muted-foreground" /> : <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        <p className="text-[11px] font-medium text-muted-foreground/70 mb-1 px-1">{isUser ? "You" : "Muse Image Studio"}</p>

        {isImage && message.imageUrl && !imgError ? (
          <div className="space-y-1">
            <p className="text-sm text-foreground px-1">{message.content}</p>
            <div className="rounded-xl overflow-hidden border border-border max-w-md bg-card">
              <img
                src={imgSrc}
                alt={message.content}
                className="w-full h-auto"
                loading="lazy"
                onError={handleImgError}
              />
            </div>
            {message.imageUrl && <ImageActions imageUrl={message.imageUrl} b2Key={message.b2Key} />}
          </div>
        ) : isImage && imgError ? (
          <div className="rounded-xl border border-border max-w-md p-6 bg-card flex flex-col items-center gap-2 text-muted-foreground">
            <ImageOff className="w-8 h-8" />
            <p className="text-sm">Image could not be loaded</p>
            {message.b2Key && (
              <a href={`/api/serve?key=${encodeURIComponent(message.b2Key)}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline">
                Open in new tab
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-1">
            <div className="text-sm text-foreground leading-relaxed px-1 max-w-none flex-1">
              <MarkdownText>{message.content}</MarkdownText>
            </div>
            {!isUser && <CopyButton text={message.content} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatArea() {
  const { messages, isLoading, isGenerating, activeSessionId } = useAppStore();
  const userName = useAppStore((s) => s.userName);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputState = useChatInput();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isGenerating]);

  if (!activeSessionId || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-xl">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">{userName ? `Hi, ${userName}` : "Muse Image Studio"}</h1>
          <p className="text-muted-foreground mb-6 text-sm">Your AI creative studio</p>

          <div className="mb-4">
            <InputBox state={inputState} />
          </div>
          <p className="text-[10px] text-muted-foreground/30 mb-8">Muse Image Studio can make mistakes</p>

          <div className="grid grid-cols-2 gap-2.5 text-left max-w-sm mx-auto">
            {[
              { icon: "💬", text: "Ask anything" },
              { icon: "🎨", text: "Generate images" },
              { icon: "📎", text: "Upload files" },
              { icon: "🖼️", text: "Browse gallery" },
            ].map((item) => (
              <div key={item.icon} className="p-3 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-border/60 transition-all cursor-default">
                <span className="text-base">{item.icon}</span>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0 px-0">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 divide-y divide-border/15">
        {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
        {(isLoading || isGenerating) && (
          <div className="flex gap-3 py-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground animate-pulse" />
            </div>
            <div className="flex items-center px-1 py-1.5">
              <span className="text-sm text-muted-foreground">
                {isGenerating ? "Generating" : "Thinking"}
              </span>
              <span className="inline-flex gap-[3px] ml-1">
                <span className="w-[5px] h-[5px] rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
                <span className="w-[5px] h-[5px] rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_ease-in-out_infinite_200ms]" />
                <span className="w-[5px] h-[5px] rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_ease-in-out_infinite_400ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}