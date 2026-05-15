"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { WorkspaceResources } from "../../components/WorkspaceResources";

interface ComponentListPanelProps {
  compView: "LIST" | "MODEL_3D";
  setCompView: (val: "LIST" | "MODEL_3D") => void;
  compSearchTerm: string;
  setCompSearchTerm: (val: string) => void;
  componentsSow: any[];
  componentsNonSow: any[];
  selectedComp: any;
  handleComponentSelection: (comp: any) => void;
  setCompSpecDialogOpen: (val: boolean) => void;
  currentRecords: any[];
  currentCompRecords: any[];
  historicalRecords: any[];
  historyLoading: boolean;
  inspMethod: "DIVING" | "ROV";
  supabase: any;
  structureId: number;
  onRefreshComponents: () => void;
  allInspectionTypes: any[];
  structureType: "pipeline" | "platform";
  unitSystem: "METRIC" | "IMPERIAL";
  handleEditRecord: (rec: any) => void;
  handleTaskChange: (code: string) => void;
  setShowTaskSelector: (val: boolean) => void;
}

export function ComponentListPanel({
  compView,
  setCompView,
  compSearchTerm,
  setCompSearchTerm,
  componentsSow,
  componentsNonSow,
  selectedComp,
  handleComponentSelection,
  setCompSpecDialogOpen,
  currentRecords,
  currentCompRecords,
  historicalRecords,
  historyLoading,
  inspMethod,
  supabase,
  structureId,
  onRefreshComponents,
  allInspectionTypes,
  structureType,
  unitSystem,
  handleEditRecord,
  handleTaskChange,
  setShowTaskSelector,
}: ComponentListPanelProps) {
  return (
    <div className="h-full overflow-hidden flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      <WorkspaceResources
        compView={compView}
        setCompView={setCompView}
        compSearchTerm={compSearchTerm}
        setCompSearchTerm={setCompSearchTerm}
        componentsSow={componentsSow}
        componentsNonSow={componentsNonSow}
        selectedComp={selectedComp}
        handleComponentSelection={handleComponentSelection}
        handleTaskChange={handleTaskChange}
        setShowTaskSelector={setShowTaskSelector}
        setCompSpecDialogOpen={setCompSpecDialogOpen}
        currentRecords={currentRecords}
        currentCompRecords={currentCompRecords}
        historicalRecords={historicalRecords}
        historyLoading={historyLoading}
        inspMethod={inspMethod}
        supabase={supabase}
        structureId={structureId}
        onRefreshComponents={onRefreshComponents}
        allInspectionTypes={allInspectionTypes}
        structureType={structureType}
        unitSystem={unitSystem}
      />
    </div>
  );
}
