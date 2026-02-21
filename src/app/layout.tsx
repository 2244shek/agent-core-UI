import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./sidebar";

export const metadata: Metadata = {
    title: "Agent Core",
    description: "AI Agent Chat Interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="bg-background text-foreground antialiased">
                <div className="flex h-screen w-full overflow-hidden">
                    <Sidebar>{children}</Sidebar>
                </div>
            </body>
        </html>
    );
}