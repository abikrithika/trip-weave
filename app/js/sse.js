const API_BASE = "http://localhost:5500";

export { API_BASE };

export async function consumeSseStream(response, handlers) {
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(errorBody || `Server responded with ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming is not supported in this browser.");

  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (block) => {
    const lines = block.split("\n");
    let event = "message";
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) return;

    let payload;
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      payload = dataLines.join("\n");
    }

    handlers[event]?.(payload);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (part.trim()) dispatch(part);
    }
  }

  if (buffer.trim()) dispatch(buffer);
}
