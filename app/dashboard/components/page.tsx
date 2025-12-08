"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";

type Component = {
  compId: string;
  qId: string;
  description: string;
  componentType: string;
  sNode: string;
  eNode: string;
  sLeg: string;
  eLeg: string;
  elevation1: string;
  elevation2: string;
  distance: string;
  clockPos: string;
};

const componentTypes = [
  "ALL COMPONENTS",
  "ANODE",
  "BOAT BUMPER",
  "BOAT FENDER",
  "BOLLARD FAIRLEAD",
  "BRACKET SUPPORT",
  "BUTT WELD",
  "CABLE TRAY",
  "CAISSON",
  "CAISSON GUARD",
  "CASTELLATED WELD",
  "CLAMP",
  "CONDUCTOR",
  "CONDUCTOR / CAISSON",
  "CONDUCTOR GUARD",
  "CONDUCTOR GUIDE FR",
  "CONICAL STUB",
  "CRANE",
  "CRANE PEDESTAL",
  "DECK PLATE",
  "DRILLING DERRICK",
  "ELECTRICAL CABLE",
  "FACE",
  "FLARE BOOM",
  "GRATING",
  "HATCH OR DOORWAY",
  "HELIPAD",
  "HORIZONTAL DIAGONAL",
  "HORIZONTAL MEMBER",
  "HOSE / FLEXIBLE RISER",
  "IMP. CURRENT ANODE",
];

// Sample data matching the screenshot
const sampleComponents: Component[] = [
  {
    compId: "HM/000101-00010300/00000/00",
    qId: "HOM N101-N103",
    description: "HOM N101-N103",
    componentType: "HORIZONTAL MEMBER",
    sNode: "101",
    eNode: "103",
    sLeg: "A4",
    eLeg: "B4",
    elevation1: "-38.000",
    elevation2: "-38.000",
    distance: "0.00",
    clockPos: "N/A",
  },
  {
    compId: "HM/000107-00010101/00000/00",
    qId: "HOM N101-N107",
    description: "HOM N101-N107",
    componentType: "HORIZONTAL MEMBER",
    sNode: "107",
    eNode: "101",
    sLeg: "A3",
    eLeg: "A4",
    elevation1: "-38.000",
    elevation2: "-38.000",
    distance: "0.00",
    clockPos: "N/A",
  },
  {
    compId: "HM/00101A-00101B/00000/00",
    qId: "HOM N101A-N101B",
    description: "HOM N101A-N101B",
    componentType: "HORIZONTAL MEMBER",
    sNode: "101A",
    eNode: "101B",
    sLeg: "B1",
    eLeg: "A1",
    elevation1: "-27.000",
    elevation2: "-27.000",
    distance: "0.00",
    clockPos: "N/A",
  },
  {
    compId: "AN/00101A-00101B/00000/00",
    qId: "BAN101",
    description: "BAN101",
    componentType: "ANODE",
    sNode: "101A",
    eNode: "101B",
    sLeg: "B1",
    eLeg: "A1",
    elevation1: "-27.000",
    elevation2: "-27.000",
    distance: "0.00",
    clockPos: "N/A",
  },
  {
    compId: "BB/000103-00010500/00000/00",
    qId: "BOAT BUMPER 103-105",
    description: "Boat Bumper Protection",
    componentType: "BOAT BUMPER",
    sNode: "103",
    eNode: "105",
    sLeg: "B4",
    eLeg: "B3",
    elevation1: "-10.000",
    elevation2: "-10.000",
    distance: "2.50",
    clockPos: "N/A",
  },
  {
    compId: "BF/000105-00010700/00000/00",
    qId: "BOAT FENDER 105-107",
    description: "Boat Fender System",
    componentType: "BOAT FENDER",
    sNode: "105",
    eNode: "107",
    sLeg: "A1",
    eLeg: "A2",
    elevation1: "-8.000",
    elevation2: "-8.000",
    distance: "3.00",
    clockPos: "N/A",
  },
  {
    compId: "CT/000109-00011100/00000/00",
    qId: "CABLE TRAY 109-111",
    description: "Cable Tray Section",
    componentType: "CABLE TRAY",
    sNode: "109",
    eNode: "111",
    sLeg: "C4",
    eLeg: "D4",
    elevation1: "15.000",
    elevation2: "15.000",
    distance: "12.00",
    clockPos: "3:00",
  },
  {
    compId: "CL/000115-00010900/00000/00",
    qId: "CLAMP 115-109",
    description: "Structural Clamp",
    componentType: "CLAMP",
    sNode: "115",
    eNode: "109",
    sLeg: "C3",
    eLeg: "C4",
    elevation1: "20.000",
    elevation2: "20.000",
    distance: "0.50",
    clockPos: "N/A",
  },
];

export default function ComponentPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("ALL COMPONENTS");
  const [isListOpen, setIsListOpen] = useState(true);
  const [components] = useState<Component[]>(sampleComponents);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredComponents = components.filter((comp) => {
    const matchesSearch = comp.qId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      selectedType === "ALL COMPONENTS" || comp.componentType === selectedType;
    return matchesSearch && matchesType;
  });

  const handleRowClick = (component: Component) => {
    setSelectedComponent(component);
    setDialogOpen(true);
  };

  return (
    <div className="flex w-full gap-4 h-[calc(100vh-12rem)] max-w-full">
      {/* Left Sidebar - Component Types List */}
      <div className="w-64 flex-shrink-0 border rounded-md bg-muted/10 flex flex-col overflow-y-auto">
        <div className="p-4 border-b flex-shrink-0">
          <h3 className="font-semibold text-sm mb-2">Components List</h3>
          <Collapsible open={isListOpen} onOpenChange={setIsListOpen}>
            <CollapsibleTrigger className="flex items-center w-full text-sm hover:bg-muted p-1 rounded">
              {isListOpen ? (
                <ChevronDown className="h-4 w-4 mr-1" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1" />
              )}
              ALL COMPONENTS
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <div className="pl-5 space-y-1 max-h-[60vh] overflow-y-auto">
                {componentTypes.slice(1).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "w-full text-left text-xs py-1 px-2 rounded hover:bg-muted",
                      selectedType === type && "bg-muted font-medium"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 border rounded-md overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b flex-shrink-0 bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <div className="w-64">
              <Input
                placeholder="Search Q ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Button variant="outline" size="sm">
              Add new Component
            </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 bg-background relative">
          <div className="absolute inset-0 overflow-auto">
            <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b sticky top-0 bg-background z-10">
              <tr className="border-b">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[180px] min-w-[180px]">Comp. ID</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[120px] min-w-[120px]">Q ID</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[120px] min-w-[120px]">Description</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[150px] min-w-[150px]">Component Type</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[80px] min-w-[80px]">S Node</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[80px] min-w-[80px]">E Node</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[70px] min-w-[70px]">S Leg</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[70px] min-w-[70px]">E Leg</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px] min-w-[100px]">Elevation 1</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px] min-w-[100px]">Elevation 2</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[80px] min-w-[80px]">Distance</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[90px] min-w-[90px]">Clock Pos</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {/* Add new component row */}
              <tr className="border-b bg-muted/30 transition-colors hover:bg-muted/50">
                <td colSpan={12} className="p-4 align-middle font-medium">
                  <Button variant="link" className="h-auto p-0 text-sm">
                    Add new Component
                  </Button>
                </td>
              </tr>

              {/* Data rows */}
              {filteredComponents.map((comp, index) => (
                <tr 
                  key={index} 
                  className="border-b transition-colors cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(comp)}
                >
                  <td className="p-4 align-middle font-mono text-xs">{comp.compId}</td>
                  <td className="p-4 align-middle text-sm">{comp.qId}</td>
                  <td className="p-4 align-middle text-sm">{comp.description}</td>
                  <td className="p-4 align-middle text-sm">{comp.componentType}</td>
                  <td className="p-4 align-middle text-sm">{comp.sNode}</td>
                  <td className="p-4 align-middle text-sm">{comp.eNode}</td>
                  <td className="p-4 align-middle text-sm">{comp.sLeg}</td>
                  <td className="p-4 align-middle text-sm">{comp.eLeg}</td>
                  <td className="p-4 align-middle text-sm">{comp.elevation1}</td>
                  <td className="p-4 align-middle text-sm">{comp.elevation2}</td>
                  <td className="p-4 align-middle text-sm">{comp.distance}</td>
                  <td className="p-4 align-middle text-sm">{comp.clockPos}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Component Specification Dialog */}
      <ComponentSpecDialog 
        component={selectedComponent}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
