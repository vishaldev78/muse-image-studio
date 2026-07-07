import { create } from "zustand";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "image";
  imageUrl?: string | null;
  b2Key?: string | null;
  sha256?: string | null;
  createdAt?: string;
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface GalleryItem {
  id: string;
  prompt: string;
  imageUrl: string;
  b2Key?: string | null;
  sha256?: string | null;
  createdAt: string;
}

interface AppState {
  // User
  userName: string | null;
  userAge: number | null;
  userId: string | null;
  setProfile: (name: string, age: number) => void;

  // Sessions
  sessions: Session[];
  activeSessionId: string | null;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  updateSessionTitle: (id: string, title: string) => void;

  // Messages
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendAssistantChunk: (chunk: string) => void;

  // State
  isLoading: boolean;
  isGenerating: boolean;
  setLoading: (loading: boolean) => void;
  setGenerating: (generating: boolean) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Gallery
  galleryItems: GalleryItem[];
  galleryOpen: boolean;
  setGalleryItems: (items: GalleryItem[]) => void;
  setGalleryOpen: (open: boolean) => void;

  // Input mode
  inputMode: "chat" | "image";
  setInputMode: (mode: "chat" | "image") => void;

  // Profile sheet
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // User
  userName: null,
  userAge: null,
  userId: null,
  setProfile: (name, age) => {
    if (typeof window !== "undefined") {
      let stored: { userId?: string } | null = null;
      try { stored = JSON.parse(localStorage.getItem("muse-image-user") || "{}"); } catch { /* */ }
      const userId = stored?.userId || crypto.randomUUID();
      localStorage.setItem("muse-image-user", JSON.stringify({ name, age, userId }));
      set({ userName: name, userAge: age, userId });
    } else {
      set({ userName: name, userAge: age });
    }
  },

  // Sessions
  sessions: [],
  activeSessionId: null,
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((ses) => ses.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      messages: s.activeSessionId === id ? [] : s.messages,
    })),
  setActiveSession: (id) => set({ activeSessionId: id, messages: [] }),
  updateSessionTitle: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === id ? { ...ses, title } : ses
      ),
    })),

  // Messages
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),
  appendAssistantChunk: (chunk) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant" && last.type === "text") {
        msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
      }
      return { messages: msgs };
    }),

  // State
  isLoading: false,
  isGenerating: false,
  setLoading: (isLoading) => set({ isLoading }),
  setGenerating: (isGenerating) => set({ isGenerating }),

  // Sidebar
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  // Gallery
  galleryItems: [],
  galleryOpen: false,
  setGalleryItems: (galleryItems) => set({ galleryItems }),
  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),

  // Input mode
  inputMode: "chat",
  setInputMode: (inputMode) => set({ inputMode }),

  // Profile sheet
  profileOpen: false,
  setProfileOpen: (profileOpen) => set({ profileOpen }),
}));