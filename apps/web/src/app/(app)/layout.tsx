"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/organisms/layout/Sidebar";
import { Header } from "@/components/organisms/layout/Header";
import { ThemeToggle } from "@/components/molecules/navigation/ThemeToggle";
import { NotificationDropdown } from "@/components/organisms/notifications/NotificationDropdown";
import { AvatarPromptDialog } from "@/components/organisms/onboarding/AvatarPromptDialog";
import { FloatingAIButton } from "@/components/organisms/ai/FloatingAIButton";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="fixed inset-0 bg-background flex overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <Header>
          <NotificationDropdown />
          <ThemeToggle />
        </Header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {children}
        </main>
        <AvatarPromptDialog />
        <FloatingAIButton productName="Mizan OS" />
      </div>
    </div>
  );
}
