import { format } from "date-fns";

/**
 * Maps raw inspection records into a format suitable for docxtemplater loops.
 */
export const mapInspectionDataForDocx = async (records: any[], aliases: any[]) => {
    const safeAliases = Array.isArray(aliases) ? aliases : [];
    const aliasMap = new Map(safeAliases.map(a => [a.template_id, a.alias]));

    // 1. Group records by their inspection type code
    const grouped: Record<string, any[]> = {};
    records.forEach(r => {
        const code = r.inspection_type?.code || "GENERAL";
        if (!grouped[code]) grouped[code] = [];
        grouped[code].push(r);
    });

    const reportData: any = {
        HAS_GVI: (grouped['RGVI']?.length || 0) > 0,
        HAS_CP: (grouped['CP']?.length || 0) > 0,
        HAS_MGI: (grouped['RMGI']?.length || 0) > 0,
        HAS_FMD: (grouped['FMD']?.length || 0) > 0,
    };

    // 2. Format specific tables
    
    // CP Table
    if (reportData.HAS_CP) {
        reportData.CP_TABLE = grouped['CP'].map(r => ({
            component: r.structure_components?.q_id || "N/A",
            reading: r.inspection_data?.cp_reading || r.inspection_dat?.cp_reading || "-",
            status: r.inspection_data?.status || "N/A",
            date: r.inspection_date ? format(new Date(r.inspection_date), 'dd/MM/yyyy') : "-"
        }));
    }

    // MGI Table
    if (reportData.HAS_MGI) {
        reportData.MGI_TABLE = grouped['RMGI'].map(r => {
            const d = r.inspection_data || r.inspection_dat || {};
            return {
                depth: r.elevation || "-",
                hard_12: d.mgi_hard_thickness_at_12 || "-",
                hard_3: d.mgi_hard_thickness_at_3 || "-",
                hard_6: d.mgi_hard_thickness_at_6 || "-",
                hard_9: d.mgi_hard_thickness_at_9 || "-",
                limit: d.mgi_profile || "-",
                findings: r.description || "N/A"
            };
        });
    }

    // 3. Handle System Aliases
    // For every alias defined in settings, we create a specific tag
    const templateCodeMap: Record<string, string[]> = {
        'rov-gvi-report': ['RGVI'],
        'rov-mgi-report': ['RMGI', 'MGROW'],
        'rov-seabed-report': ['RSEAB'],
        'rov-cp-report': ['CP', 'RSANI'],
        'rov-fmd-report': ['RFMD'],
        'rov-riser-report': ['RRISI'],
        'rov-scour-report': ['RSCOR'],
        'rov-caisson-report': ['RCASN'],
        'rov-conductor-report': ['RCOND'],
        'rov-splash-zone-report': ['RSZCI'],
        'rov-node-report': ['RSWNI']
    };

    safeAliases.forEach(a => {
        const recordsForTemplate = records.filter(r => {
            const code = (r.inspection_type?.code || "").toUpperCase();
            const templateId = a.template_id.toLowerCase();
            
            // 1. Check explicit map first
            if (templateCodeMap[templateId] && templateCodeMap[templateId].includes(code)) {
                return true;
            }

            // 2. Fallback heuristic
            const upperTemplateId = templateId.toUpperCase();
            return upperTemplateId.includes(code) || code.includes(upperTemplateId.replace('-REPORT', '').replace('ROV-', 'R'));
        });
        if (recordsForTemplate.length > 0) {
            reportData[`T_${a.alias}`] = true; // Conditional flag
            reportData[`${a.alias}_RECORDS`] = recordsForTemplate.map((r, idx) => {
                const d = r.inspection_data || r.inspection_dat || {};
                
                // Specific flattening for Seabed Records
                if (a.template_id.toLowerCase() === 'rov-seabed-report') {
                    return {
                        id: idx + 1,
                        qid: r.structure_components?.q_id || "N/A",
                        face: d.face || "-",
                        distance: parseFloat(d.distance_from_leg) || 0,
                        northing: d.northing || "-",
                        easting: d.easting || "-",
                        description: r.description?.replace(/^(Debris|Gas Seepage|Crater|Seabed Debris):\s*/, '') || "-",
                        material: d.material || d.debris_material || "Unknown",
                        dims: d.size_dimensions || d.dimension_1 || "-"
                    };
                }

                // Default flattening for other aliases
                return {
                    qid: r.structure_components?.q_id || "N/A",
                    elevation: r.elevation || "-",
                    description: r.description || "N/A",
                    data: d
                };
            });
        }
    });

    return reportData;
};

/**
 * Generates an MGI profile chart as a Base64 image using a hidden canvas.
 */
export const generateMgiProfileImage = async (records: any[]): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Draw Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Simple line chart representation
        ctx.strokeStyle = '#1e3a8a'; // Navy
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const padding = 40;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);

        // Sort by elevation
        const sorted = [...records].sort((a,b) => parseFloat(a.elevation) - parseFloat(b.elevation));

        sorted.forEach((r, i) => {
            const x = padding + (i * (chartWidth / (sorted.length - 1 || 1)));
            const val = parseFloat(r.inspection_data?.mgi_hard_thickness_at_12 || 0);
            const y = (canvas.height - padding) - (val * (chartHeight / 500)); // Assume 500mm max

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        return canvas.toDataURL('image/png').split(',')[1]; // Return only base64 part
    } catch (e) {
        console.error("Error generating MGI image:", e);
        return null;
    }
};

/**
 * Generates a Seabed Map as a Base64 image using a hidden canvas.
 */
export const generateSeabedMapImage = async (records: any[]): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Draw Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxRadius = 250;
        
        // Find max distance, default to 21
        let maxDist = 21;
        records.forEach(r => {
            const d = parseFloat(r.inspection_data?.distance_from_leg || r.inspection_dat?.distance_from_leg || 0);
            if (d > maxDist) maxDist = Math.ceil(d / 21) * 21;
        });

        // Draw compass labels
        ctx.fillStyle = '#666666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NORTH', cx, 20);
        ctx.fillText('SOUTH', cx, canvas.height - 10);
        ctx.textAlign = 'left';
        ctx.fillText('WEST', 10, cy);
        ctx.textAlign = 'right';
        ctx.fillText('EAST', canvas.width - 10, cy);

        // Platform Center Square (Legs)
        const innerRatio = 0.15;
        const dx = maxRadius * innerRatio;
        const scale = (maxRadius - dx) / maxDist;

        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - dx, cy - dx, dx * 2, dx * 2);
        ctx.fillStyle = '#cccccc';
        
        // Legs
        const legOffsets = [
            { x: -dx, y: -dx, n: "A1" },
            { x: dx,  y: -dx, n: "A2" },
            { x: -dx, y: dx,  n: "B1" },
            { x: dx,  y: dx,  n: "B2" },
        ];
        
        legOffsets.forEach(leg => {
            ctx.beginPath();
            ctx.arc(cx + leg.x, cy + leg.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#000';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(leg.n, cx + leg.x, cy + leg.y);
            ctx.fillStyle = '#cccccc';
        });

        // Grid Rings
        ctx.strokeStyle = '#eeeeee';
        for (let d = 3; d <= maxDist; d += 3) {
            const r = dx + (d * scale);
            ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
            
            // Labels
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${d}m`, cx - r + 2, cy - r + 12);
        }

        // Draw Items
        records.forEach((r, idx) => {
            const x = parseFloat(r.inspection_data?.x || r.inspection_dat?.x || 50);
            const y = parseFloat(r.inspection_data?.y || r.inspection_dat?.y || 50);
            const d = parseFloat(r.inspection_data?.distance_from_leg || r.inspection_dat?.distance_from_leg || 0);
            const type = r.inspection_data?.category || r.inspection_data?.type || r.description || '';
            const material = r.inspection_data?.material || r.inspection_data?.debris_material || '';

            const angle = Math.atan2(y - 50, x - 50);
            const radius = dx + (d * scale);
            const screenX = cx + radius * Math.cos(angle);
            const screenY = cy + radius * Math.sin(angle);

            if (type.includes('Gas Seepage')) ctx.fillStyle = '#22c55e'; // Green
            else if (type.includes('Crater')) ctx.fillStyle = '#a855f7'; // Purple
            else if (material.includes('Metallic')) ctx.fillStyle = '#1d4ed8'; // Blue
            else ctx.fillStyle = '#ea580c'; // Orange

            ctx.beginPath();
            ctx.arc(screenX, screenY, 8, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((idx + 1).toString(), screenX, screenY);
        });

        // Draw Legend
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        let legX = 20;
        const legY = canvas.height - 20;
        
        ctx.fillStyle = '#1d4ed8'; ctx.beginPath(); ctx.arc(legX, legY, 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#666'; ctx.fillText('METALLIC', legX + 10, legY + 4); legX += 90;

        ctx.fillStyle = '#ea580c'; ctx.beginPath(); ctx.arc(legX, legY, 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#666'; ctx.fillText('NON-METALLIC', legX + 10, legY + 4); legX += 110;

        ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(legX, legY, 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#666'; ctx.fillText('SEEPAGE', legX + 10, legY + 4); legX += 90;

        ctx.fillStyle = '#a855f7'; ctx.beginPath(); ctx.arc(legX, legY, 5, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#666'; ctx.fillText('CRATER', legX + 10, legY + 4);

        return canvas.toDataURL('image/png').split(',')[1];
    } catch (e) {
        console.error("Error generating Seabed image:", e);
        return null;
    }
};
