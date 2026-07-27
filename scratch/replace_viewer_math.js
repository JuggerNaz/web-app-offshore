const fs = require('fs');

let content = fs.readFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', 'utf8');

// Ensure webapp3dData is in props
if (!content.includes('webapp3dData?: any;')) {
    content = content.replace(
        'interface Structural3DViewerProps {',
        'interface Structural3DViewerProps {\n    webapp3dData?: any;'
    );
}
if (!content.includes('webapp3dData,')) {
    content = content.replace(
        'wincairsParams = [],\n    onFallbackComponentsChange,',
        'wincairsParams = [],\n    onFallbackComponentsChange,\n    webapp3dData,'
    );
}

// Add state for inspection toggle
if (!content.includes('isInspectionMode')) {
    content = content.replace(
        'const [hoveredComponent, setHoveredComponent] = useState<any>(null);',
        'const [hoveredComponent, setHoveredComponent] = useState<any>(null);\n    const [isInspectionMode, setIsInspectionMode] = useState(false);'
    );
}

const startIdx = content.indexOf('const { componentLayouts, foundationMembers, elvMarkers } = useMemo(() => {');
const endIdxStr = 'const fallbackComponents = useMemo(() => {';
const endIdx = content.indexOf(endIdxStr);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find blocks");
    process.exit(1);
}

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

const newContent = content.slice(0, startIdx) + replacement + content.slice(endIdx);
fs.writeFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', newContent);
console.log('Successfully replaced frontend math with webapp_3d database integration.');
