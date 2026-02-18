"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronRight, ChevronDown, CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

interface ComponentTreeProps {
    structureId: string | null;
    onComponentSelect: (component: any) => void;
    selectedComponent: any;
}

interface Component {
    id: number;
    component_name: string;
    component_type: string;
    parent_id: number | null;
    has_children: boolean;
    inspected?: boolean;
}

export default function ComponentTree({
    structureId,
    onComponentSelect,
    selectedComponent,
}: ComponentTreeProps) {
    const supabase = createClient();

    const [components, setComponents] = useState<Component[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (structureId) {
            loadComponents();
        }
    }, [structureId]);

    async function loadComponents() {
        if (!structureId) return;

        try {
            const { data, error } = await supabase
                .from("structure_components")
                .select("id, component_name, component_type, parent_id")
                .eq("structure_id", structureId)
                .order("component_type")
                .order("component_name");

            if (error) throw error;

            // Check which components have been inspected
            const { data: inspectedData } = await supabase
                .from("insp_records")
                .select("component_id")
                .eq("structure_id", structureId);

            const inspectedIds = new Set(
                inspectedData?.map((r: any) => r.component_id) || []
            );

            const componentsWithChildren = data?.map((comp: any) => ({
                ...comp,
                has_children: data.some((c: any) => c.parent_id === comp.id),
                inspected: inspectedIds.has(comp.id),
            })) || [];

            setComponents(componentsWithChildren);

            // Auto-expand root level
            const rootComponents = componentsWithChildren.filter(
                (c: any) => !c.parent_id
            );
            setExpandedNodes(new Set(rootComponents.map((c: any) => c.id)));
        } catch (error) {
            console.error("Error loading components:", error);
        } finally {
            setLoading(false);
        }
    }

    function toggleNode(nodeId: number) {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
        } else {
            newExpanded.add(nodeId);
        }
        setExpandedNodes(newExpanded);
    }

    function handleComponentClick(component: Component) {
        onComponentSelect(component);
    }

    function filterComponents(components: Component[]): Component[] {
        if (!searchTerm) return components;

        return components.filter((comp) =>
            comp.component_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            comp.component_type.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    function renderComponent(component: Component, level: number = 0) {
        const isExpanded = expandedNodes.has(component.id);
        const isSelected = selectedComponent?.id === component.id;
        const children = components.filter((c) => c.parent_id === component.id);

        return (
            <div key={component.id}>
                <div
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all group",
                        "hover:bg-slate-100 dark:hover:bg-slate-800",
                        isSelected && "bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800"
                    )}
                    style={{ paddingLeft: `${level * 20 + 12}px` }}
                    onClick={() => handleComponentClick(component)}
                >
                    {/* Expand/Collapse Icon */}
                    {component.has_children ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleNode(component.id);
                            }}
                            className="flex-shrink-0"
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                    ) : (
                        <div className="w-4" />
                    )}

                    {/* Inspected Status */}
                    {component.inspected ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                        <Circle className="h-4 w-4 text-slate-300 dark:text-slate-700 flex-shrink-0" />
                    )}

                    {/* Component Info */}
                    <div className="flex-1 min-w-0">
                        <p className={cn(
                            "text-sm font-medium truncate",
                            isSelected ? "text-cyan-900 dark:text-cyan-100" : "text-slate-900 dark:text-white"
                        )}>
                            {component.component_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                            {component.component_type}
                        </p>
                    </div>
                </div>

                {/* Children */}
                {isExpanded && children.length > 0 && (
                    <div>
                        {children.map((child) => renderComponent(child, level + 1))}
                    </div>
                )}
            </div>
        );
    }

    const filteredComponents = filterComponents(components);
    const rootComponents = filteredComponents.filter((c) => !c.parent_id);

    return (
        <Card className="p-4 shadow-lg border-slate-200 dark:border-slate-800">
            <div className="space-y-4">
                {/* Header */}
                <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">
                        Component Selection
                    </h3>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search components..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9text-sm"
                        />
                    </div>
                </div>

                {/* Component Tree */}
                <ScrollArea className="h-[400px] pr-4">
                    {loading ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">Loading components...</p>
                        </div>
                    ) : rootComponents.length > 0 ? (
                        <div className="space-y-1">
                            {rootComponents.map((component) => renderComponent(component))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Circle className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                            <p className="text-sm text-muted-foreground">
                                {searchTerm ? "No components found" : "No components available"}
                            </p>
                        </div>
                    )}
                </ScrollArea>

                {/* Stats */}
                {!loading && components.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs">
                        <span className="text-muted-foreground">
                            Total: {components.length}
                        </span>
                        <span className="text-green-600 font-medium">
                            Inspected: {components.filter((c) => c.inspected).length}
                        </span>
                    </div>
                )}
            </div>
        </Card>
    );
}
