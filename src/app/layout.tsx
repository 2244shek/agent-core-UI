import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.className} bg-background text-foreground`}>
                <div className="flex h-screen w-full overflow-hidden">
                    {/* Sidebar Area */}
                    <aside className="w-64 border-r border-border bg-muted/30 flex flex-col">
                        <div className="p-4 border-b font-bold tracking-tight text-lg">
                            Agent Core
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {/* This is where we will map your Chat History later */}
                            <p className="text-xs text-muted-foreground p-2">Recent Chats</p>
                            <div className="space-y-1">
                                <div className="p-2 text-sm bg-accent rounded-md cursor-pointer">
                                    test-session
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 flex flex-col relative">{children}</main>
                </div>
            </body>
        </html>
    );
}
