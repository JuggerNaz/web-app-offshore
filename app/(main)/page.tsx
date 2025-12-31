"use client";

import { Message } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Compass,
  ShieldCheck,
  Layers,
  BarChart3,
  Workflow,
  ChevronRight,
  Database,
  Search,
  ArrowRight
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen -mt-5 -mx-5 bg-white dark:bg-slate-950">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/platform_ai.jpeg"
            alt="Offshore Platform"
            fill
            className="object-cover brightness-[0.4] scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/90" />
        </div>

        {/* Content */}
        <div className="container relative z-10 px-6 mx-auto flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold tracking-widest uppercase">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Next-Gen Asset Integrity Management
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-6 max-w-4xl drop-shadow-2xl">
            Precision Engineering for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Offshore Excellence</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mb-10 leading-relaxed font-medium">
            Streamline your offshore structural integrity, inspection planning, and reporting with our enterprise-grade data management suite.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button asChild size="lg" className="h-14 px-8 text-base font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all hover:scale-105 active:scale-95">
              <Link href="/sign-in">
                Access Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base font-bold rounded-2xl border-white/20 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 transition-all hover:scale-105">
              <Link href="#features">Explore Solutions</Link>
            </Button>
          </div>
        </div>

        {/* Floating Stats */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-5xl px-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Asset Reliability", val: "99.9%" },
            { label: "Data Accuracy", val: "REAL-TIME" },
            { label: "Efficiency Gain", val: "40%+" },
            { label: "Support", val: "24/7" },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-center">
              <div className="text-2xl font-black text-white leading-none mb-1">{stat.val}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400">Comprehensive Solutions</h2>
            <h3 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">Built for Industry Leaders</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Layers className="h-8 w-8" />}
              title="Asset Management"
              desc="Full lifecycle tracking for Platforms and Pipelines with interactive structural visuals and detailed specifications."
              color="blue"
            />
            <FeatureCard
              icon={<Search className="h-8 w-8" />}
              title="Inspection Planning"
              desc="Intelligent planning tools to manage complex subsea and topside inspection campaigns with ease."
              color="emerald"
            />
            <FeatureCard
              icon={<BarChart3 className="h-8 w-8" />}
              title="Analytics & Reporting"
              desc="Generate detailed integrity reports and visualize data trends across your entire field portfolio."
              color="orange"
            />
            <FeatureCard
              icon={<Database className="h-8 w-8" />}
              title="Secure Data Vault"
              desc="Enterprise-grade security for your engineering documents, metadata, and critical field assets."
              color="indigo"
            />
            <FeatureCard
              icon={<Workflow className="h-8 w-8" />}
              title="Work Packaging"
              desc="Efficiently bundle inspections into job packs with digital sign-offs and real-time progress tracking."
              color="purple"
            />
            <FeatureCard
              icon={<ShieldCheck className="h-8 w-8" />}
              title="Regulatory Compliance"
              desc="Maintain full audit trails and ensure your operations meet international offshore standards."
              color="red"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="container mx-auto max-w-5xl rounded-[3rem] bg-slate-900 dark:bg-white p-12 md:p-20 text-center relative overflow-hidden">
          {/* Animated Background Element */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full" />

          <h2 className="text-4xl md:text-5xl font-black text-white dark:text-slate-950 mb-8 relative z-10 leading-tight">
            Ready to Transform Your <br /> Offshore Operations?
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <Button asChild size="lg" className="h-16 px-10 text-lg font-bold rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-100 transition-transform hover:scale-105 active:scale-95 shadow-2xl">
              <Link href="/sign-in">Get Started Now</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-16 px-10 text-lg font-bold rounded-2xl text-white dark:text-slate-950 border border-white/20 dark:border-slate-900/20 hover:bg-white/10 dark:hover:bg-slate-900/5 transition-all">
              <Link href="/contact">Schedule a Demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode, title: string, desc: string, color: string }) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
    orange: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
    red: "text-red-600 bg-red-50 dark:bg-red-900/20",
  };

  return (
    <div className="group p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:shadow-2xl hover:shadow-slate-200 dark:hover:shadow-black/40 transition-all duration-500 hover:-translate-y-2">
      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110", colorMap[color])}>
        {icon}
      </div>
      <h4 className="text-xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">{title}</h4>
      <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
        {desc}
      </p>
      <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link href={`#${title.toLowerCase().replace(' ', '-')}`} className="inline-flex items-center text-sm font-bold text-blue-600">
          Learn More <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
