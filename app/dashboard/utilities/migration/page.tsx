"use client";

import dynamic from "next/dynamic";

// The migration dashboard is a very large client component tree (~226KB).
// Server-rendering it (Netlify SSR edge function) risks exceeding the edge
// function time limit — the same failure class as the inspection-v2 workspace
// timeout. Render it client-side only; the edge function returns just this
// lightweight shell.
const MigrationClient = dynamic(() => import("./MigrationClient"), {
  ssr: false,
  loading: () => (
    <div className="p-10 flex min-h-screen items-center justify-center font-bold text-slate-500">
      Loading Migration Dashboard...
    </div>
  ),
});

export default function MigrationPage() {
  return <MigrationClient />;
}
