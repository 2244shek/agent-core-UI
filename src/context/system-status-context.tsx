"use client";

import { createContext, useContext } from "react";

export type SystemStatus = "checking" | "online" | "offline";

interface SystemStatusContextValue {
    systemStatus: SystemStatus;
    systemFailures: string[];
}

export const SystemStatusContext = createContext<SystemStatusContextValue>({
    systemStatus: "checking",
    systemFailures: [],
});

export function useSystemStatus() {
    return useContext(SystemStatusContext);
}
