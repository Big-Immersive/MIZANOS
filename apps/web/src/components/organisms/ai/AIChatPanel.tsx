"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { Send, Trash2, Loader2, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/molecules/buttons/Button";
import { ScrollArea } from "@/components/atoms/layout/ScrollArea";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { useAIChat } from "@/hooks/features/useAIChat";
import { ChatMessage } from "./ChatMessage";
import { QuickActionButtons } from "./QuickActionButtons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  productName?: string;
  /** When true the panel renders without the fixed-position wrapper. */
  embedded?: boolean;
}

// ---------------------------------------------------------------------------
// Streaming indicator
// ---------------------------------------------------------------------------

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Thinking...</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  productId: string | null;
  onQuickAction: (action: string) => void;
  isStreaming: boolean;
}

function EmptyState({ productId, onQuickAction, isStreaming }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h4 className="font-medium mb-2">How can I help?</h4>
      <p className="text-sm text-muted-foreground mb-4">
        {productId
          ? "Ask me anything about this project \u2013 status, risks, tasks, or anything else."
          : "Select a project to get context-aware assistance, or ask me general questions."}
      </p>
      {productId && (
        <QuickActionButtons onAction={onQuickAction} disabled={isStreaming} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AIChatPanel({
  isOpen,
  onClose,
  productId,
  productName,
  embedded = false,
}: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isStreaming,
    isLoading,
    error,
    sendMessage,
    cancelStream,
    clearChat,
  } = useAIChat(productId);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages and during streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const message = input.trim();
    setInput("");
    await sendMessage(message);
  };

  const handleQuickAction = async (action: string) => {
    await sendMessage(action);
  };

  if (!isOpen) return null;

  const lastMsg = messages[messages.length - 1];
  const showStreamingIndicator =
    (isStreaming && lastMsg?.role === "assistant" && lastMsg.content === "") ||
    (lastMsg?.role === "user" && isStreaming);

  const chatBody = (
    <div className="flex flex-col flex-1 overflow-hidden">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            productId={productId}
            onQuickAction={handleQuickAction}
            isStreaming={isStreaming}
          />
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                streaming={isStreaming && msg.role === "assistant" && i === messages.length - 1}
              />
            ))}
            {showStreamingIndicator && <StreamingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {messages.length > 0 && productId && (
        <div className="px-4 py-2 border-t">
          <QuickActionButtons
            onAction={handleQuickAction}
            disabled={isStreaming}
            compact
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 border-t bg-muted/30">
        <div className="flex gap-2">
          <BaseInput
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isStreaming ? "AI is responding..." : "Ask anything..."}
            disabled={isStreaming || isLoading}
            className="flex-1"
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={cancelStream}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex justify-end mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear chat
          </Button>
        </div>
      </form>
    </div>
  );

  if (embedded) return chatBody;

  return (
    <div
      className={cn(
        "fixed bottom-24 right-6 z-50 w-96 h-[600px] max-h-[80vh]",
        "bg-background border rounded-lg shadow-2xl",
        "flex flex-col overflow-hidden",
        "animate-in slide-in-from-bottom-5 fade-in duration-300",
      )}
    >
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Mizan AI Assistant</h3>
            <p className="text-xs text-muted-foreground">
              {productName
                ? `Helping with ${productName}`
                : "General assistant"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {chatBody}
    </div>
  );
}
