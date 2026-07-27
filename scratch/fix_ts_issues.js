const fs = require('fs');
let c = fs.readFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', 'utf8');

c = c.replace(/import \{([\s\S]*?Maximize2)\s*\} from "lucide-react";/, 'import {$1, Search, ChevronRight} from "lucide-react";');
c = c.replace(/wincairsParams = \[\],\s*onFallbackComponentsChange\s*,/, 'wincairsParams = [],\n    onFallbackComponentsChange,\n    webapp3dData,');
c = c.replace(/const \[hovered, setHovered\] = useState\(false\);/, 'const [hovered, setHovered] = useState(false);\n    const [isInspectionMode, setIsInspectionMode] = useState(false);');
c = c.replace(/const \[openDropdown, setOpenDropdown\] = useState<"elevation" \| "face" \| "display" \| null>\(null\);/, 'const [openDropdown, setOpenDropdown] = useState<"elevation" | "face" | "display" | "inspection" | null>(null);');
c = c.replace(/interface Structural3DViewerProps \{/, 'interface Structural3DViewerProps {\n    webapp3dData?: any;');

fs.writeFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', c);
console.log('Fixed imports and states');
