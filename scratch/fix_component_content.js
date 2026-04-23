const fs = require('fs');
let content = fs.readFileSync('components/component/component-content.tsx', 'utf-8');

const target = `  const {
    data: componentsData,

  const handleEditComponent = (component: Component) => {`;

const replacement = `  const {
    data: componentsData,
    error: componentsError,
    isLoading: isLoadingComponents,
  } = useSWR(apiUrl, fetcher);

  const components = componentsData?.data || [];

  // Filter components by search query and type relevancy
  const filteredComponents = components.filter((comp: Component) => {
    const matchesSearch = comp.q_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter based on component type's pipe/plat if we have the types loaded
    if (componentTypes.length > 0 && (pageType === 'pipeline' || pageType === 'platform')) {
      const typeDef = componentTypes.find((t) => t.code === comp.code);
      if (typeDef) {
        if (pageType === 'pipeline' && typeDef.pipe !== 1) return false;
        if (pageType === 'platform' && typeDef.plat !== 1) return false;
      }
    }
    
    return matchesSearch;
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
  });

  const getComponentName = (code: string | null) => {
    if (!code) return null;
    const type = componentTypes.find((t) => t.code === code);
    return type?.name || code;
  };

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

  const handleEditComponent = (component: Component) => {`;

// Standardize line endings just in case
content = content.replace(/\r\n/g, '\n');
const targetUnix = target.replace(/\r\n/g, '\n');

if (content.includes(targetUnix)) {
  content = content.replace(targetUnix, replacement);
  fs.writeFileSync('components/component/component-content.tsx', content);
  console.log("Successfully fixed component-content.tsx");
} else {
  console.log("Target not found. Current snippet around line 97:");
  const lines = content.split('\n');
  console.log(lines.slice(90, 110).join('\n'));
}
