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

            const payload = line.slice(6);
            if (payload.trim() === "[DONE]") break;
            if (!payload) continue;

            let delta: string;
            try {
              delta = JSON.parse(payload) as string;
            } catch {
              delta = payload;
            }

            if (delta) {
              content += delta;
              onChunk(content, assistantMsgId);
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
