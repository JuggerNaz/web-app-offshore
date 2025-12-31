"use client";

import { Compass, Twitter, Linkedin, Github, Mail } from "lucide-react";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="w-full bg-slate-50 dark:bg-slate-900/50 border-t pt-24 pb-12 px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-16 relative">
        {/* Background Accent */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/5 blur-[100px] rounded-full" />

        <div className="flex flex-col gap-6 max-w-sm relative z-10">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xl transition-transform group-hover:scale-110">
              <Compass className="h-6 w-6" />
            </div>
            <span className="font-black text-2xl tracking-tighter text-slate-900 dark:text-white uppercase">
              OFFSHORE<span className="text-blue-600">Pro</span>
            </span>
          </Link>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Revolutionizing offshore asset management through digital excellence and precision engineering data.
          </p>
          <div className="flex gap-4">
            {[Twitter, Linkedin, Github, Mail].map((Icon, i) => (
              <a key={i} href="#" className="h-10 w-10 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 relative z-10">
          <div className="flex flex-col gap-6">
            <h5 className="font-black text-xs uppercase tracking-widest text-slate-900 dark:text-white">Platform</h5>
            <div className="flex flex-col gap-4">
              {['Dashboard', 'Asset Tracking', 'Inspection Planning', 'Reporting'].map((item) => (
                <Link key={item} href="#" className="font-bold text-sm text-slate-500 hover:text-blue-600 transition-colors">{item}</Link>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <h5 className="font-black text-xs uppercase tracking-widest text-slate-900 dark:text-white">Company</h5>
            <div className="flex flex-col gap-4">
              {['About Us', 'Case Studies', 'Safety First', 'Contact'].map((item) => (
                <Link key={item} href="#" className="font-bold text-sm text-slate-500 hover:text-blue-600 transition-colors">{item}</Link>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <h5 className="font-black text-xs uppercase tracking-widest text-slate-900 dark:text-white">Legal</h5>
            <div className="flex flex-col gap-4">
              {['Privacy Policy', 'Terms of Use', 'SLA'].map((item) => (
                <Link key={item} href="#" className="font-bold text-sm text-slate-500 hover:text-blue-600 transition-colors">{item}</Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          © {new Date().getFullYear()} NasQuest Resources Sdn Bhd. All rights reserved.
        </p>
        <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-300 dark:text-slate-700">
          Built for <span className="text-blue-600">Industrial Strength</span> Performance
        </div>
      </div>
    </footer>
  );
};

const DashboardFooter = () => {
  return (
    <footer className="w-full px-4 py-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-slate-400" />
          <span className="font-black text-xs tracking-tighter text-slate-900 dark:text-white uppercase">
            OFFSHORE<span className="text-blue-600">Pro</span>
          </span>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
          © {new Date().getFullYear()} NasQuest Resources
        </p>
      </div>
    </footer>
  );
};

export { Footer, DashboardFooter };
