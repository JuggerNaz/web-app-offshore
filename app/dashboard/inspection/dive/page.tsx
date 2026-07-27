"use client";

import { Suspense } from "react";
import { LifeBuoy } from "lucide-react";
import { DiveInspectionContent } from "./page-content";

export default function DiveInspectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <LifeBuoy className="h-12 w-12 animate-bounce text-blue-600" />
        </div>
      }
    >
      <DiveInspectionContent />
    </Suspense>
  );
}
