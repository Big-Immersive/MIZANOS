import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onTitleClick?: () => void;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  badge,
  children,
  className,
  onTitleClick,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "-mx-6 -mt-6 px-6 py-5 mb-6 border-b border-border/60",
        "bg-background",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1
                className={cn(
                  "text-xl font-semibold text-foreground truncate",
                  onTitleClick && "cursor-pointer hover:text-primary transition-colors",
                )}
                onClick={onTitleClick}
              >
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {children && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
