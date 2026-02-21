/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Search, Send, Bot, Sparkles, Loader2, User } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

    const scrollRef = useRef<HTMLDivElement>(null);
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
                                setMessages(prev => [...prev, { role: "tool", content: data.content }]);
                            } else if (data.type === "text") {
                                accumulatedText = data.content;
                                setStreamingMessage(accumulatedText);
                            }
                        } catch (e) { console.error("Parse error", e); }
                    }
                }
            }
            setMessages(prev => [...prev, { role: "ai", content: accumulatedText }]);
            setStreamingMessage("");
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-4 relative">
            <AnimatePresence mode="wait">
                {!currentSessionId ? (
                    <motion.div
                        key="welcome"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
                    >
                        <div className="p-4 bg-primary/10 rounded-full">
                            <Sparkles className="w-12 h-12 text-primary" />
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight">How can I help you today?</h1>
                        <p className="text-muted-foreground max-w-md">
                            I can search the web, analyze data, and remember our past conversations.
                        </p>
                    </motion.div>
                ) : (
                    <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                        <div className="space-y-4 pb-4">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}>
                                    {msg.role === "tool" ? (
                                        <Badge variant="outline" className="animate-pulse flex gap-2 py-1 italic font-normal bg-muted/30">
                                            <Search className="w-3 h-3" /> {msg.content}
                                        </Badge>
                                    ) : (
                                        <Card className={`max-w-[85%] p-4 ${msg.role === "human" ? "bg-primary text-primary-foreground shadow-lg" : "bg-card border-border/50"}`}>
                                            <div className="flex gap-3">
                                                {msg.role === "ai" && <Bot className="w-5 h-5 mt-1 text-blue-500 flex-shrink-0" />}
                                                <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none overflow-hidden">
                                                    {msg.role === "ai" ? (
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                                    ) : (
                                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                                    )}
                                                </div>
                                                {msg.role === "human" && <User className="w-5 h-5 mt-1 opacity-70 flex-shrink-0" />}
                                            </div>
                                        </Card>
                                    )}
                                </div>
                            ))}

                            {/* STREAMING BUFFER */}
                            {streamingMessage && (
                                <div className="flex justify-start">
                                    <Card className="max-w-[85%] p-4 bg-card border-blue-500/20 shadow-md">
                                        <div className="flex gap-3">
                                            <Bot className="w-5 h-5 mt-1 text-blue-500 flex-shrink-0" />
                                            <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none overflow-hidden">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingMessage}</ReactMarkdown>
                                                <motion.span
                                                    animate={{ opacity: [0, 1, 0] }}
                                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                                    className="inline-block w-2 h-4 bg-primary ml-1 align-middle"
                                                />
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {isLoading && !streamingMessage && (
                                <div className="flex justify-start items-center gap-2 text-muted-foreground text-xs p-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Agent is processing...</span>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </AnimatePresence>

            <div className="pt-4 border-t border-border mt-auto">
                <div className="flex gap-2 relative">
                    <Input
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        className="pr-12 py-6 bg-muted/30 border-border/50 focus-visible:ring-primary"
                        disabled={isLoading}
                    />
                    <Button
                        onClick={handleSendMessage}
                        disabled={isLoading || !input.trim()}
                        className="absolute right-1.5 top-1.5 h-9 w-9 rounded-md transition-all shadow-md"
                        size="icon"
                    >
                        {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}