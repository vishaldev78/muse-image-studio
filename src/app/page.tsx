"use client";

import { useSyncExternalStore, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import LoginPage from "@/components/LoginPage";
import AppShell from "@/components/AppShell";

const emptySubscribe = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;

export default function Home() {
  const setProfile = useAppStore((s) => s.setProfile);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const storeName = useAppStore((s) => s.userName);

  const isClient = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  useEffect(() => {
    // Only close sidebar on small mobile screens — desktop always stays open
    if (window.innerWidth < 640) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [setSidebarOpen]);

  useEffect(() => {
    // Hydrate user profile from localStorage
    try {
      const stored = localStorage.getItem("muse-image-user");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.name) {
          setProfile(data.name, data.age || 18);
        }
      }
    } catch {
      // ignore
    }
  }, [setProfile]);

  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!storeName) {
    return <LoginPage />;
  }

  return <AppShell />;
}