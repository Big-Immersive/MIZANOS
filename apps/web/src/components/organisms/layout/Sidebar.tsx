"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/molecules/buttons/Button";
import { MizanLogo } from "@/components/atoms/brand/MizanLogo";
import { SidebarNav } from "./SidebarNav";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleVisibility } from "@/hooks/utils/useRoleVisibility";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/atoms/feedback/Tooltip";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/atoms/display/Avatar";
import { getAvatarUrl } from "@/lib/utils/avatar";
import {
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Settings,
} from "lucide-react";
import Link from "next/link";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { primaryRole } = useRoleVisibility();

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  const userInitials =
    user?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() ||
    user?.email?.[0].toUpperCase() ||
    "U";

  return (
    <aside
      className={cn(
        "h-full bg-background border-r border-border flex flex-col shrink-0 transition-all duration-300 ease-out relative overflow-hidden",
        collapsed ? "w-16" : "w-[272px]",
      )}
    >
      {/* Logo + Toggle */}
      <div
        className={cn(
          "p-4 border-b border-border transition-all duration-300 relative z-10",
          collapsed && "px-2 py-4",
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Link href="/dashboard" className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <MizanLogo size={18} className="text-primary-foreground" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <MizanLogo size={18} className="text-primary-foreground" />
              </div>
              <h1 className="text-base font-semibold text-foreground leading-tight">
                Mizan OS
              </h1>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <SidebarNav collapsed={collapsed} />

      {/* Spacer to push user section to bottom */}
      <div className="flex-1" />

      {/* User Section */}
      <UserSection
        collapsed={collapsed}
        userInitials={userInitials}
        userName={user?.full_name}
        userEmail={user?.email}
        avatarUrl={user?.avatar_url}
        primaryRole={primaryRole}
        onSignOut={handleSignOut}
      />
    </aside>
  );
}

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  executive: "Executive",
  project_manager: "Project Manager",
  marketing: "Marketing",
  business_development: "Business Development",
  engineer: "Engineer",
};

interface UserSectionProps {
  collapsed: boolean;
  userInitials: string;
  userName?: string | null;
  userEmail?: string | null;
  avatarUrl?: string | null;
  primaryRole: string | null;
  onSignOut: () => void;
}

function UserSection({
  collapsed,
  userInitials,
  userName,
  userEmail,
  avatarUrl,
  primaryRole,
  onSignOut,
}: UserSectionProps) {
  const fullAvatarUrl = getAvatarUrl(avatarUrl);
  const avatar = (
    <Avatar className="h-9 w-9 shrink-0 cursor-default">
      {fullAvatarUrl && <AvatarImage src={fullAvatarUrl} alt={userName ?? "User"} />}
      <AvatarFallback className="text-sm font-medium">{userInitials}</AvatarFallback>
    </Avatar>
  );

  return (
    <div
      className={cn(
        "p-3 border-t border-border bg-muted/30 relative z-10",
        collapsed && "p-2",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-2 py-1.5 rounded-lg",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>{avatar}</TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{userName ?? userEmail}</p>
                {userName && userEmail && (
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                )}
                {primaryRole && (
                  <p className="text-xs text-primary/70 font-medium">
                    {ROLE_DISPLAY_LABELS[primaryRole] ?? primaryRole}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <>
            {avatar}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
                  {userName ?? userEmail}
                </p>
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                  onClick={onSignOut}
                >
                  <LogOut className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {userEmail}
              </p>
              {primaryRole && (
                <p className="text-[10px] text-primary/70 font-medium truncate">
                  {ROLE_DISPLAY_LABELS[primaryRole] ?? primaryRole}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
