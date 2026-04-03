"use client";

import { Bot, User } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";

import { cn } from "@/lib/utils/cn";
import type { AIChatMessage } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessageProps {
  message: AIChatMessage;
}

function cleanAssistantContent(content: string): string {
  if (!content) return content;
  // Remove standalone JSON blocks like {"key": "value"} or {_key: [...]}
  let cleaned = content.replace(/\{[^{}]*(?:"[^"]*"[^{}]*)*\}/g, (match) => {
    // Only strip if it looks like JSON (has colons and quotes/brackets)
    if (match.includes(":") && (match.includes('"') || match.includes("["))) {
      return "";
    }
    return match;
  });
  // Remove ** bold markers
  cleaned = cleaned.replace(/\*\*/g, "");
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned || content;
}

// ---------------------------------------------------------------------------
// Markdown component overrides
// ---------------------------------------------------------------------------

const markdownComponents: Components = {
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    return isInline ? (
      <code
        className="bg-background/50 px-1 py-0.5 rounded text-xs font-mono"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code
        className="block bg-background/50 p-2 rounded text-xs font-mono overflow-x-auto"
        {...props}
      >
        {children}
      </code>
    );
  },
  p: ({ children }) => (
    <p className="text-sm mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="text-sm list-disc pl-4 mb-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm list-decimal pl-4 mb-2 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
  h1: ({ children }) => (
    <h1 className="text-base font-bold mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mb-1">{children}</h3>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline hover:no-underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/50 pl-2 italic text-sm">
      {children}
    </blockquote>
  ),
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "flex-1 max-w-[85%] rounded-lg px-3 py-2",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown components={markdownComponents}>
              {cleanAssistantContent(message.content)}
            </ReactMarkdown>
          </div>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            "text-[10px] mt-1 opacity-60",
            isUser ? "text-right" : "text-left",
          )}
        >
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
