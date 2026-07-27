const fs = require('fs');

let content = fs.readFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', 'utf8');

// 1. Add Search Input and Icon Imports
if (!content.includes('Search')) {
    content = content.replace('Maximize2,', 'Maximize2, Search, Check,');
}

// 2. Add CameraFlyTo Component inside Canvas
const cameraRigStr = `
function CameraRig({ selectedPos, isActivated }: { selectedPos: THREE.Vector3 | null; isActivated: boolean }) {
    const { camera, controls } = useThree();
    
    useEffect(() => {
        if (!isActivated) return;
        if (selectedPos && controls) {
            // Target is the component position
            const target = new THREE.Vector3(selectedPos.x, selectedPos.y, selectedPos.z);
            
            // Camera moves to slightly offset position to view the component
            const offset = new THREE.Vector3(15, 10, 15);
            const cameraPos = target.clone().add(offset);
            
            // GSAP or basic lerp can be used, but since we don't have GSAP installed by default, 
            // we will just set it instantly or use a simple animation frame
            
            // Using OrbitControls target
            (controls as any).target.copy(target);
            camera.position.copy(cameraPos);
            controls.update();
        }
    }, [selectedPos, isActivated, camera, controls]);

    return null;
}
`;

if (!content.includes('function CameraRig')) {
    // Insert before Structural3DViewer function
    content = content.replace('export function Structural3DViewer', cameraRigStr + '\nexport function Structural3DViewer');
}

// 3. Add search state to Structural3DViewer
if (!content.includes('const [searchQuery, setSearchQuery] = useState')) {
    content = content.replace(
        'const [openDropdown, setOpenDropdown]',
        'const [searchQuery, setSearchQuery] = useState("");\n    const [showSearchDropdown, setShowSearchDropdown] = useState(false);\n    const [openDropdown, setOpenDropdown]'
    );
}

// 4. Compute selected layout for CameraRig
if (!content.includes('const selectedLayout = componentLayouts.find')) {
    content = content.replace(
        'return (\n        <div className="relative w-full h-full bg-slate-50 overflow-hidden font-sans">',
        `
    const selectedLayout = componentLayouts.find((l: any) => l.id === selectedCompId);
    const selectedPos = selectedLayout ? new THREE.Vector3(selectedLayout.position[0], selectedLayout.position[1], selectedLayout.position[2]) : null;
    
    return (\n        <div className="relative w-full h-full bg-slate-50 overflow-hidden font-sans">`
    );
}

// 5. Add CameraRig inside Canvas
if (!content.includes('<CameraRig')) {
    content = content.replace(
        '<OrbitControls',
        '<CameraRig selectedPos={selectedPos} isActivated={isActivated} />\\n                <OrbitControls'
    );
}

// 6. Add Search UI
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

// 7. Add Inspection Dropdown UI
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
console.log('UI injected into Structural3DViewer.tsx');
