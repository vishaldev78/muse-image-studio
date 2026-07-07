"use client";

import { useAppStore } from "@/lib/store";
import { useTheme } from "next-themes";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LogOut, User, Sparkles, Calendar, X, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ProfileSheet() {
  const { profileOpen, setProfileOpen, userName, userAge } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    localStorage.removeItem("muse-user");
    window.location.reload();
  };

  const isDark = mounted && theme === "dark";

  return (
    <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
      <SheetContent side="right" className="w-full max-w-sm bg-card border-border p-0" aria-describedby={undefined}>
        <VisuallyHidden><SheetTitle>Profile</SheetTitle></VisuallyHidden>
        {/* Close button */}
        <button
          onClick={() => setProfileOpen(false)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close profile"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col h-full">
          {/* Header with avatar */}
          <div className="pt-8 pb-5 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold uppercase mx-auto mb-4">
              {userName?.charAt(0) || "U"}
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {userName || "User"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Muse AI Member
            </p>
          </div>

          <Separator className="bg-border" />

          {/* Profile details */}
          <div className="flex-1 px-6 py-4 space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3 px-1">
              Profile Info
            </h3>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background">
              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Name</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {userName || "User"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Age</p>
                <p className="text-sm font-medium text-foreground">
                  {userAge || "Not set"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background">
              <Sparkles className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Status</p>
                <p className="text-sm font-medium text-foreground">
                  Active Now
                </p>
              </div>
            </div>

            {/* Theme toggle */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-background mt-1">
              <div className="flex items-center gap-3">
                {isDark ? (
                  <Moon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Theme</p>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {mounted ? theme : "Dark"} Mode
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: isDark ? "var(--primary)" : "var(--muted-foreground)" }}
                aria-label="Toggle theme"
              >
                <span
                  className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform"
                  style={{ transform: isDark ? "translateX(20px)" : "translateX(0)" }}
                >
                  <span className="flex h-full w-full items-center justify-center">
                    {isDark ? (
                      <Moon className="h-3 w-3 text-foreground" />
                    ) : (
                      <Sun className="h-3 w-3 text-foreground" />
                    )}
                  </span>
                </span>
              </button>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Actions at bottom */}
          <div className="shrink-0 p-4 space-y-2">
            <Button
              variant="destructive"
              className="w-full h-11 rounded-xl font-medium gap-2"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </Button>
            <p className="text-[10px] text-center text-muted-foreground/30 pt-1">
              Muse Image Studio
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}