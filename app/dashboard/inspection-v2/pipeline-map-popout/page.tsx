"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PipelineSeabedEventMap } from "@/components/inspection/pipeline-seabed-event-map";
import { createClient } from "@/utils/supabase/client";

function PipelineMapPopoutContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const jobpackId = searchParams.get("jobpack") || searchParams.get("jobpack_id") || "0";
  const structureId = searchParams.get("structure") || searchParams.get("structure_id") || "0";
  const structureName = searchParams.get("structureName") || searchParams.get("name") || "Pipeline Main Line";
  const pipelineLength = parseFloat(searchParams.get("length") || "10.0");
  const direction = searchParams.get("dir") || searchParams.get("direction") || "Increase KP";

  return (
    <div className="w-screen h-screen bg-slate-950 overflow-hidden flex flex-col p-2">
      <PipelineSeabedEventMap
        isOpen={true}
        onClose={() => {
          if (typeof window !== "undefined") {
            window.close();
          }
        }}
        structureName={structureName}
        pipelineLengthKm={isNaN(pipelineLength) ? 10.0 : pipelineLength}
        supabase={supabase}
        jobpackId={jobpackId}
        structureId={structureId}
        inspectionDirection={direction}
      />
    </div>
  );
}

export default function PipelineMapPopoutPage() {
  return (
    <Suspense fallback={<div className="w-screen h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-bold">Loading Pipeline Map Popout Monitor...</div>}>
      <PipelineMapPopoutContent />
    </Suspense>
  );
}
