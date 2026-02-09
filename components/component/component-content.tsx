"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronRight, ChevronDown, MoreVertical, Plus, Search, Filter, Archive, Hash, Calendar, Box, Activity, Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "../dialogs/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import { ComponentSpecDialog } from "@/components/dialogs/component-spec-dialog";
import { ComponentEditDialog, EditableComponent } from "@/components/dialogs/component-edit-dialog";
import { useAtom } from "jotai";
import { urlId } from "@/utils/client-state";
import useSWR, { mutate } from "swr";
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
  is_deleted?: boolean | null;
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
  const [viewArchived, setViewArchived] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'create'>('view');
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<EditableComponent | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
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
    ? (() => {
      const params = new URLSearchParams();
      if (selectedCode) params.set("code", selectedCode);
      if (viewArchived) params.set("archived", "true");
      const query = params.toString();
      return `/api/structure-components/${structureId}${query ? `?${query}` : ""}`;
    })()
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
    setSelectedComponent(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleEditComponent = (component: Component) => {
    setEditingComponent(component as EditableComponent);
    setEditDialogOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!deleteId) return;
    try {
      setDeleteLoading(true);
      await fetcher(`/api/structure-components/item/${deleteId}`, {
        method: "DELETE",
      });
      if (apiUrl) mutate(apiUrl);
      setDeleteId(null);
    } catch (error) {
      console.error("Delete failed", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    setDialogOpen(isOpen);
    if (!isOpen) {
      setDialogMode('view');
      setSelectedComponent(null);
    }
  };

  const handleTypeClick = (typeName: string | null, typeCode: string | null) => {
    setViewArchived(false);
    setSelectedType(typeName || "ALL COMPONENTS");
    setSelectedCode(typeCode);
  };

  return (
    <div className="flex w-full gap-8 min-h-[70vh]">
      {/* Left Sidebar - Component Types List */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-6 sticky top-0 self-start">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-6 h-full shadow-sm">
          <div className="space-y-4">
            <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Library Sections</h3>
            <div className="flex flex-col gap-1">
              <FilterButton
                active={!viewArchived && selectedType === "ALL COMPONENTS"}
                onClick={() => handleTypeClick("ALL COMPONENTS", null)}
                icon={<Box className="h-4 w-4" />}
                label="All Components"
              />
              <FilterButton
                active={viewArchived}
                onClick={() => {
                  setViewArchived(true);
                  setSelectedType("ARCHIVED");
                  setSelectedCode(null);
                }}
                icon={<Archive className="h-4 w-4" />}
                label="Archived Items"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Component Categories</h3>
            <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {isLoadingTypes ? (
                <div className="px-2 py-4 space-y-3">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-full" />)}
                </div>
              ) : (
                componentTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleTypeClick(type.name, type.code)}
                    className={cn(
                      "flex items-center gap-3 w-full text-left text-xs font-bold py-2.5 px-3 rounded-xl transition-all",
                      selectedType === type.name && !viewArchived
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      selectedType === type.name && !viewArchived ? "bg-white" : "bg-slate-300 dark:bg-slate-700"
                    )} />
                    <span className="truncate">{type.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <Input
                placeholder="Search by Q ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
              />
            </div>
            <Button
              onClick={handleAddNewComponent}
              className="h-11 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-lg hover:opacity-90 transition-all gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Component</span>
            </Button>
          </div>
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Listing {filteredComponents.length} Data Points
            </span>
          </div>
        </div>

        {/* Data Table Container */}
        <div className="bg-white dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden relative">
          <div className="overflow-auto h-[60vh] custom-scrollbar relative">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm">
                  <TableTh className="w-[200px]">System ID No</TableTh>
                  <TableTh className="w-[140px]">Q ID</TableTh>
                  <TableTh className="w-[100px]">Type</TableTh>
                  <TableTh className="w-[180px]">Node Path (S/E)</TableTh>
                  <TableTh className="w-[160px]">Platform Leg (S/E)</TableTh>
                  <TableTh className="w-[160px]">Elevation (1/2)</TableTh>
                  <TableTh className="w-[120px]">Timestamp</TableTh>
                  <TableTh className="w-[80px] text-center">Actions</TableTh>
                </tr>
              </thead>
              <tbody>
                {isLoadingComponents ? (
                  <tr className="animate-pulse">
                    <td colSpan={8} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Initialising Database...</td>
                  </tr>
                ) : filteredComponents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Activity className="h-8 w-8 text-slate-200 mb-2" />
                        <p className="font-black text-slate-400 uppercase tracking-widest text-xs">No Records Found</p>
                        <p className="text-slate-400 text-sm">Try adjusting your filters or search query.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredComponents.map((comp: Component) => (
                    <tr
                      key={comp.id}
                      className={cn(
                        "group border-b border-slate-50 dark:border-slate-800 transition-all cursor-pointer",
                        comp.is_deleted
                          ? "bg-red-50/60 hover:bg-red-100/60 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      )}
                      onClick={() => handleRowClick(comp)}
                    >
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-500 transition-colors">
                            <Hash className="h-4 w-4" />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-slate-500 leading-tight">{comp.id_no}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="font-black text-slate-900 dark:text-white tracking-tight">{comp.q_id}</span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                          {comp.code || "---"}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-500 font-medium">
                        <div className="flex items-center gap-2">
                          <span>{comp.metadata?.s_node || "-"}</span>
                          <ChevronRight className="h-3 w-3 text-slate-300" />
                          <span>{comp.metadata?.f_node || "-"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-500 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">{comp.metadata?.s_leg || "-"}</span>
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">{comp.metadata?.f_leg || "-"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-500 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Base</span>
                            <span className="text-slate-900 dark:text-white font-black">{comp.metadata?.elv_1 || "0"}</span>
                          </div>
                          <div className="h-6 w-px bg-slate-100 dark:bg-slate-800" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Top</span>
                            <span className="text-slate-900 dark:text-white font-black">{comp.metadata?.elv_2 || "0"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">{comp.created_at ? new Date(comp.created_at).toLocaleDateString() : "-"}</span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase">{comp.created_at ? new Date(comp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[180px] rounded-[1.2rem] p-2 shadow-2xl">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Management</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="rounded-lg py-2.5 font-bold cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditComponent(comp);
                              }}
                            >
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={cn(
                                "rounded-lg py-2.5 font-bold cursor-pointer transition-colors",
                                comp.is_deleted ? "text-blue-600 focus:text-blue-600" : "text-red-500 focus:text-red-500"
                              )}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await fetcher(`/api/structure-components/item/${comp.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({ is_deleted: !comp.is_deleted }),
                                  });
                                  if (apiUrl) mutate(apiUrl);
                                } catch (error) {
                                  console.error("Action failed", error);
                                }
                              }}
                            >
                              {comp.is_deleted ? "Unarchive Record" : "Archive Record"}
                            </DropdownMenuItem>
                            {comp.is_deleted && (
                              <DropdownMenuItem
                                className="rounded-lg py-2.5 font-bold cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteId(comp.id);
                                }}
                              >
                                Permanent Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {dialogOpen && (
        <ComponentSpecDialog
          component={selectedComponent}
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          mode={dialogMode}
          defaultCode={selectedCode}
        />
      )}
      {editDialogOpen && (
        <ComponentEditDialog
          component={editingComponent}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          listKey={apiUrl}
        />
      )}
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDeleteItem}
        loading={deleteLoading}
        title="Delete Component"
        description="Are you sure you want to permanently delete this record? This action cannot be undone and will remove the component from the system."
      />
    </div>
  );
}

function FilterButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full text-left text-xs font-bold py-3 px-4 rounded-2xl transition-all",
        active
          ? "bg-slate-900 text-white shadow-xl dark:bg-white dark:text-slate-900 shadow-slate-200 dark:shadow-black/40"
          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
      )}
    >
      <span className={cn("shrink-0", active ? "text-blue-500" : "text-slate-400")}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TableTh({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <th className={cn(
      "h-14 px-4 text-left align-middle font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500",
      className
    )}>
      {children}
    </th>
  );
}
