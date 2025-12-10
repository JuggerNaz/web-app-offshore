"use client";

import { useState, useEffect } from "react";
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
import { useAtom } from "jotai";
import { urlId } from "@/utils/client-state";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";

type Component = {
  id: number;
  comp_id: number;
  structure_id: number;
  q_id: string;
  id_no: string;
  code: string | null;
  metadata: any;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  modified_by: string | null;
};

type ComponentType = {
  id: number;
  name: string | null;
  code: string | null;
  descrip: string | null;
  is_active: boolean;
};

export default function ComponentContent() {
  const [structureId] = useAtom(urlId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("ALL COMPONENTS");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [isListOpen, setIsListOpen] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'create'>('view');
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);

  // Fetch component types
  useEffect(() => {
    const fetchComponentTypes = async () => {
      try {
        const response = await fetch("/api/components");
        if (!response.ok) {
          throw new Error("Failed to fetch component types");
        }
        const result = await response.json();
        setComponentTypes(result.data || []);
      } catch (error) {
        console.error("Error fetching component types:", error);
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchComponentTypes();
  }, []);

  // Fetch structure components based on structure_id and selected code
  const apiUrl = structureId
    ? `/api/structure-components/${structureId}${
        selectedCode ? `?code=${encodeURIComponent(selectedCode)}` : ""
      }`
    : null;

  const {
    data: componentsData,
    error: componentsError,
    isLoading: isLoadingComponents,
  } = useSWR(apiUrl, fetcher);

  const components = componentsData?.data || [];

  // Filter components by search query
  const filteredComponents = components.filter((comp: Component) => {
    const matchesSearch = comp.q_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleRowClick = (component: Component) => {
    setSelectedComponent(component);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleAddNewComponent = () => {
    // Create an empty component object for create mode
    setSelectedComponent(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleTypeClick = (typeName: string | null, typeCode: string | null) => {
    setSelectedType(typeName || "ALL COMPONENTS");
    setSelectedCode(typeCode);
  };

  return (
    <div className="flex w-full gap-4 h-[calc(100vh-12rem)] max-w-full">
      {/* Left Sidebar - Component Types List */}
      <div className="w-64 flex-shrink-0 border rounded-md bg-muted/10 flex flex-col overflow-y-auto">
        <div className="p-4 border-b flex-shrink-0">
          <h3 className="font-semibold text-sm mb-2">Components List</h3>
          <button
            onClick={() => handleTypeClick("ALL COMPONENTS", null)}
            className={cn(
              "w-full text-left text-sm py-1 px-2 rounded hover:bg-muted mb-2",
              selectedType === "ALL COMPONENTS" && "bg-muted font-medium"
            )}
          >
            ALL COMPONENTS
          </button>
          <Collapsible open={isListOpen} onOpenChange={setIsListOpen}>
            <CollapsibleTrigger className="flex items-center w-full text-sm hover:bg-muted p-1 rounded">
              {isListOpen ? (
                <ChevronDown className="h-4 w-4 mr-1" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1" />
              )}
              Component Types
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <div className="pl-5 space-y-1 max-h-[60vh] overflow-y-auto">
                {isLoadingTypes ? (
                  <div className="text-xs text-muted-foreground py-2 px-2">Loading...</div>
                ) : componentTypes.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 px-2">No active components</div>
                ) : (
                  componentTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleTypeClick(type.name, type.code)}
                      className={cn(
                        "w-full text-left text-xs py-1 px-2 rounded hover:bg-muted",
                        selectedType === type.name && "bg-muted font-medium"
                      )}
                    >
                      {type.name}
                    </button>
                  ))
                )}
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
            <Button variant="outline" size="sm" onClick={handleAddNewComponent}>
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
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[180px] min-w-[180px]">ID No</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[120px] min-w-[120px]">Q ID</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px] min-w-[100px]">Code</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[80px] min-w-[80px]">S Node</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[80px] min-w-[80px]">E Node</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[70px] min-w-[70px]">S Leg</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[70px] min-w-[70px]">E Leg</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px] min-w-[100px]">Elevation 1</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px] min-w-[100px]">Elevation 2</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[80px] min-w-[80px]">Distance</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[90px] min-w-[90px]">Clock Pos</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[150px] min-w-[150px]">Created At</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {/* Loading state */}
              {isLoadingComponents && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-muted-foreground">
                    Loading components...
                  </td>
                </tr>
              )}

              {/* Error state */}
              {componentsError && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-destructive">
                    Failed to load components
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {!isLoadingComponents && !componentsError && filteredComponents.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-muted-foreground">
                    {structureId ? "No components found" : "Please select a structure to view components"}
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!isLoadingComponents && !componentsError && filteredComponents.map((comp: Component) => (
                <tr 
                  key={comp.id} 
                  className="border-b transition-colors cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(comp)}
                >
                  <td className="p-4 align-middle font-mono text-xs">{comp.id_no}</td>
                  <td className="p-4 align-middle text-sm">{comp.q_id}</td>
                  <td className="p-4 align-middle text-sm">{comp.code || "-"}</td>
                  <td className="p-4 align-middle text-sm">{comp.metadata?.s_node ?? "-"}</td>
                  <td className="p-4 align-middle text-sm">{comp.metadata?.f_node ?? "-"}</td>
                  <td className="p-4 align-middle text-sm">{comp.metadata?.s_leg ?? "-"}</td>
                  <td className="p-4 align-middle text-sm">{comp.metadata?.f_leg ?? "-"}</td>
                  <td className="p-4 align-middle text-sm">{comp.metadata?.elv_1 ?? "-"}</td>
                  <td className="p-4 align-middle text-sm">{comp.metadata?.elv_2 ?? "-"}</td>
                  <td className="p-4 align-middle text-sm">{comp.metadata?.dist ?? "-"}</td>
                  <td className="p-4 align-middle text-sm">{comp.metadata?.clk_pos ?? "-"}</td>
                  <td className="p-4 align-middle text-sm">{comp.created_at ? new Date(comp.created_at).toLocaleDateString() : "-"}</td>
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
        mode={dialogMode}
        defaultCode={selectedCode}
      />
    </div>
  );
}
