/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Search, Send, Bot, Sparkles, Loader2, User, WifiOff } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSystemStatus } from "@/context/system-status-context";

interface Message {
    role: "human" | "ai" | "tool";
    content: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string>("");
    const [streamingMessage, setStreamingMessage] = useState<string>("");
    const [liveToolActivity, setLiveToolActivity] = useState<string>(""); // Transient — cleared on response

    const { systemStatus } = useSystemStatus();
    const isOffline = systemStatus === "offline";

    const scrollRef = useRef<HTMLDivElement>(null);
    const skipHistoryLoad = useRef(false); // Prevents loadHistory wiping messages on new sessions
    const searchParams = useSearchParams();
    const router = useRouter();

    const sessionIdFromUrl = searchParams.get("session");

    useEffect(() => {
        if (sessionIdFromUrl) {
            setCurrentSessionId(sessionIdFromUrl);
        } else {
            setCurrentSessionId(""); // No session = Welcome Screen
            setMessages([]);
        }
    }, [sessionIdFromUrl]);

    const loadHistory = useCallback(async () => {
        if (!currentSessionId) return;
        // Skip if this session was just created locally — messages are already set
        if (skipHistoryLoad.current) {
            skipHistoryLoad.current = false;
            return;
        }
        setMessages([]);   // Clear old session messages so overlay shows
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8000/api/v1/agent/history/${currentSessionId}`);
            if (!response.ok) throw new Error("History not found");
            const data = await response.json();
            setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
        } catch (error) {
            console.error("History fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    }, [currentSessionId]);

    useEffect(() => {
        if (currentSessionId) loadHistory();
    }, [loadHistory, currentSessionId]);

    useEffect(() => {
        if (scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) viewport.scrollTop = viewport.scrollHeight;
        }
    }, [messages, streamingMessage]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        let targetId = currentSessionId;
        if (!targetId) {
            targetId = uuidv4();
            skipHistoryLoad.current = true; // Don't wipe messages on loadHistory trigger
            setCurrentSessionId(targetId);
            router.push(`/?session=${targetId}`);
        }

        const userMessage = input.trim();
        setInput("");
        setIsLoading(true);
        setMessages((prev) => [...prev, { role: "human", content: userMessage }]);

        try {
            const response = await fetch(`http://localhost:8000/api/v1/agent/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage, session_id: targetId }),
            });

            if (!response.body) return;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.replace("data: ", ""));
                            if (data.type === "tool") {
                                setLiveToolActivity(data.content);
                            } else if (data.type === "text") {
                                accumulatedText = data.content;
                                setLiveToolActivity(""); // Clear tool badge once streaming starts
                                setStreamingMessage(accumulatedText);
                            }
                        } catch (e) { console.error("Parse error", e); }
                    }
                }
            }
            setMessages(prev => [...prev, { role: "ai", content: accumulatedText }]);
            setStreamingMessage("");
            setLiveToolActivity(""); // Ensure cleared on completion
            // Notify layout to re-fetch sessions now that this session is saved in DB
            window.dispatchEvent(new CustomEvent('session-updated'));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Overlay only for fresh chats (no messages yet), inline typing indicator when chatting
    const showOverlay = isLoading && !streamingMessage && messages.length === 0;
    const showTypingIndicator = isLoading && !streamingMessage && messages.length > 0;

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full px-3 py-3 md:px-4 md:py-4 relative overflow-hidden">

            {/* ── Full-screen loading overlay ── */}
            <AnimatePresence>
                {showOverlay && (
                    <motion.div
                        key="loading-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm bg-background/60 rounded-lg"
                    >
                        {/* Pulsing ring */}
                        <div className="relative flex items-center justify-center mb-5">
                            <span className="absolute inline-flex h-16 w-16 rounded-full bg-primary/20 animate-ping" />
                            <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border border-primary/30 shadow-lg shadow-primary/10">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                            </div>
                        </div>

                        {/* Label */}
                        <motion.p
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-sm font-medium text-muted-foreground tracking-wide"
                        >
                            Agent is thinking
                            <motion.span
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                            >…</motion.span>
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main content ── */}
            <AnimatePresence mode="wait">
                {!currentSessionId ? (
                    <motion.div
                        key="welcome"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex-1 min-h-0 flex flex-col items-center justify-center text-center space-y-4 md:space-y-6 px-4"
                    >
                        <div className="p-4 bg-primary/10 rounded-full">
                            <Sparkles className="w-12 h-12 text-primary" />
                        </div>
                        <h1 className="text-2xl md:text-4xl font-bold tracking-tight">How can I help you today?</h1>
                        <p className="text-muted-foreground max-w-md text-sm md:text-base">
                            I can search the web, analyze data, and remember our past conversations.
                        </p>
                    </motion.div>
                ) : (
                    <ScrollArea className="flex-1 min-h-0 pr-4" ref={scrollRef}>
                        <div className="space-y-4 pb-4">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex items-start gap-2 ${msg.role === "human" ? "justify-end" : "justify-start"}`}>
                                    {/* Bot avatar — hidden on mobile to save space */}
                                    {msg.role === "ai" && (
                                        <div className="hidden sm:flex flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 items-center justify-center mt-1">
                                            <Bot className="w-4 h-4 text-blue-500" />
                                        </div>
                                    )}

                                    {msg.role === "tool" ? null : (
                                        <Card className={`max-w-[95%] sm:max-w-[80%] p-3 md:p-3.5 ${msg.role === "human"
                                            ? "bg-primary text-primary-foreground shadow-md rounded-2xl rounded-tr-sm"
                                            : "bg-card border-border/50 rounded-2xl rounded-tl-sm"
                                            }`}>
                                            <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none overflow-hidden">
                                                {msg.role === "ai" ? (
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                                ) : (
                                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                                )}
                                            </div>
                                        </Card>
                                    )}

                                    {/* User avatar — hidden on mobile */}
                                    {msg.role === "human" && (
                                        <div className="hidden sm:flex flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 border border-primary/30 items-center justify-center mt-1">
                                            <User className="w-4 h-4 text-primary-foreground opacity-80" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* ── Live tool activity badge (transient) ── */}
                            <AnimatePresence>
                                {liveToolActivity && (
                                    <motion.div
                                        key="tool-activity"
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex justify-start"
                                    >
                                        <Badge
                                            variant="outline"
                                            className="flex gap-2 py-1.5 px-3 italic font-normal bg-muted/40 text-muted-foreground border-border/60 animate-pulse"
                                        >
                                            <Search className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                            <span className="truncate">{liveToolActivity}</span>
                                        </Badge>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Typing indicator (in-chat loader) ── */}
                            <AnimatePresence>
                                {showTypingIndicator && (
                                    <motion.div
                                        key="typing"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 8 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-end gap-2 justify-start"
                                    >
                                        <div className="hidden sm:flex flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 items-center justify-center">
                                            <Bot className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <Card className="p-3 md:p-3.5 bg-card border-border/50 rounded-2xl rounded-tl-sm">
                                            <div className="flex items-center gap-1.5 h-4">
                                                {[0, 1, 2].map((i) => (
                                                    <motion.span
                                                        key={i}
                                                        className="w-2 h-2 rounded-full bg-muted-foreground/60"
                                                        animate={{ y: [0, -5, 0] }}
                                                        transition={{
                                                            repeat: Infinity,
                                                            duration: 0.7,
                                                            delay: i * 0.15,
                                                            ease: "easeInOut",
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </Card>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Streaming buffer ── */}
                            {streamingMessage && (
                                <div className="flex items-start gap-2 justify-start">
                                    <div className="hidden sm:flex flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/30 items-center justify-center mt-1">
                                        <Bot className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <Card className="max-w-[95%] sm:max-w-[80%] p-3 md:p-3.5 bg-card border-blue-500/20 shadow-md rounded-2xl rounded-tl-sm">
                                        <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none overflow-hidden">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingMessage}</ReactMarkdown>

                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </AnimatePresence>

            {/* ── Input bar ── */}
            <div className="pt-4 border-t border-border mt-auto">
                <div className={`flex gap-2 relative group rounded-lg ring-1 transition-all duration-200 p-1
                    ${isOffline
                        ? "ring-red-500/40 bg-red-500/5"
                        : "ring-border/30 focus-within:ring-2 focus-within:ring-primary/40 bg-muted/20"
                    }`}
                >
                    {isOffline && (
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <WifiOff className="w-4 h-4 text-red-400/70" />
                        </div>
                    )}
                    <Input
                        placeholder={isOffline ? "System offline — unable to send messages" : "Type your message..."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        className={`flex-1 py-5 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm
                            ${isOffline ? "text-red-400/60 placeholder:text-red-400/50 pl-8 cursor-not-allowed" : ""}`}
                        disabled={isLoading || isOffline}
                    />
                    <Button
                        onClick={handleSendMessage}
                        disabled={isLoading || !input.trim() || isOffline}
                        className="h-9 w-9 rounded-md transition-all shadow-md self-center"
                        size="icon"
                    >
                        {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}