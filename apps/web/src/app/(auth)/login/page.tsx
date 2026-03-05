"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LoginForm } from "@/components/organisms/auth/LoginForm";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-12 text-white">
        <div>
          <svg width="40" height="40" viewBox="0 0 32 32" className="mb-1">
            <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.15)" />
            <path d="M25 1.5 L26.2 3.8 L28.5 5 L26.2 6.2 L25 8.5 L23.8 6.2 L21.5 5 L23.8 3.8 Z" fill="white" opacity="0.9" />
            <circle cx="16" cy="9" r="3.5" fill="white" opacity="0.9" />
            <line x1="12.8" y1="11.5" x2="6" y2="17" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="19.2" y1="11.5" x2="26" y2="17" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="6" y1="17" x2="6" y2="20" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="3" y1="20" x2="9" y2="20" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="26" y1="17" x2="26" y2="20" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="23" y1="20" x2="29" y2="20" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="16" y1="12.5" x2="16" y2="27" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="27" x2="22" y2="27" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="7" r="1.2" fill="white" opacity="0.55" />
          </svg>
          <span className="text-lg font-semibold tracking-tight opacity-90">
            Mizan
          </span>
        </div>

        <div className="space-y-6">
          <blockquote className="text-2xl/relaxed font-light tracking-tight opacity-95">
            Streamline your product lifecycle from intake to delivery&nbsp;&mdash;
            one platform for specs, tasks, audits, and team management.
          </blockquote>
          <div className="flex items-center gap-3 text-sm opacity-70">
            <div className="h-px w-8 bg-white/40" />
            Product Lifecycle Management
          </div>
        </div>

        <p className="text-xs opacity-40">
          &copy; {new Date().getFullYear()} Mizan. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <svg width="32" height="32" viewBox="0 0 32 32">
              <defs>
                <linearGradient id="mg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="url(#mg)" />
              <path d="M25 1.5 L26.2 3.8 L28.5 5 L26.2 6.2 L25 8.5 L23.8 6.2 L21.5 5 L23.8 3.8 Z" fill="white" opacity="0.9" />
              <circle cx="16" cy="9" r="3.5" fill="white" />
              <line x1="12.8" y1="11.5" x2="6" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="19.2" y1="11.5" x2="26" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="6" y1="17" x2="6" y2="20" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3" y1="20" x2="9" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="26" y1="17" x2="26" y2="20" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="23" y1="20" x2="29" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="16" y1="12.5" x2="16" y2="27" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              <line x1="10" y1="27" x2="22" y2="27" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              <circle cx="10" cy="7" r="1.2" fill="white" opacity="0.55" />
            </svg>
            <span className="text-lg font-semibold tracking-tight">Mizan</span>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <LoginForm
              onSuccess={() => { window.location.href = redirect; }}
              onForgotPassword={() => router.push("/reset-password")}
            />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Access is by invitation only. Contact your administrator for the access.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
