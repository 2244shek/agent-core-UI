export const streamAgentResponse = async (
    sessionId: string,
    message: string,
    onData: (data: { type: string; content: string }) => void,
) => {
    const response = await fetch(
        `http://localhost:8000/api/v1/agent/chat/${sessionId}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
        },
    );

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        lines.forEach((line) => {
            if (line.startsWith("data: ")) {
                try {
                    const parsed = JSON.parse(line.replace("data: ", ""));
                    onData(parsed);
                } catch (e) {
                    console.error("Error parsing SSE chunk", e);
                }
            }
        });
    }
};
