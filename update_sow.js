const fs = require('fs');
const filePath = 'c:/Users/nq352/Documents/GitHub/web-app-offshore/components/jobpack/sow-dialog.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The replacement starts at: <div className="flex-1 flex gap-6 min-h-0">
const splitToken = '<div className="flex-1 flex gap-6 min-h-0">';
const parts = content.split(splitToken);

if (parts.length < 2) {
    console.error("Could not find the split token in the file.");
    process.exit(1);
}

// Ensure we don't accidentally split multiple times, just take the first part
const topContent = parts[0];

const newBottomContent = `
                            {/* Summary Dashboard (Collapsible) */}
                            {showSummary && filteredSelectedComponents.length > 0 && (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 shrink-0 transition-all duration-300">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded flex items-center justify-center bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                                                <Layers className="h-3.5 w-3.5" />
                                            </div>
                                            <h4 className="text-[10px] font-black tracking-widest uppercase text-slate-500">Scope Overview</h4>
                                        </div>
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-6">
                                        {/* Task Totals Donut (CSS) */}
                                        <div className="w-48 shrink-0 flex flex-col items-center">
                                            <div className="relative w-24 h-24 mb-2">
                                                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                                    <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#f1f5f9" strokeWidth="3"></circle>
                                                    {(() => {
                                                        const total = totalAssignedTasks || 1; // Prevent divide by 0
                                                        let currentOffset = 0;
                                                        const colors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981']; // blue, amber, purple, emerald
                                                        return Object.entries(summaryTasksByInspection).map(([code, count], idx) => {
                                                            const strokeDasharray = \`\${(count / total) * 100} \${100 - (count / total) * 100}\`;
                                                            const strokeDashoffset = -currentOffset;
                                                            currentOffset += (count / total) * 100;
                                                            return (
                                                                <circle key={code} cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke={colors[idx % colors.length]} strokeWidth="4" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset}></circle>
                                                            );
                                                        });
                                                    })()}
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                                    <span className="text-xl font-black text-slate-800 dark:text-slate-100">{totalAssignedTasks}</span>
                                                    <span className="text-[8px] font-bold uppercase text-slate-400">Tasks</span>
                                                </div>
                                            </div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase">Task Distribution</div>
                                        </div>

                                        {/* Horizontal Bar Chart (CSS) */}
                                        <div className="flex-1 border-l border-slate-100 dark:border-slate-800 pl-6 flex flex-col justify-center">
                                            <div className="space-y-3">
                                                {Object.entries(summaryTasksByType).slice(0, 4).map(([type, taskCounts]) => {
                                                    const totalForType = Object.values(taskCounts).reduce((a, b) => a + b, 0);
                                                    const maxPossible = Math.max(...Object.values(summaryTasksByType).map(c => Object.values(c).reduce((a, b) => a + b, 0)), 1);
                                                    const widthPercent = (totalForType / maxPossible) * 100;
                                                    return (
                                                        <div key={type} className="flex items-center gap-3">
                                                            <div className="w-12 text-right">
                                                                <Badge variant="secondary" className="px-1.5 py-0 text-[9px] min-w-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none">{type}</Badge>
                                                            </div>
                                                            <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                                                {Object.entries(taskCounts).map(([code, count], idx) => {
                                                                    const colors = ['bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-emerald-500'];
                                                                    return <div key={code} className={\`h-full \${colors[idx % colors.length]}\`} style={{ width: \`\${(count / totalForType) * widthPercent}%\` }} title={\`\${code}: \${count}\`} />;
                                                                })}
                                                            </div>
                                                            <div className="w-8 text-[10px] font-bold text-slate-600 dark:text-slate-400 text-left">
                                                                {totalForType}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {Object.keys(summaryTasksByType).length > 4 && (
                                                    <div className="text-[10px] text-slate-400 font-medium italic pt-1 pl-16">
                                                        ...and {Object.keys(summaryTasksByType).length - 4} more component types
                                                    </div>
                                                )}
                                                {Object.keys(summaryTasksByType).length === 0 && (
                                                    <div className="text-xs text-slate-400 italic">No tasks assigned yet. Tick checkboxes below.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 flex gap-6 min-h-0">
                                {/* Left Panel: Filter System */}
                                <div className="w-[340px] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden shrink-0">
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4 text-blue-500" />
                                            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Matrix Filters</h3>
                                        </div>
                                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 border-none font-bold text-[10px]">
                                            {filteredComponents.length} Visibile
                                        </Badge>
                                    </div>
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                            <Input
                                                placeholder="Search QID or Type..."
                                                value={componentSearch}
                                                onChange={e => setComponentSearch(e.target.value)}
                                                className="h-8 pl-9 text-xs rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                                        {/* Component Types */}
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Component Type</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {uniqueTypes.map(type => {
                                                    const count = components.filter(c => c.type === type).length;
                                                    const isSel = compTypeFilter.has(type);
                                                    return (
                                                        <button
                                                            key={type}
                                                            onClick={() => {
                                                                const next = new Set(compTypeFilter);
                                                                if (next.has(type)) next.delete(type);
                                                                else next.add(type);
                                                                setCompTypeFilter(next);
                                                            }}
                                                            className={\`px-2 py-1 rounded text-[10px] font-bold border transition-colors \${isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}\`}
                                                        >
                                                            {type} <span className={\`font-mono font-normal ml-1 \${isSel ? 'text-blue-200' : 'text-slate-400'}\`}>({count})</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Structural Part */}
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Part</label>
                                            <div className="flex gap-2">
                                                {['ALL', 'TOPSIDE', 'SUBSEA'].map(part => (
                                                    <button
                                                        key={part}
                                                        onClick={() => setPartFilter(part as any)}
                                                        className={\`flex-1 py-1.5 rounded text-[10px] font-bold border transition-colors \${partFilter === part ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'}\`}
                                                    >
                                                        {part}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Dropdowns */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Group</label>
                                                <Select value={Array.from(compGroupFilter)[0] || 'ALL'} onValueChange={v => setCompGroupFilter(v === 'ALL' ? new Set() : new Set([v]))}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="All" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ALL">All Groups</SelectItem>
                                                        {uniqueGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Level</label>
                                                <Select value={Array.from(levelFilter)[0] || 'ALL'} onValueChange={v => setLevelFilter(v === 'ALL' ? new Set() : new Set([v]))}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="All" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ALL">All Levels</SelectItem>
                                                        {uniqueLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Face</label>
                                                <Select value={Array.from(faceFilter)[0] || 'ALL'} onValueChange={v => setFaceFilter(v === 'ALL' ? new Set() : new Set([v]))}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="All" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ALL">All Faces</SelectItem>
                                                        {uniqueFaces.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Leg</label>
                                                <Select value={Array.from(legFilter)[0] || 'ALL'} onValueChange={v => setLegFilter(v === 'ALL' ? new Set() : new Set([v]))}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="All" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ALL">All Legs</SelectItem>
                                                        {uniqueLegs.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Elevation */}
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Elevation Range (m)</label>
                                            <div className="flex gap-2 items-center">
                                                <Input type="number" placeholder="Min" value={elvMinFilter} onChange={e => setElvMinFilter(e.target.value)} className="h-8 text-xs" />
                                                <span className="text-slate-400">-</span>
                                                <Input type="number" placeholder="Max" value={elvMaxFilter} onChange={e => setElvMaxFilter(e.target.value)} className="h-8 text-xs" />
                                            </div>
                                        </div>

                                    </div>
                                    <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 mt-auto">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setCompTypeFilter(new Set());
                                                setPartFilter('ALL');
                                                setCompGroupFilter(new Set());
                                                setLevelFilter(new Set());
                                                setFaceFilter(new Set());
                                                setLegFilter(new Set());
                                                setElvMinFilter('');
                                                setElvMaxFilter('');
                                                setComponentSearch('');
                                            }}
                                            className="w-full h-8 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 uppercase tracking-wider"
                                        >
                                            Clear All Filters
                                        </Button>
                                    </div>
                                </div>

                                {/* Right Panel: Matrix with Vertical Headers */}
                                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                                    {/* Toolbar */}
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide uppercase flex items-center gap-2">
                                                <Settings2 className="h-4 w-4 text-blue-500" />
                                                Scope Matrix
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[10px] font-bold uppercase tracking-wider gap-1"
                                                onClick={() => setShowSummary(!showSummary)}
                                            >
                                                {showSummary ? 'Hide Summary' : 'Show Summary'}
                                            </Button>
                                        </div>
                                    </div>

                                    {filteredSelectedComponents.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50/20 dark:bg-slate-900/20">
                                            <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                                <Search className="h-16 w-16 mx-auto mb-4 opacity-50 text-slate-400" />
                                                <p className="text-lg font-bold text-slate-600 dark:text-slate-400">No components match filters</p>
                                                <p className="text-sm mt-2 text-slate-400">Adjust the left panel filters to see components</p>
                                            </div>
                                        </div>
                                    ) : filteredInspectionTypes.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50/20 dark:bg-slate-900/20">
                                            <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                                <Filter className="h-16 w-16 mx-auto mb-4 opacity-50 text-rose-300" />
                                                <p className="text-lg font-bold text-slate-600 dark:text-slate-400">No applicable SOW types</p>
                                                <p className="text-sm mt-2 text-slate-400">There are no valid inspection types available for this structure.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-auto custom-scrollbar">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-20 shadow-sm">
                                                    <tr>
                                                        <th className="p-2 text-left font-bold text-slate-600 dark:text-slate-400 border-r border-b border-slate-200 dark:border-slate-700 w-[240px] sticky left-0 bg-slate-50 dark:bg-slate-800 z-30 shadow-[4px_0_16px_-4px_rgba(0,0,0,0.05)] align-bottom">
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Component Details</div>
                                                        </th>
                                                        {filteredInspectionTypes.map((inspection) => {
                                                            const isRov = inspection.metadata?.rov === 1 || inspection.metadata?.rov === "1" || inspection.metadata?.rov === true || inspection.metadata?.job_type?.includes('ROV');
                                                            const isDiving = inspection.metadata?.diving === 1 || inspection.metadata?.diving === "1" || inspection.metadata?.diving === true || inspection.metadata?.job_type?.includes('DIVING');

                                                            let barColor = "bg-blue-500";
                                                            let textColor = "text-slate-500 dark:text-slate-400";
                                                            let hoverBg = "hover:bg-blue-50/50 dark:hover:bg-blue-900/20";

                                                            if (isRov && !isDiving) {
                                                                barColor = "bg-blue-500";
                                                                textColor = "text-blue-600 dark:text-blue-400 font-bold";
                                                                hoverBg = "hover:bg-blue-50/50 dark:hover:bg-blue-900/20";
                                                            } else if (isDiving && !isRov) {
                                                                barColor = "bg-amber-500";
                                                                textColor = "text-amber-600 dark:text-amber-400 font-bold";
                                                                hoverBg = "hover:bg-amber-50/50 dark:hover:bg-amber-900/20";
                                                            } else if (isRov && isDiving) {
                                                                barColor = "bg-purple-500";
                                                                textColor = "text-purple-600 dark:text-purple-400 font-bold";
                                                                hoverBg = "hover:bg-purple-50/50 dark:hover:bg-purple-900/20";
                                                            }

                                                            // Determine column "all selected" state for main rows ONLY
                                                            const isAllSelected = filteredSelectedComponents.every(c => {
                                                                const s = getItemStatus(c.id, inspection.id, 0, 0);
                                                                if (s === 'completed' || s === 'incomplete') return true;
                                                                return isSelected(c.id, inspection.id, 0, 0);
                                                            });

                                                            return (
                                                                <th key={inspection.id} className={\`p-1 border-b border-slate-200 dark:border-slate-700 min-w-[50px] relative transition-colors bg-slate-50 dark:bg-slate-800 \${hoverBg}\`}>
                                                                    <div className="flex flex-col items-center h-40">
                                                                        <div className="mt-2" title="Select ALL for filtered components">
                                                                            <input 
                                                                                type="checkbox" 
                                                                                className="h-4 w-4 rounded border-gray-400 cursor-pointer accent-blue-600"
                                                                                checked={isAllSelected && filteredSelectedComponents.length > 0}
                                                                                onChange={(e) => handleColumnBulkToggle(inspection.id, e.target.checked)}
                                                                                disabled={readOnly || filteredSelectedComponents.length === 0}
                                                                            />
                                                                        </div>
                                                                        <div className={\`flex-1 writing-mode-vertical text-[10px] uppercase font-bold whitespace-normal leading-snug transform rotate-180 py-2 w-full flex items-center justify-center text-center tracking-wider \${textColor}\`} style={{ writingMode: 'vertical-rl' }} title={\`\${inspection.code} - \${inspection.name}\`}>
                                                                            {inspection.name}
                                                                        </div>
                                                                    </div>
                                                                    <div className={\`absolute inset-x-0 bottom-0 h-1 \${barColor}\`}></div>
                                                                </th>
                                                            );
                                                        })}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredSelectedComponents.map((component) => {
                                                        const isSplit = componentSplitByElevation[component!.id];
                                                        let componentRanges: Array<{ start: number; end: number }> = [];
                                                        const breakpoints = componentBreakpoints[component!.id] || [];

                                                        const cElv1 = typeof component!.elv_1 === 'string' ? parseFloat(component!.elv_1) : component!.elv_1 ?? 0;
                                                        const cElv2 = typeof component!.elv_2 === 'string' ? parseFloat(component!.elv_2) : component!.elv_2 ?? 0;

                                                        if (isSplit && component!.elv_1 != null && component!.elv_2 != null) {
                                                            const minElv = Math.min(cElv1, cElv2);
                                                            const maxElv = Math.max(cElv1, cElv2);
                                                            const relevantBreakpoints = breakpoints.filter(elv => elv > minElv && elv < maxElv).sort((a, b) => a - b);
                                                            const allPoints = [minElv, ...relevantBreakpoints, maxElv];

                                                            for (let i = 0; i < allPoints.length - 1; i++) {
                                                                componentRanges.push({ start: allPoints[i], end: allPoints[i + 1] });
                                                            }
                                                            componentRanges.reverse();
                                                        }

                                                        if (componentRanges.length === 0) {
                                                            componentRanges = [{ start: cElv1, end: cElv2 }];
                                                        }

                                                        const wholeComponentRange = { start: 0, end: 0 };
                                                        const minElv = Math.min(cElv1 || 0, cElv2 || 0);
                                                        const maxElv = Math.max(cElv1 || 0, cElv2 || 0);

                                                        // Row "All Selected" state
                                                        const isRowAllSelected = filteredInspectionTypes.every(insp => {
                                                            const s = getItemStatus(component!.id, insp.id, 0, 0);
                                                            if (s === 'completed' || s === 'incomplete') return true;
                                                            return isSelected(component!.id, insp.id, 0, 0);
                                                        });

                                                        return (
                                                            <React.Fragment key={component!.id}>
                                                                <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 group/row transition-colors">
                                                                    <td className="p-4 border-r border-slate-100 dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/50 z-10 w-[240px] align-top shadow-[4px_0_16px_-4px_rgba(0,0,0,0.05)]">
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="mt-0.5" title="Select ALL tasks for this component">
                                                                                <input 
                                                                                    type="checkbox"
                                                                                    className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-slate-700"
                                                                                    checked={isRowAllSelected}
                                                                                    onChange={(e) => handleRowBulkToggle(component!.id, e.target.checked)}
                                                                                    disabled={readOnly}
                                                                                />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="font-bold text-sm truncate" title={component!.qid || ''}>{component!.qid}</div>
                                                                                </div>
                                                                                <div className="text-xs text-blue-600 dark:text-blue-400 font-bold tracking-widest uppercase mb-1" title={component!.type || ''}>{component!.type}</div>
                                                                                
                                                                                <div className="flex flex-wrap gap-1 mb-1.5">
                                                                                    {component!.comp_group && <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700">{component.comp_group}</span>}
                                                                                    {component!.lvl && <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700">Lvl: {component.lvl}</span>}
                                                                                </div>

                                                                                <div className="text-[11px] text-gray-700 dark:text-gray-300 font-mono font-medium whitespace-nowrap mt-1 flex items-center justify-between">
                                                                                    <span>{minElv.toFixed(1)}m - {maxElv.toFixed(1)}m</span>
                                                                                    {/* Split Toggle */}
                                                                                    {component!.elv_1 != null && component!.elv_2 != null && (
                                                                                        <div className="flex items-center gap-1.5 ml-auto">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                id={\`split-\${component!.id}\`}
                                                                                                checked={!!componentSplitByElevation[component!.id]}
                                                                                                onChange={(e) => {
                                                                                                    setComponentSplitByElevation(prev => ({
                                                                                                        ...prev,
                                                                                                        [component!.id]: e.target.checked
                                                                                                    }));
                                                                                                }}
                                                                                                className="h-3 w-3 cursor-pointer accent-blue-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                                disabled={readOnly}
                                                                                            />
                                                                                            <label htmlFor={\`split-\${component!.id}\`} className="text-[9px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none uppercase tracking-wider">
                                                                                                Split
                                                                                            </label>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Configuration Controls (Only if split is enabled) */}
                                                                                {isSplit && (
                                                                                    <div className="mt-1.5 pl-2 border-l-2 border-blue-100 dark:border-blue-900 flex flex-col gap-1.5 animate-in slide-in-from-left-2 duration-200">
                                                                                        {/* Inputs Row */}
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <div className="flex items-center relative flex-1 min-w-[70px]">
                                                                                                <input
                                                                                                    type="number"
                                                                                                    step="0.1"
                                                                                                    placeholder="Split..."
                                                                                                    className="w-full h-6 text-[10px] pl-1.5 pr-4 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-400 focus:ring-0 transition-colors placeholder:text-slate-400"
                                                                                                    value={newElevationInput[component!.id] || ''}
                                                                                                    onChange={(e) => setNewElevationInput(prev => ({
                                                                                                        ...prev,
                                                                                                        [component!.id]: e.target.value
                                                                                                    }))}
                                                                                                    onKeyPress={(e) => {
                                                                                                        if (e.key === 'Enter') {
                                                                                                            handleAddComponentBreakpoint(component!.id, parseFloat(newElevationInput[component!.id]));
                                                                                                            setNewElevationInput(prev => ({ ...prev, [component!.id]: '' }));
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                                                                {!readOnly && <Plus
                                                                                                    className="h-3 w-3 text-blue-400 absolute right-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-300"
                                                                                                    onClick={() => {
                                                                                                        handleAddComponentBreakpoint(component!.id, parseFloat(newElevationInput[component!.id]));
                                                                                                        setNewElevationInput(prev => ({ ...prev, [component!.id]: '' }));
                                                                                                    }}
                                                                                                />}
                                                                                            </div>

                                                                                            <div className="flex items-center relative flex-1 min-w-[70px]">
                                                                                                <input
                                                                                                    type="number"
                                                                                                    step="0.1"
                                                                                                    placeholder="Interval..."
                                                                                                    className="w-full h-6 text-[10px] pl-1.5 pr-5 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-400 focus:ring-0 transition-colors placeholder:text-slate-400"
                                                                                                    value={autoSplitIntervals[component!.id] || ''}
                                                                                                    onChange={(e) => setAutoSplitIntervals(prev => ({
                                                                                                        ...prev,
                                                                                                        [component!.id]: e.target.value
                                                                                                    }))}
                                                                                                    onKeyPress={(e) => {
                                                                                                        if (e.key === 'Enter') {
                                                                                                            const interval = parseFloat(autoSplitIntervals[component!.id]);
                                                                                                            if (!isNaN(interval) && interval > 0) {
                                                                                                                const newPoints: number[] = [];
                                                                                                                if (interval > 0.001 && maxElv > minElv) {
                                                                                                                    for (let val = minElv + interval; val < maxElv; val += interval) {
                                                                                                                        newPoints.push(Math.round(val * 10) / 10);
                                                                                                                    }
                                                                                                                }
                                                                                                                setComponentBreakpoints(prev => ({
                                                                                                                    ...prev,
                                                                                                                    [component!.id]: newPoints.sort((a, b) => a - b)
                                                                                                                }));
                                                                                                                setAutoSplitIntervals(prev => ({ ...prev, [component!.id]: '' }));
                                                                                                            }
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        const interval = parseFloat(autoSplitIntervals[component!.id]);
                                                                                                        if (!isNaN(interval) && interval > 0) {
                                                                                                            const newPoints: number[] = [];
                                                                                                            if (interval > 0.001 && maxElv > minElv) {
                                                                                                                for (let val = minElv + interval; val < maxElv; val += interval) {
                                                                                                                    newPoints.push(Math.round(val * 10) / 10);
                                                                                                                }
                                                                                                            }
                                                                                                            setComponentBreakpoints(prev => ({
                                                                                                                ...prev,
                                                                                                                [component!.id]: newPoints.sort((a, b) => a - b)
                                                                                                            }));
                                                                                                            setAutoSplitIntervals(prev => ({ ...prev, [component!.id]: '' }));
                                                                                                        }
                                                                                                    }}
                                                                                                    className="absolute right-1 top-0.5 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                                                                                >
                                                                                                    <Columns className="h-3 w-3 text-purple-400 hover:text-purple-600 dark:hover:text-purple-300" />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Existing Breakpoints List */}
                                                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                                                            {breakpoints.map((bp) => (
                                                                                                <span key={bp} className="inline-flex items-center text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-300 hover:text-red-600 rounded px-1 border border-slate-200 dark:border-slate-700 cursor-pointer group/bp transition-colors"
                                                                                                    onClick={() => handleRemoveComponentBreakpoint(component!.id, bp)}
                                                                                                    title="Click to remove"
                                                                                                >
                                                                                                    {bp}m
                                                                                                    {!readOnly && <X className="h-2 w-2 ml-0.5 opacity-0 group-hover/bp:opacity-100" />}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    {filteredInspectionTypes.map((inspection) => {
                                                                        const itemStatus = getItemStatus(component!.id, inspection.id, 0, 0);
                                                                        const isLocked = itemStatus === 'completed' || itemStatus === 'incomplete';
                                                                        return (
                                                                        <td key={inspection.id} className="p-2 border-r text-center align-middle bg-gray-50/30 dark:bg-slate-800/30">
                                                                            <div className="flex justify-center items-center gap-2" title={isLocked ? \`Cannot untick — status: \${itemStatus}\` : "Select for WHOLE component"}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className={\`h-4 w-4 rounded border-gray-400 dark:border-slate-500 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:bg-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed \${isLocked ? 'accent-emerald-600' : ''}\`}
                                                                                    checked={isSelected(component!.id, inspection.id, 0, 0)}
                                                                                    onChange={() => !readOnly && !isLocked && toggleSelection(component!.id, inspection.id, 0, 0)}
                                                                                    disabled={readOnly || isLocked}
                                                                                />
                                                                                {isSelected(component!.id, inspection.id, 0, 0) && (
                                                                                    <div title={itemStatus}>
                                                                                        {getStatusIcon(itemStatus)}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        );
                                                                    })}
                                                                </tr>

                                                                {/* SPLIT ROWS: Only if split is enabled */}
                                                                {
                                                                    isSplit && componentRanges.map((range, idx) => (
                                                                        <tr key={\`\${component!.id}-split-\${idx}\`} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                                                            <td className="p-2 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky left-0 z-10 w-[300px] pl-8 text-xs text-slate-500 dark:text-slate-400 font-mono border-l-4 border-l-blue-100 dark:border-l-blue-900 shadow-[4px_0_16px_-4px_rgba(0,0,0,0.05)]">
                                                                                {range.start.toFixed(1)}m - {range.end.toFixed(1)}m
                                                                            </td>
                                                                            {filteredInspectionTypes.map((inspection) => {
                                                                                const isWholeSelected = isSelected(component!.id, inspection.id, 0, 0);
                                                                                const splitStatus = getItemStatus(component!.id, inspection.id, range.start, range.end);
                                                                                const isSplitLocked = splitStatus === 'completed' || splitStatus === 'incomplete';
                                                                                return (
                                                                                    <td key={inspection.id} className="p-2 border-r border-slate-100 dark:border-slate-800 text-center bg-white dark:bg-slate-900">
                                                                                        <div className="flex justify-center items-center gap-2">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                className={\`h-3 w-3 rounded border-gray-300 dark:border-gray-600 cursor-pointer text-blue-500 focus:ring-blue-500 disabled:opacity-30 disabled:cursor-not-allowed \${isSplitLocked ? 'accent-emerald-600' : ''}\`}
                                                                                                checked={isSelected(component!.id, inspection.id, range.start, range.end)}
                                                                                                onChange={() => !readOnly && !isSplitLocked && toggleSelection(component!.id, inspection.id, range.start, range.end)}
                                                                                                disabled={isWholeSelected || readOnly || isSplitLocked}
                                                                                            />
                                                                                            {isSelected(component!.id, inspection.id, range.start, range.end) && (
                                                                                                <div title={splitStatus}>
                                                                                                    {getStatusIcon(splitStatus)}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                )
                                                                            })}
                                                                        </tr>
                                                                    ))
                                                                }


                                                            </React.Fragment >
                                                        );
                                                    })}
                                                </tbody >
                                            </table >
                                        </div >
                                    )}
                                </div >
                            </div >

                            {/* Actions */}
                            < div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2" >
                                <Button
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving || filteredInspectionTypes.length === 0 || reportNumbers.length === 0 || readOnly}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-200 disabled:opacity-50 disabled:shadow-none min-w-[120px] disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <>
                                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                            Saving...
                                        </>
                                    ) : readOnly ? (
                                        <>
                                            <ShieldCheck className="mr-2 h-4 w-4" />
                                            Read Only
                                        </>
                                    ) : (
                                        <>
                                            Save Configuration
                                        </>
                                    )}
                                </Button>
                            </div >
                        </div >
                    )}
                </DialogContent >
            </Dialog >

            <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Initialize Scope for {pendingReportToAdd?.number}</DialogTitle>
                        <DialogDescription>
                            How would you like to initialize the scope for this new report?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-4">
                        <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => handleConfirmCopyScope('empty')}
                        >
                            Start with Empty Scope
                        </Button>

                        {reportNumbers.length > 0 && (
                            <>
                                <div className="text-sm font-medium pt-2">Copy from existing reports:</div>
                                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                                    {reportNumbers.map(s => (
                                        <div key={s.number} className="flex gap-2 items-center border p-2 rounded hover:bg-gray-50 dark:hover:bg-slate-800">
                                            <span className="text-sm font-medium w-24 truncate" title={s.number}>{s.number}</span>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1 text-xs"
                                                onClick={() => handleConfirmCopyScope('copy', s.number)}
                                            >
                                                Copy All
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1 text-xs"
                                                onClick={() => handleConfirmCopyScope('copy_pending', s.number)}
                                            >
                                                Copy Pending
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
`;

fs.writeFileSync(filePath, topContent + newBottomContent, 'utf8');
console.log("Successfully replaced bottom content.");
