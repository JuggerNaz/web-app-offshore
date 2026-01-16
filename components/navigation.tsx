

import React from "react";

import Link from "next/link";
import HeaderAuth from "./header-auth";
import { User } from "@/app/dashboard/user";
import { DynamicBreadcrumb } from "./breadcrumb";
import { Compass } from "lucide-react";
import { Button } from "./ui/button";

const HomeNav = () => (
  <nav className="w-full flex h-20 items-center justify-center p-3 px-8 sticky top-0 z-50 transition-all bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-white/10">
    <div className="w-full max-w-7xl flex justify-between items-center text-sm">
      <div className="flex gap-4 items-center">
        <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
            <Compass className="h-6 w-6" />
          </div>
          <span className="font-black text-xl tracking-tighter text-slate-900 dark:text-white uppercase">
            OFFSHORE<span className="text-blue-600">Pro</span>
          </span>
        </Link>
        <div className="hidden md:flex ml-10 gap-8">
          <Link href="#features" className="font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Solutions</Link>
          <Link href="#company" className="font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Company</Link>
          <Link href="#resources" className="font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Resources</Link>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <HeaderAuth />
        <Button asChild size="sm" className="hidden sm:flex h-10 px-6 rounded-xl font-bold bg-slate-950 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition-all">
          <Link href="/sign-in">Sign In</Link>
        </Button>
      </div>
    </div>
  </nav>
);

export const DashboardNav = () => null;
export { HomeNav };
