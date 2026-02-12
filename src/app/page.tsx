/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Search, Send, Bot, User } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { useSearchParams, useRouter } from "next/navigation";

interface Message {
    role: "human" | "ai" | "tool";
    content: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string>("");
    const [streamingMessage, setStreamingMessage] = useState<string>(""); // For smooth streaming

    const scrollRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const router = useRouter();

    // 1. Initialize or Update Session ID
    useEffect(() => {
        const session = searchParams.get("session");
        if (session) {
            setCurrentSessionId(session);
        } else {
            const newId = uuidv4();
            setCurrentSessionId(newId);
            // Update URL so sidebar can detect the new session
            router.replace(`?session=${newId}`);
        }
    }, [searchParams, router]);

    // 2. Load History based on currentSessionId
    const loadHistory = useCallback(async () => {
        if (!currentSessionId) return;

        try {
            const response = await fetch(`http://localhost:8000/api/v1/agent/history/${currentSessionId}`);
            if (!response.ok) throw new Error("History not found");
            const data = await response.json();
            setMessages(data.map((m: any) => ({
                role: m.role,
                content: m.content
            })));
        } catch (error) {
            console.error("Failed to load history:", error);
            setMessages([]);
        }
    }, [currentSessionId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, streamingMessage]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setIsLoading(true);
        setStreamingMessage(""); // Reset streaming buffer

        setMessages((prev) => [...prev, { role: "human", content: userMessage }]);

        try {
            const response = await fetch(`http://localhost:8000/api/v1/agent/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    session_id: currentSessionId
                }),
            });

            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedAiResponse = "";

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
                                setMessages((prev) => [...prev, { role: "tool", content: data.content }]);
                            } else if (data.type === "text") {
                                accumulatedAiResponse = data.content;
                                setStreamingMessage(accumulatedAiResponse); // Update the visual buffer
                            }
                        } catch (e) {
                            console.error("Error parsing JSON chunk", e);
                        }
                    }
                }
            }

            // Commit final message to state and clear buffer
            setMessages((prev) => [...prev, { role: "ai", content: accumulatedAiResponse }]);
            setStreamingMessage("");
        } catch (error) {
            console.error("Failed to fetch:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-4">
            <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4 pb-4" style={{maxHeight: "75vh"}}>
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}>
                            {msg.role === "tool" ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border animate-pulse">
                                    <Search className="w-3 h-3" />
                                    {msg.content}
                                </div>
                            ) : (
                                <Card className={`max-w-[80%] p-3 shadow-sm ${msg.role === "human" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                                    <div className="flex items-start gap-3">
                                        {msg.role === "ai" && <Bot className="w-5 h-5 mt-1 text-blue-500" />}
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        {msg.role === "human" && <User className="w-5 h-5 mt-1 opacity-70" />}
                                    </div>
                                </Card>
                            )}
                        </div>
                    ))}

                    {/* Visual buffer for real-time streaming */}
                    {streamingMessage && (
                        <div className="flex justify-start">
                            <Card className="max-w-[80%] p-3 shadow-sm bg-card">
                                <div className="flex items-start gap-3">
                                    <Bot className="w-5 h-5 mt-1 text-blue-500" />
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{streamingMessage}</p>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="pt-4 border-t border-border">
                <div className="flex gap-2">
                    <Input
                        placeholder="Ask your agent anything..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        className="bg-muted/50 border-border"
                        disabled={isLoading}
                    />
                    <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()} size="icon">
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}