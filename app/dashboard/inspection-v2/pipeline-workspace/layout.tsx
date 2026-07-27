import { ReactNode } from "react";

export default function PipelineWorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#020617] text-slate-100">{children}</div>;
}
