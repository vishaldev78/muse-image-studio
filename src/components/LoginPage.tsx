"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const setProfile = useAppStore((s) => s.setProfile);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    const ageNum = age ? parseInt(age, 10) : 18;
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 150) { toast.error("Please enter a valid age"); return; }
    setLoading(true);
    setTimeout(() => setProfile(name.trim(), ageNum), 300);
  };

  return (
    <div className="h-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border border-border shadow-none bg-card">
        <CardContent className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Muse Image Studio</h1>
            <p className="text-sm text-muted-foreground mt-1">AI Creative Studio</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Your Name</Label>
              <Input id="name" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl bg-background border-border" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age" className="text-sm font-medium">Age <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="age" type="number" placeholder="18" min="1" max="150" value={age} onChange={(e) => setAge(e.target.value)}
                className="h-11 rounded-xl bg-background border-border" />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all"
              disabled={loading}>
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>
          <p className="text-[11px] text-center text-muted-foreground/30 mt-6">Powered by Muse Image Studio</p>
        </CardContent>
      </Card>
    </div>
  );
}