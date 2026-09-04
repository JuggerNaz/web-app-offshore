"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function PipelineWorkspaceRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const paramsStr = searchParams.toString();
    const destination = paramsStr
      ? `/dashboard/inspection-v2/workspace?${paramsStr}`
      : "/dashboard/inspection-v2/workspace";
    router.replace(destination);
  }, [searchParams, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        <p className="text-sm font-semibold text-slate-300">Loading Pipeline Inspection Workspace...</p>
      </div>
    </div>
  );
}

export default function PipelineWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      }
    >
      <PipelineWorkspaceRedirect />
    </Suspense>
  );
}
