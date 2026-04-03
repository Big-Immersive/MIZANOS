"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { aiRepository } from "@/lib/api/repositories";
import { useAuth } from "@/contexts/AuthContext";
import type { AIChatMessage, AIChatSession } from "@/lib/types";
import { useAIChatStream } from "./useAIChatStream";

export function useAIChat(productId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<AIChatMessage[]>(messages);
  messagesRef.current = messages;

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["ai-chat-session", productId, user?.id],
    queryFn: async (): Promise<AIChatSession | null> => {
      if (!user?.id) return null;
      const sessions = await aiRepository.getSessions();
      const existing = sessions.find(
        (s) => (productId ? s.product_id === productId : !s.product_id),
      );
      if (existing) {
        sessionIdRef.current = existing.id;
        const msgs = await aiRepository.getMessages(existing.id);
        setMessages(msgs);
        return existing;
      }
      const newSession = await aiRepository.createSession(
        productId || undefined,
      );
      sessionIdRef.current = newSession.id;
      setMessages([]);
      return newSession;
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  useEffect(() => {
    if (productId !== undefined) {
      sessionIdRef.current = null;
      setMessages([]);
      setError(null);
    }
  }, [productId]);

  const { isStreaming, streamMessage, cancelStream } = useAIChatStream({
    onChunk: (content, msgId) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, content } : m)),
      );
    },
    onError: (err) => setError(err),
  });

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!session || isStreaming) return;
      setError(null);

      const userMsgId = crypto.randomUUID();
      const userMsg: AIChatMessage = {
        id: userMsgId,
        session_id: session.id,
        role: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Skip sendMessage POST — the streaming endpoint saves the message
      const assistantMsgId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          session_id: session.id,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
        },
      ]);

      // Pass user message explicitly since state may not be updated yet
      const msgsForStream = [...messagesRef.current];
      // Ensure the user message is in the list
      if (!msgsForStream.some((m) => m.id === userMsgId)) {
        msgsForStream.push(userMsg);
      }
      await streamMessage(session.id, msgsForStream, assistantMsgId);
    },
    [session, isStreaming, streamMessage],
  );

  const clearChat = useCallback(async () => {
    if (!session) return;
    await aiRepository.deleteSession(session.id);
    setMessages([]);
    setError(null);
    queryClient.invalidateQueries({
      queryKey: ["ai-chat-session", productId, user?.id],
    });
  }, [session, productId, user?.id, queryClient]);

  return {
    messages,
    isStreaming,
    isLoading: sessionLoading,
    error,
    sendMessage,
    cancelStream,
    clearChat,
    session,
  };
}
