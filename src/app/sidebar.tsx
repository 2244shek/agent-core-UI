"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { MessageSquare, Plus, Sparkles, Menu, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SystemStatusContext, type SystemStatus } from "@/context/system-status-context";

interface EndpointResult {
    label: string;
    ok: boolean;
}

// Endpoints to health-check (GET, must return 2xx)
const HEALTH_ENDPOINTS: { label: string; url: string }[] = [
    { label: "Sessions API", url: "http://localhost:8000/api/v1/agent/sessions" },
];

async function checkHealth(): Promise<{ status: SystemStatus; failures: string[] }> {
    const results: EndpointResult[] = await Promise.all(
        HEALTH_ENDPOINTS.map(async ({ label, url }) => {
            try {
                const res = await fetch(url, { method: "GET", cache: "no-store" });
                return { label, ok: res.ok };
            } catch {
                return { label, ok: false };
            }
        })
    );

    const failures = results.filter((r) => !r.ok).map((r) => r.label);
    return { status: failures.length === 0 ? "online" : "offline", failures };
}

// ── Status indicator sub-component ────────────────────────────────────────────
function SystemStatusBadge({
    status,
    failures,
}: {
    status: SystemStatus;
    failures: string[];
}) {
    const config = {
        checking: {
            dot: "bg-amber-400 animate-pulse shadow-[0_0_6px_2px_rgba(251,191,36,0.5)]",
            text: "text-amber-400",
            label: "Checking…",
        },
        online: {
            dot: "bg-green-500 animate-pulse shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]",
            text: "text-green-500",
            label: "System Online",
        },
        offline: {
            dot: "bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.5)]",
            text: "text-red-400",
            label: "System Offline",
        },
    }[status];

    return (
        <div className="p-4 border-t border-border bg-muted/10">
            <div className="flex items-center gap-3 px-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                <div className="flex flex-col min-w-0">
                    <span
                        className={`text-[10px] font-semibold uppercase tracking-widest ${config.text}`}
                    >
                        {config.label}
                    </span>
                    {status === "offline" && failures.length > 0 && (
                        <span className="text-[9px] text-muted-foreground truncate mt-0.5">
                            Unreachable: {failures.join(", ")}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Sidebar content ────────────────────────────────────────────────────────────
function SidebarContent({
    sessions,
    currentSessionId,
    startNewChat,
    closeSidebar,
    systemStatus,
    systemFailures,
    isLoadingSessions,
}: {
    sessions: { id: string; title: string }[];
    currentSessionId: string | null;
    startNewChat: () => void;
    closeSidebar: () => void;
    systemStatus: SystemStatus;
    systemFailures: string[];
    isLoadingSessions: boolean;
}) {
    return (
        <>
            <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 px-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <span className="font-bold tracking-tight text-lg">Agent Core</span>
                    </div>
                    {/* Close button — mobile only */}
                    <button
                        className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        onClick={closeSidebar}
                    >
                        <X className="w-5 h-5" />
                    </button>
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

            <div className="flex-1 overflow-y-auto p-3 sidebar-scroll">
                <div className="flex items-center justify-between px-2 mb-3">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                        Chat History
                    </p>
                    {isLoadingSessions && (
                        <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                    )}
                </div>

                {isLoadingSessions ? (
                    // Shimmer skeleton rows
                    <div className="space-y-1">
                        {[80, 60, 72].map((w, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 p-3 rounded-lg"
                            >
                                <div className="w-4 h-4 rounded bg-muted-foreground/15 animate-pulse flex-shrink-0" />
                                <div
                                    className="h-3 rounded bg-muted-foreground/15 animate-pulse"
                                    style={{ width: `${w}%` }}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {sessions.length === 0 ? (
                            <p className="text-xs text-center text-muted-foreground py-10">No sessions yet</p>
                        ) : (
                            sessions.map((session) => {
                                const isOffline = systemStatus === "offline";
                                const baseClass = `flex items-center gap-3 p-3 text-sm rounded-lg transition-all`;
                                const activeClass = currentSessionId === session.id
                                    ? "bg-accent text-accent-foreground shadow-sm"
                                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";
                                const disabledClass = "opacity-50 cursor-not-allowed text-muted-foreground";

                                return isOffline ? (
                                    <div
                                        key={session.id}
                                        className={`${baseClass} ${disabledClass}`}
                                        title="System offline — navigation disabled"
                                    >
                                        <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                        <span className="truncate font-medium">{session.title}</span>
                                    </div>
                                ) : (
                                    <Link
                                        key={session.id}
                                        href={`/?session=${session.id}`}
                                        className={`${baseClass} ${activeClass}`}
                                    >
                                        <MessageSquare
                                            className={`w-4 h-4 flex-shrink-0 ${currentSessionId === session.id ? "text-primary" : "text-muted-foreground"}`}
                                        />
                                        <span className="truncate font-medium">{session.title}</span>
                                    </Link>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            <SystemStatusBadge status={systemStatus} failures={systemFailures} />
        </>
    );
}

/**
 * Sidebar renders:
 *   - Desktop sidebar (md+)
 *   - Mobile backdrop
 *   - Mobile slide-in drawer
 *   - Mobile top bar (hamburger + title) — injected as a flex sibling of <main>
 *
 * layout.tsx uses it like:
 *   <div className="flex h-screen w-full overflow-hidden">
 *     <Sidebar>{children}</Sidebar>
 *   </div>
 *
 * We wrap children in <main> here so the mobile top bar shares the same state.
 */
export default function Sidebar({ children }: { children: React.ReactNode }) {
    const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [systemStatus, setSystemStatus] = useState<SystemStatus>("checking");
    const [systemFailures, setSystemFailures] = useState<string[]>([]);
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentSessionId = searchParams.get("session");

    const fetchSessions = useCallback(async () => {
        setIsLoadingSessions(true);
        try {
            const response = await fetch("http://localhost:8000/api/v1/agent/sessions");
            if (response.ok) {
                const data = await response.json();
                setSessions(data);
            }
        } catch (error) {
            console.error("Failed to load sessions", error);
        } finally {
            setIsLoadingSessions(false);
        }
    }, []);

    // ── Health-check polling ──────────────────────────────────────────────────
    const prevStatusRef = useRef<SystemStatus>("checking");

    const runHealthCheck = useCallback(async () => {
        const { status, failures } = await checkHealth();
        setSystemStatus(status);
        setSystemFailures(failures);
        // Auto-refresh sessions when backend recovers from offline
        if (status === "online" && prevStatusRef.current !== "online") {
            fetchSessions();
        }
        prevStatusRef.current = status;
    }, [fetchSessions]);

    useEffect(() => {
        // Run once on mount
        runHealthCheck();

        // Debounce: run at most once per 5 s of user activity
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const handleUserActivity = () => {
            if (debounceTimer) return; // already scheduled — ignore
            debounceTimer = setTimeout(() => {
                runHealthCheck();
                debounceTimer = null;
            }, 5_000);
        };

        // Re-check when user returns to this tab
        const handleVisibility = () => {
            if (document.visibilityState === "visible") runHealthCheck();
        };

        document.addEventListener("click", handleUserActivity);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            document.removeEventListener("click", handleUserActivity);
            document.removeEventListener("visibilitychange", handleVisibility);
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    }, [runHealthCheck]);

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            if (isMounted) await fetchSessions();
        };
        loadData();
        return () => { isMounted = false; };
    }, [fetchSessions, currentSessionId]);

    useEffect(() => {
        const handleSessionSaved = () => fetchSessions();
        window.addEventListener("session-updated", handleSessionSaved);
        return () => window.removeEventListener("session-updated", handleSessionSaved);
    }, [fetchSessions]);

    // Close sidebar on session navigation (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [currentSessionId]);

    const startNewChat = () => {
        router.push("/");
        setSidebarOpen(false);
    };

    const sidebarProps = {
        sessions,
        currentSessionId,
        startNewChat,
        systemStatus,
        systemFailures,
        isLoadingSessions,
    };

    return (
        <SystemStatusContext.Provider value={{ systemStatus, systemFailures }}>
            {/* ── Desktop sidebar (md+) ── */}
            <aside className="hidden md:flex w-72 border-r border-border bg-muted/20 flex-col">
                <SidebarContent
                    {...sidebarProps}
                    closeSidebar={() => setSidebarOpen(false)}
                />
            </aside>

            {/* ── Mobile backdrop ── */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Mobile slide-in drawer ── */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border flex flex-col
                    transform transition-transform duration-300 ease-in-out md:hidden
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
                <SidebarContent
                    {...sidebarProps}
                    closeSidebar={() => setSidebarOpen(false)}
                />
            </aside>

            {/* ── Main content area (flex-1) ── */}
            <main className="flex-1 min-h-0 flex flex-col relative bg-background">
                {/* Mobile top bar */}
                <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm flex-shrink-0">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm tracking-tight">Agent Core</span>
                    </div>
                    {currentSessionId && (
                        <button
                            onClick={startNewChat}
                            className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {children}
            </main>
        </SystemStatusContext.Provider>
    );
}
