"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { MessageSquare, Plus, Sparkles, Menu, X, Loader2, Pencil, Trash2, Check } from "lucide-react";
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

// ── Session row with inline rename + delete ────────────────────────────────────
function SessionRow({
    session,
    isActive,
    isOffline,
    onRename,
    onDelete,
}: {
    session: { id: string; title: string };
    isActive: boolean;
    isOffline: boolean;
    onRename: (id: string, newTitle: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(session.title);
    const [isDeleting, setIsDeleting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const startEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditValue(session.title);
        setIsEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const commitRename = async () => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== session.title) {
            await onRename(session.id, trimmed);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") commitRename();
        if (e.key === "Escape") { setEditValue(session.title); setIsEditing(false); }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDeleting(true);
        await onDelete(session.id);
        setIsDeleting(false);
    };

    const baseClass = "group flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-all";
    const stateClass = isActive
        ? "bg-accent text-accent-foreground shadow-sm"
        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";
    const disabledClass = "opacity-50 cursor-not-allowed text-muted-foreground";

    if (isOffline) {
        return (
            <div className={`${baseClass} ${disabledClass}`} title="System offline — navigation disabled">
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1 font-medium">{session.title}</span>
            </div>
        );
    }

    return (
        <div className={`${baseClass} ${stateClass} relative`}>
            {isEditing ? (
                /* ── Inline rename input ── */
                <>
                    <MessageSquare className="w-4 h-4 flex-shrink-0 text-primary" />
                    <input
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-background border border-primary/50 rounded px-2 py-0.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40 min-w-0"
                        maxLength={80}
                    />
                    <button
                        onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
                        className="p-1 rounded hover:bg-primary/10 text-primary flex-shrink-0"
                        title="Save"
                    >
                        <Check className="w-3 h-3" />
                    </button>
                </>
            ) : (
                /* ── Normal row ── */
                <>
                    <Link href={`/?session=${session.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                        <MessageSquare
                            className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className="truncate font-medium">{session.title}</span>
                    </Link>

                    {/* Action buttons — revealed on row hover */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                            onClick={startEdit}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Rename"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Delete"
                        >
                            {isDeleting
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Trash2 className="w-3 h-3" />}
                        </button>
                    </div>
                </>
            )}
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
    onRename,
    onDelete,
}: {
    sessions: { id: string; title: string }[];
    currentSessionId: string | null;
    startNewChat: () => void;
    closeSidebar: () => void;
    systemStatus: SystemStatus;
    systemFailures: string[];
    isLoadingSessions: boolean;
    onRename: (id: string, newTitle: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
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
                            sessions.map((session) => (
                                <SessionRow
                                    key={session.id}
                                    session={session}
                                    isActive={currentSessionId === session.id}
                                    isOffline={systemStatus === "offline"}
                                    onRename={onRename}
                                    onDelete={onDelete}
                                />
                            ))
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

    const handleRename = useCallback(async (id: string, newTitle: string) => {
        // Optimistic update
        setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: newTitle } : s));
        try {
            await fetch(`http://localhost:8000/api/v1/agent/sessions/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle }),
            });
        } catch {
            // Revert on failure
            fetchSessions();
        }
    }, [fetchSessions]);

    const handleDelete = useCallback(async (id: string) => {
        // Optimistic remove from list
        setSessions((prev) => prev.filter((s) => s.id !== id));
        // If deleting the active session, go back to home
        if (currentSessionId === id) router.push("/");
        try {
            await fetch(`http://localhost:8000/api/v1/agent/sessions/${id}`, {
                method: "DELETE",
            });
        } catch {
            // Revert on failure
            fetchSessions();
        }
    }, [currentSessionId, fetchSessions, router]);

    const sidebarProps = {
        sessions,
        currentSessionId,
        startNewChat,
        systemStatus,
        systemFailures,
        isLoadingSessions,
        onRename: handleRename,
        onDelete: handleDelete,
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
