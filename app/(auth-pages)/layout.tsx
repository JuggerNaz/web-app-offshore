"use client";

import { Compass } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950/20 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
      {/* Subtle Background Accents */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] rounded-full translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-[400px] flex flex-col gap-8 relative z-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link href="/" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl hover:scale-110 transition-transform">
            <Compass className="h-7 w-7" />
          </Link>
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tighter uppercase">
              OFFSHORE<span className="text-blue-600">Pro</span>
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Enterprise Asset Management</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-black/40">
          {children}
        </div>
      </div>
    </div>
  );
}
