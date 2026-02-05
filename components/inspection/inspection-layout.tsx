import { ReactNode } from "react";

interface InspectionLayoutProps {
    leftPanel: ReactNode;
    centerPanel: ReactNode;
    rightPanel: ReactNode;
}

export function InspectionLayout({ leftPanel, centerPanel, rightPanel }: InspectionLayoutProps) {
    return (
        <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-950 text-slate-200">
            {/* Left Panel: Inspection Progress & Validation */}
            <aside className="w-[280px] shrink-0 border-r border-slate-800 bg-slate-900/50 p-4 overflow-y-auto hidden lg:block">
                {leftPanel}
            </aside>

            {/* Center Panel: Primary Data Entry */}
            <main className="flex-1 overflow-y-auto bg-slate-950 p-6 relative">
                <div className="max-w-3xl mx-auto">
                    {centerPanel}
                </div>
            </main>

            {/* Right Panel: Context & Visualization */}
            <aside className="w-[320px] shrink-0 border-l border-slate-800 bg-slate-900/50 p-4 overflow-y-auto hidden xl:block">
                {rightPanel}
            </aside>
        </div>
    );
}
