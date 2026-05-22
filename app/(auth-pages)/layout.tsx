"use client";

import { Compass } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Animated Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse duration-[8s] infinite" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/20 blur-[120px] rounded-full animate-pulse duration-[10s] infinite" />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full animate-pulse duration-[12s] infinite" />

      {/* Decorative Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "24px 24px"
        }}
      />

      <div className="w-full max-w-[420px] flex flex-col gap-8 relative z-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link 
            href="/" 
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-[0_8px_30px_rgb(37,99,235,0.4)] hover:scale-105 active:scale-95 transition-all duration-300"
          >
            <Compass className="h-8 w-8 animate-spin-slow" />
          </Link>
          <div className="space-y-1 mt-2">
            <h2 className="text-3xl font-black tracking-tighter uppercase">
              OFFSHORE<span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">Pro</span>
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em]">Enterprise Asset Management</p>
          </div>
        </div>

        {/* Glassmorphic Auth Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {children}
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </div>
  );
}
