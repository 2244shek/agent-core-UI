"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
// import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Send, Bot, User } from "lucide-react";

interface Message {
    role: "human" | "ai" | "tool";
    content: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages update
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setIsLoading(true);

        // Add user message to UI
        setMessages((prev) => [...prev, { role: "human", content: userMessage }]);

        try {
            // For now, using 'test-session' - we will make this dynamic later
            const response = await fetch(`http://localhost:8000/api/v1/agent/chat/test-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponse = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n\n");

                lines.forEach((line) => {
                    if (line.startsWith("data: ")) {
                        const data = JSON.parse(line.replace("data: ", ""));

                        if (data.type === "tool") {
                            // Add a tool log
                            setMessages((prev) => [...prev, { role: "tool", content: data.content }]);
                        } else if (data.type === "text") {
                            // Append to the AI response
                            aiResponse = data.content;
                        }
                    }
                });
            }

            // After streaming is done, add the final AI message
            setMessages((prev) => [...prev, { role: "ai", content: aiResponse }]);
        } catch (error) {
            console.error("Failed to fetch:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-4">
            {/* Chat History Area */}
            <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4 pb-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}>
                            {msg.role === "tool" ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border animate-pulse">
                                    <Search className="w-3 h-3" />
                                    {msg.content}
                                </div>
                            ) : (
                                <Card className={`max-w-[80%] p-3 shadow-sm ${msg.role === "human" ? "bg-primary text-primary-foreground" : "bg-card"
                                    }`}>
                                    <div className="flex items-start gap-3">
                                        {msg.role === "ai" && <Bot className="w-5 h-5 mt-1 text-blue-500" />}
                                        <p className="text-sm leading-relaxed">{msg.content}</p>
                                        {msg.role === "human" && <User className="w-5 h-5 mt-1 opacity-70" />}
                                    </div>
                                </Card>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="pt-4 border-t border-border">
                <div className="flex gap-2">
                    <Input
                        placeholder="Ask your agent anything..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        className="bg-muted/50 border-border"
                    />
                    <Button onClick={handleSendMessage} disabled={isLoading} size="icon">
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                    Agent Core v1.0 | Powered by FastAPI & LangGraph
                </p>
            </div>
        </div>
    );
}