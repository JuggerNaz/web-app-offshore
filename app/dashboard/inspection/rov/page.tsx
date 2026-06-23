"use client";

import { Suspense } from "react";
import { LifeBuoy } from "lucide-react";
import { ROVInspectionContent } from "./page-content";

export default function ROVInspectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <LifeBuoy className="h-12 w-12 animate-bounce text-blue-600" />
        </div>
      }
    >
      <ROVInspectionContent />
    </Suspense>
  );
}
