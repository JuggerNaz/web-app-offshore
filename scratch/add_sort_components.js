const fs = require('fs');
let content = fs.readFileSync('components/component/component-content.tsx', 'utf-8');

// 1. Add imports
content = content.replace(
  "import { ChevronRight, ChevronDown, MoreVertical, Plus, Search, Filter, Archive, Hash, Calendar, Box, Activity, Trash2 } from \"lucide-react\";",
  "import { ChevronRight, ChevronDown, MoreVertical, Plus, Search, Filter, Archive, Hash, Calendar, Box, Activity, Trash2, ArrowDown, ArrowUp, ArrowUpDown } from \"lucide-react\";"
);

// 2. Add sorting state and logic
const stateLogic = `  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      setSortConfig(null);
      return;
    }
    setSortConfig({ key, direction });
  };`;
content = content.replace(
  "  const [deleteId, setDeleteId] = useState<number | null>(null);\n  const [deleteLoading, setDeleteLoading] = useState(false);\n  const [isLoadingTypes, setIsLoadingTypes] = useState(true);",
  stateLogic
);

// 3. Apply sorting
const sortingLogic = `    return matchesSearch;
  });

  const sortedComponents = [...filteredComponents].sort((a, b) => {
    if (!sortConfig) return 0;
    
    let valA: any = null;
    let valB: any = null;
    
    switch (sortConfig.key) {
      case 'id_no':
        valA = a.id_no || '';
        valB = b.id_no || '';
        break;
      case 'q_id':
        valA = a.q_id || '';
        valB = b.q_id || '';
        break;
      case 'code':
        valA = a.code || '';
        valB = b.code || '';
        break;
      case 'kp_node':
        valA = pageType === "pipeline" ? (a.metadata?.kp || 0) : (a.metadata?.s_node || '');
        valB = pageType === "pipeline" ? (b.metadata?.kp || 0) : (b.metadata?.s_node || '');
        break;
      case 'depth_leg':
        valA = pageType === "pipeline" ? (a.metadata?.depth || 0) : (a.metadata?.s_leg || '');
        valB = pageType === "pipeline" ? (b.metadata?.depth || 0) : (b.metadata?.s_leg || '');
        break;
      case 'easting_elv':
        valA = pageType === "pipeline" ? (a.metadata?.easting || 0) : (a.metadata?.elv_1 || 0);
        valB = pageType === "pipeline" ? (b.metadata?.easting || 0) : (b.metadata?.elv_1 || 0);
        break;
      case 'created_at':
        valA = a.created_at || '';
        valB = b.created_at || '';
        break;
    }
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });`;

content = content.replace(
  "    return matchesSearch;\n  });",
  sortingLogic
);

// Update map variable
content = content.replace(
  "filteredComponents.map((comp: Component)",
  "sortedComponents.map((comp: Component)"
);

// Update count
content = content.replace(
  "Listing {filteredComponents.length} Data Points",
  "Listing {sortedComponents.length} Data Points"
);
content = content.replace(
  "filteredComponents.length === 0",
  "sortedComponents.length === 0"
);

// 4. Update TableTh
const tableTh = `function TableTh({ children, className, onClick, sortDirection }: { children: React.ReactNode, className?: string, onClick?: () => void, sortDirection?: 'asc' | 'desc' | null }) {
  return (
    <th 
      className={cn(
        "h-14 px-4 text-left align-middle font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500",
        onClick && "cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors select-none",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortDirection !== undefined && (
          <span className="flex-shrink-0">
            {sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-50" />}
          </span>
        )}
      </div>
    </th>
  );
}`;

content = content.replace(
  /function TableTh\(\{ children, className \}: \{ children: React\.ReactNode, className\?: string \}\) \{\s*return \(\s*<th className=\{cn\(\s*"h-14 px-4 text-left align-middle font-black text-\[10px\] uppercase tracking-\[0\.2em\] text-slate-400 dark:text-slate-500",\s*className\s*\)\}>\s*\{children\}\s*<\/th>\s*\);\s*\}/,
  tableTh
);

// 5. Update headers
const headers = `                  <TableTh className="w-[200px]" onClick={() => handleSort('id_no')} sortDirection={sortConfig?.key === 'id_no' ? sortConfig.direction : null}>{pageType === "pipeline" ? "ID No" : "System ID No"}</TableTh>
                  <TableTh className="w-[140px]" onClick={() => handleSort('q_id')} sortDirection={sortConfig?.key === 'q_id' ? sortConfig.direction : null}>Q ID</TableTh>
                  <TableTh className="w-[100px]" onClick={() => handleSort('code')} sortDirection={sortConfig?.key === 'code' ? sortConfig.direction : null}>Type</TableTh>
                  <TableTh className="w-[180px]" onClick={() => handleSort('kp_node')} sortDirection={sortConfig?.key === 'kp_node' ? sortConfig.direction : null}>{pageType === "pipeline" ? "KP" : "Node Path (S/E)"}</TableTh>
                  <TableTh className="w-[160px]" onClick={() => handleSort('depth_leg')} sortDirection={sortConfig?.key === 'depth_leg' ? sortConfig.direction : null}>{pageType === "pipeline" ? "Depth" : "Platform Leg (S/E)"}</TableTh>
                  <TableTh className="w-[160px]" onClick={() => handleSort('easting_elv')} sortDirection={sortConfig?.key === 'easting_elv' ? sortConfig.direction : null}>{pageType === "pipeline" ? "Easting Northing" : "Elevation (1/2)"}</TableTh>
                  <TableTh className="w-[120px]" onClick={() => handleSort('created_at')} sortDirection={sortConfig?.key === 'created_at' ? sortConfig.direction : null}>Timestamp</TableTh>
                  <TableTh className="w-[80px] text-center">Actions</TableTh>`;

content = content.replace(
  /<TableTh className="w-\[200px\]">\{pageType === "pipeline" \? "ID No" : "System ID No"\}<\/TableTh>[\s\S]*?<TableTh className="w-\[80px\] text-center">Actions<\/TableTh>/,
  headers
);

fs.writeFileSync('components/component/component-content.tsx', content);
console.log('Successfully added sorting to components table');
