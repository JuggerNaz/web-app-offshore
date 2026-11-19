"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnodeHistoryView } from "@/components/component/anode-history-view";

export default function ComponentAnodeHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const componentId = Number(params?.id);

  if (!componentId || Number.isNaN(componentId)) {
    return (
      <div className="p-8 text-sm text-rose-600">
        Invalid Anode Component ID.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="rounded-xl text-xs font-bold text-slate-600"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Components
        </Button>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8 shadow-sm">
        <AnodeHistoryView componentId={componentId} isFullPage />
      </div>
    </div>
  );
}
