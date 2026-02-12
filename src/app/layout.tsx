"use client";

import "./globals.css";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { MessageSquare, Plus, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentSessionId = searchParams.get("session");

    const fetchSessions = useCallback(async () => {
        try {
            const response = await fetch("http://localhost:8000/api/v1/agent/sessions");
            if (response.ok) {
                const data = await response.json();
                setSessions(data);
            }
        } catch (error) {
            console.error("Failed to load sessions", error);
        }
    }, []);

    // Fetch sessions on mount and whenever the URL changes (indicating a new chat saved)
    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            // Adding a tiny delay or checking mount status prevents the "cascading" warning
            if (isMounted) {
                await fetchSessions();
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [fetchSessions, currentSessionId]);

    const startNewChat = () => {
        // Navigating to root will trigger the UUID generation logic in page.tsx
        router.push("/");
    };

    return (
        <html lang="en" className="dark">
            <body className="bg-background text-foreground antialiased">
                <div className="flex h-screen w-full overflow-hidden">
                    {/* Sidebar */}
                    <aside className="w-72 border-r border-border bg-muted/20 flex flex-col">
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex items-center gap-2 px-2">
                                <Database className="w-5 h-5 text-primary" />
                                <span className="font-bold tracking-tight text-lg">Agent Core</span>
                            </div>
                            <Button
                                onClick={startNewChat}
                                variant="outline"
                                className="w-full justify-start gap-2 border-dashed"
                            >
                                <Plus className="w-4 h-4" />
                                New Chat
                            </Button>
                        </div>

                        <Separator className="opacity-50" />

                        <div className="flex-1 overflow-y-auto p-3">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground px-2 mb-3 tracking-widest">
                                Chat History
                            </p>
                            <div className="space-y-1">
                                {sessions.length === 0 ? (
                                    <p className="text-xs text-center text-muted-foreground py-10">No sessions yet</p>
                                ) : (
                                    sessions.map((session) => (
                                        <Link
                                            key={session.id}
                                            href={`/?session=${session.id}`}
                                            className={`flex items-center gap-3 p-3 text-sm rounded-lg transition-all ${currentSessionId === session.id
                                                    ? "bg-accent text-accent-foreground shadow-sm"
                                                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                                }`}
                                        >
                                            <MessageSquare className={`w-4 h-4 ${currentSessionId === session.id ? "text-primary" : "text-muted-foreground"}`} />
                                            <span className="truncate font-medium">{session.title}</span>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-muted/10">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-medium uppercase text-muted-foreground">System Online</span>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col relative bg-background">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    );
}