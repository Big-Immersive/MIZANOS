"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { MessageCircle, X, Minus, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/molecules/buttons/Button";
import { useDraggable } from "@/hooks/features/useDraggable";
import { AIChatPanel } from "./AIChatPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FloatingAIButtonProps {
  productId?: string | null;
  productName?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUBBLE_SIZE = 56;
const PANEL_WIDTH = 384;
const PANEL_HEIGHT = 500;
const GAP = 12;
const EDGE_PADDING = 16;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePanelStyle(
  bubbleX: number,
  bubbleY: number,
  openDirection: "top" | "bottom",
): CSSProperties {
  let left = bubbleX;
  let top = bubbleY;

  if (bubbleX + PANEL_WIDTH > window.innerWidth - EDGE_PADDING) {
    left = bubbleX - PANEL_WIDTH + BUBBLE_SIZE;
  }

  if (openDirection === "top") {
    top = bubbleY - PANEL_HEIGHT - GAP;
    if (top < EDGE_PADDING) {
      top = bubbleY + BUBBLE_SIZE + GAP;
    }
  } else {
    top = bubbleY + BUBBLE_SIZE + GAP;
    if (top + PANEL_HEIGHT > window.innerHeight - EDGE_PADDING) {
      top = bubbleY - PANEL_HEIGHT - GAP;
    }
  }

  if (left < EDGE_PADDING) left = EDGE_PADDING;
  if (left + PANEL_WIDTH > window.innerWidth - EDGE_PADDING) {
    left = window.innerWidth - PANEL_WIDTH - EDGE_PADDING;
  }

  return { position: "fixed", left: `${left}px`, top: `${top}px`, zIndex: 50 };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FloatingAIButton({
  productId,
  productName,
}: FloatingAIButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelDirection, setPanelDirection] = useState<"top" | "bottom">("top");

  const {
    position,
    isDragging,
    wasDragged,
    handleMouseDown,
    handleTouchStart,
  } = useDraggable();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const midY = window.innerHeight / 2;
    setPanelDirection(position.y > midY ? "top" : "bottom");
  }, [position]);

  const handleBubbleClick = useCallback(() => {
    if (!wasDragged) {
      setIsOpen((prev) => !prev);
    }
  }, [wasDragged]);

  const handleMinimize = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      {/* Draggable bubble */}
      <div
        className={cn("fixed z-50 select-none", isDragging && "cursor-grabbing")}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: "none",
        }}
      >
        <div
          className={cn(
            "relative h-14 w-14 rounded-full shadow-lg transition-all duration-200",
            "bg-primary hover:bg-primary/90",
            "flex items-center justify-center",
            isDragging && "shadow-2xl scale-105 opacity-90",
            !isDragging && "hover:scale-105 cursor-grab",
            isOpen && "ring-2 ring-primary/30 ring-offset-2",
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={handleBubbleClick}
          role="button"
          aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
          aria-expanded={isOpen}
        >
          <div
            className={cn(
              "transition-transform duration-300",
              isOpen && "rotate-180",
            )}
          >
            {isOpen ? (
              <X className="h-6 w-6 text-primary-foreground" />
            ) : (
              <MessageCircle className="h-6 w-6 text-primary-foreground" />
            )}
          </div>

          {productId && !isOpen && (
            <span
              className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-status-healthy animate-pulse"
              aria-label="Context available"
            />
          )}
        </div>
      </div>

      {/* Chat panel */}
      {isOpen && (
        <div style={computePanelStyle(position.x, position.y, panelDirection)}>
          <div
            className={cn(
              "w-96 h-[500px] max-h-[80vh]",
              "bg-background border rounded-lg shadow-2xl",
              "flex flex-col overflow-hidden",
              "animate-in fade-in-0 zoom-in-95 duration-200",
            )}
          >
            {/* Draggable header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Mizan AI Assistant</h3>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {productName ?? "General assistant"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMinimize}
                className="h-7 w-7"
                aria-label="Minimise"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>

            <AIChatPanel
              isOpen={isOpen}
              onClose={handleMinimize}
              productId={productId ?? null}
              productName={productName}
              embedded
            />
          </div>
        </div>
      )}
    </>
  );
}
