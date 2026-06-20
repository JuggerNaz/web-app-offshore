"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { Box, Layers, Plus, Loader2, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useEditorStore } from "../../store/useEditorStore";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LeftSidebar() {
  const { setActiveTool, selectedPlatformId, setSelectedPlatformId } = useEditorStore();
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all platforms
  const { data: platformsData, isLoading: isLoadingPlatforms } = useSWR(
    "/api/structures?type=PLATFORM",
    fetcher
  );
  
  // Fetch components for selected platform
  const { data: componentsData, isLoading: isLoadingComponents } = useSWR(
    selectedPlatformId ? `/api/structure-components/${selectedPlatformId}` : null,
    fetcher
  );

  // Fetch all component categories/types
  const { data: categoriesData } = useSWR(
    "/api/components",
    fetcher
  );

  const platforms = platformsData?.data || [];
  const components = componentsData?.data || [];
  const categories = categoriesData?.data || [];

  // Create a map from component type code to category name
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat: any) => {
      if (cat.code && cat.name) {
        map.set(cat.code.toUpperCase().trim(), cat.name.toUpperCase().trim());
      }
    });
    return map;
  }, [categories]);

  // Keep categories collapsed by default when components load or platform changes
  useEffect(() => {
    setExpandedTypes({});
  }, [selectedPlatformId, components.length]);

  const toggleType = (typeName: string) => {
    setExpandedTypes((prev) => ({
      ...prev,
      [typeName]: !prev[typeName],
    }));
  };

  // Filter components based on search query
  const filteredComponents = components.filter((comp: any) => {
    const qidStr = comp.q_id || comp.qid || "";
    if (!searchTerm) return true;
    const nameMatch = (comp.component_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const codeMatch = (comp.code || "").toLowerCase().includes(searchTerm.toLowerCase());
    const qidMatch = qidStr.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Check if the resolved type matches search term
    const compCode = (comp.code || "").toUpperCase().trim();
    const resolvedType = categoryMap.get(compCode) || "GENERIC";
    const typeMatch = resolvedType.toLowerCase().includes(searchTerm.toLowerCase());

    return nameMatch || codeMatch || qidMatch || typeMatch;
  });

  // Group components by resolved type name
  const groupedComponents = filteredComponents.reduce((acc: Record<string, any[]>, comp: any) => {
    const compCode = (comp.code || "").toUpperCase().trim();
    const typeName = categoryMap.get(compCode) || "GENERIC";
    if (!acc[typeName]) {
      acc[typeName] = [];
    }
    acc[typeName].push(comp);
    return acc;
  }, {});

  const componentTypes = Object.keys(groupedComponents).sort();

  return (
    <div className="w-72 border-r bg-card flex flex-col h-full">
      <div className="p-4 border-b space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Component Library
        </h2>
        
        {isLoadingPlatforms ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading platforms...
          </div>
        ) : (
          <Select 
            value={selectedPlatformId || undefined} 
            onValueChange={setSelectedPlatformId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Platform" />
            </SelectTrigger>
            <SelectContent>
              {platforms.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.str_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedPlatformId && !isLoadingComponents && components.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search components..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </div>
      )}
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {!selectedPlatformId && (
            <div className="text-sm text-muted-foreground text-center mt-4">
              Please select a platform above to view components.
            </div>
          )}

          {selectedPlatformId && isLoadingComponents && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading components...
            </div>
          )}

          {selectedPlatformId && !isLoadingComponents && components.length === 0 && (
            <div className="text-sm text-muted-foreground text-center mt-4">
              No components found for this platform.
            </div>
          )}

          {selectedPlatformId && !isLoadingComponents && filteredComponents.length === 0 && components.length > 0 && (
            <div className="text-sm text-muted-foreground text-center mt-4">
              No matching components found.
            </div>
          )}

          {selectedPlatformId && !isLoadingComponents && componentTypes.map((type) => {
            const typeComps = groupedComponents[type];
            const isExpanded = !!expandedTypes[type];

            return (
              <div key={type} className="space-y-1">
                <button
                  onClick={() => toggleType(type)}
                  className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-muted/80 rounded-md text-sm font-medium transition-colors group/header"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase truncate group-hover/header:text-foreground">
                      {type}
                    </span>
                    <span className="text-[10px] bg-muted/85 text-muted-foreground px-1.5 py-0.5 rounded-full font-mono font-medium scale-90">
                      {typeComps.length}
                    </span>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden pl-3 ml-2 border-l border-muted/80 space-y-1.5"
                    >
                      {typeComps.map((comp: any) => (
                        <div 
                          key={comp.id}
                          className="hover:bg-accent/50 rounded px-2.5 py-1.5 cursor-pointer transition-all flex items-center justify-between group/item"
                          onClick={() => {
                            setActiveTool('PLACE');
                            
                            const compCode = (comp.code || "").toUpperCase().trim();
                            const resolvedType = categoryMap.get(compCode) || "GENERIC";
                            const shape = resolvedType === 'ANODE' ? 'BOX' : 'CYLINDER';
                            const length = 10;
                            // Generate nodes for snapping. For a cylinder along Y-axis:
                            const nodes = shape === 'CYLINDER' ? [
                              { id: 'top', localPos: [0, length / 2, 0] as [number, number, number] },
                              { id: 'bottom', localPos: [0, -length / 2, 0] as [number, number, number] }
                            ] : [];

                            useEditorStore.getState().setPlacementGhost({
                              type: resolvedType,
                              shape: shape,
                              properties: { radius: 0.5, length: length, width: 1, height: 1, depth: 2 },
                              sourceData: comp,
                              nodes: nodes
                            });
                          }}
                        >
                          <span className="text-xs font-mono font-medium text-muted-foreground group-hover/item:text-primary transition-colors">
                            {comp.q_id || comp.qid || comp.code || comp.component_name || "Unknown"}
                          </span>
                          <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
