"use client";

import dynamic from "next/dynamic";

// The workspace is a very large client component tree. Server-rendering it
// (Netlify SSR edge function) exceeds the edge function time limit and crashes
// in production with "the edge function timed out" (HTTP 500). Render it
// client-side only; the edge function returns just this lightweight shell.
const WorkspaceClient = dynamic(() => import("./WorkspaceClient"), {
  ssr: false,
  loading: () => (
    <div className="p-10 flex min-h-screen items-center justify-center font-bold text-slate-500">
      Loading Cockpit...
    </div>
  ),
});

export default function WorkspaceV2Page() {
  return <WorkspaceClient />;
}
