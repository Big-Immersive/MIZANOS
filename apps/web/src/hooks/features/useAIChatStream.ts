"use client";

import { useState, useCallback, useRef } from "react";
import type { AIChatMessage } from "@/lib/types";
import { aiRepository } from "@/lib/api/repositories";

interface UseAIChatStreamOptions {
  onChunk: (content: string, messageId: string) => void;
  onError: (error: string) => void;
}

export function useAIChatStream({ onChunk, onError }: UseAIChatStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const streamMessage = useCallback(
    async (
      sessionId: string,
      contextMessages: AIChatMessage[],
      assistantMsgId: string,
    ) => {
      setIsStreaming(true);
      let content = "";

      try {
        abortRef.current = new AbortController();

        const messages = contextMessages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await aiRepository.streamChat(
          sessionId,
          messages,
          abortRef.current.signal,
        );

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6);
            if (jsonStr.trim() === "[DONE]") break;
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                content += delta;
                onChunk(content, assistantMsgId);
              }
            } catch {
              // Not JSON — treat as plain text chunk from backend
              if (jsonStr) {
                content += jsonStr;
                onChunk(content, assistantMsgId);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        onError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [onChunk, onError],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { isStreaming, streamMessage, cancelStream };
}
