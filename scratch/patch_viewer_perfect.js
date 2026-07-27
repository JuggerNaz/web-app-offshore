const fs = require('fs');

let content = fs.readFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', 'utf8');

// 1. Imports
content = content.replace(
    /import \{([\s\S]*?Maximize2)\s*\} from "lucide-react";/,
    'import {$1, Search, ChevronRight} from "lucide-react";'
);

// 2. Props Interface
if (!content.includes('webapp3dData?: any;')) {
    content = content.replace(
        'interface Structural3DViewerProps {',
        'interface Structural3DViewerProps {\n    webapp3dData?: any;'
    );
}

// 3. Component Props
if (!content.includes('webapp3dData,')) {
    content = content.replace(
        /wincairsParams = \[\],\s*onFallbackComponentsChange\s*,/,
        'wincairsParams = [],\n    onFallbackComponentsChange,\n    webapp3dData,'
    );
}

// 4. State hooks inside Structural3DViewer
if (!content.includes('isInspectionMode')) {
    content = content.replace(
        /const \[showGrid, setShowGrid\] = useState\(true\);/,
        'const [showGrid, setShowGrid] = useState(true);\n    const [isInspectionMode, setIsInspectionMode] = useState(false);'
    );
}
content = content.replace(
    /const \[openDropdown, setOpenDropdown\] = useState<"elevation" \| "face" \| "display" \| null>\(null\);/,
    'const [openDropdown, setOpenDropdown] = useState<"elevation" | "face" | "display" | "inspection" | null>(null);'
);
content = content.replace(
    /const \[openDropdown, setOpenDropdown\] = useState/,
    'const [searchQuery, setSearchQuery] = useState("");\n    const [showSearchDropdown, setShowSearchDropdown] = useState(false);\n    const [openDropdown, setOpenDropdown] = useState'
);

// 5. Replace Math
const startIdx = content.indexOf('const { componentLayouts, foundationMembers, elvMarkers } = useMemo(() => {');
const endIdxStr = 'const fallbackComponents = useMemo(() => {';
const endIdx = content.indexOf(endIdxStr);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `
    // USE WEBAPP_3D DATABASE INSTEAD OF FRONTEND PROCEDURAL MATH
    const { componentLayouts, foundationMembers, elvMarkers } = useMemo(() => {
        if (!webapp3dData) return { componentLayouts: [], foundationMembers: [], elvMarkers: [] };

        const layouts = (webapp3dData.components || []).map((dbItem: any) => {
            const comp = rawComponents.find((c: any) => c.id === dbItem.component_id) || {};
            
            // Apply inspection color if mode is active
            const finalColor = isInspectionMode ? dbItem.inspection_color : (dbItem.color_hex || "#64748b");
            
            return {
                id: dbItem.component_id,
                q_id: comp.q_id || \`COMP-\${dbItem.component_id}\`,
                type: dbItem.shape_type,
                code: comp.code || "UNKNOWN",
                position: [dbItem.pos_x, dbItem.pos_y, dbItem.pos_z],
                rotation: [dbItem.rot_x, dbItem.rot_y, dbItem.rot_z],
                scale: [dbItem.scale_x, dbItem.scale_y, dbItem.scale_z],
                color: finalColor,
                thickness: dbItem.dimensions?.radius || 0.5,
                length: dbItem.dimensions?.length || 1,
                offsetDistance: dbItem.dimensions?.offset || 0,
                shape: dbItem.shape_type,
                renderMesh: dbItem.visibility_flag,
                hasGeometryIssue: dbItem.has_geometry_issue,
                is_inspected: dbItem.is_inspected,
                has_anomaly: dbItem.has_anomaly,
                originalComp: comp
            };
        });

        return {
            componentLayouts: layouts,
            foundationMembers: webapp3dData.foundationMembers || [],
            elvMarkers: webapp3dData.elvMarkers || []
        };
    }, [webapp3dData, rawComponents, isInspectionMode]);

    `;
    content = content.slice(0, startIdx) + replacement + content.slice(endIdx);
}

// 6. CameraRig setup
if (!content.includes('const selectedLayout = componentLayouts.find')) {
    content = content.replace(
        'return (\n        <div className="relative w-full h-full bg-slate-50 overflow-hidden font-sans">',
        `
    const selectedLayout = componentLayouts.find((l: any) => l.id === selectedCompId);
    const selectedPos = selectedLayout ? new THREE.Vector3(selectedLayout.position[0], selectedLayout.position[1], selectedLayout.position[2]) : null;
    
    return (\n        <div className="relative w-full h-full bg-slate-50 overflow-hidden font-sans">`
    );
}
if (!content.includes('<CameraRig')) {
    content = content.replace(
        '<OrbitControls',
        '<CameraRig selectedPos={selectedPos} isActivated={isActivated} />\n                <OrbitControls'
    );
}

// 7. Search UI
const searchUI = `
            {/* Search Bar UI */}
            <div className="absolute top-6 left-6 z-50 w-72">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search Component (e.g. A1, N3)..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowSearchDropdown(true);
                        }}
                        onFocus={() => setShowSearchDropdown(true)}
                        className="w-full bg-white/90 backdrop-blur-md h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 uppercase focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                    />
                </div>
                
                {showSearchDropdown && searchQuery.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        {componentLayouts
                            .filter((c: any) => c.q_id.toLowerCase().includes(searchQuery.toLowerCase()))
                            .slice(0, 15)
                            .map((comp: any) => (
                                <button
                                    key={comp.id}
                                    onClick={() => {
                                        if (onSelectComponent) onSelectComponent(comp.originalComp);
                                        setSearchQuery("");
                                        setShowSearchDropdown(false);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between group transition-colors"
                                >
                                    <div>
                                        <div className="text-xs font-black text-slate-800">{comp.q_id}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{comp.type}</div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                </button>
                            ))}
                    </div>
                )}
            </div>
`;
if (!content.includes('placeholder="Search Component')) {
    content = content.replace(
        '{/* Click-outside backdrop */}',
        searchUI + '\n            {/* Click-outside backdrop */}'
    );
}

// 8. Inspection UI
const inspectionUI = `
                {/* Inspection Filter */}
                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDropdown(openDropdown === "inspection" ? null : "inspection")}
                        className={cn(
                            "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                            isInspectionMode
                                ? "border-purple-400 text-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                                : "border-slate-200 text-slate-500"
                        )}
                    >
                        Inspection {isInspectionMode ? "ON" : "OFF"} ▼
                    </Button>

                    {openDropdown === "inspection" && (
                        <div className="absolute right-0 mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-4 w-64 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Inspection Mode
                                </span>
                                <label className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only" checked={isInspectionMode} onChange={(e) => setIsInspectionMode(e.target.checked)} />
                                        <div className={\`block w-8 h-5 rounded-full \${isInspectionMode ? 'bg-purple-500' : 'bg-slate-200'}\`}></div>
                                        <div className={\`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition \${isInspectionMode ? 'transform translate-x-3' : ''}\`}></div>
                                    </div>
                                </label>
                            </div>
                            
                            <div className="flex flex-col gap-2 py-2">
                                <div className="flex items-center gap-3 p-1">
                                    <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-500" />
                                    <span className="text-xs font-bold text-slate-600">Not Inspected</span>
                                </div>
                                <div className="flex items-center gap-3 p-1">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] border border-emerald-600" />
                                    <span className="text-xs font-bold text-emerald-700">Inspected (No Anomaly)</span>
                                </div>
                                <div className="flex items-center gap-3 p-1 bg-red-50/50 rounded-lg">
                                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse border border-red-600" />
                                    <span className="text-xs font-bold text-red-700">Inspected (Has Anomaly)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
`;
if (!content.includes('Inspection {isInspectionMode')) {
    content = content.replace(
        '{/* Elevation Filter */}',
        inspectionUI + '\n                {/* Elevation Filter */}'
    );
}

fs.writeFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', content);
console.log('Successfully applied all patches!');
