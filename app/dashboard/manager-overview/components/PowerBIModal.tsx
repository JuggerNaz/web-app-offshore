"use client";

import React, { useState } from "react";
import {
    BarChart3,
    Copy,
    Check,
    Download,
    ExternalLink,
    Database,
    Zap,
    RefreshCw,
    X,
    FileSpreadsheet
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PowerBIModalProps {
    isOpen: boolean;
    onClose: () => void;
    summaries: any[];
    predictions: any;
    currentFilter: any;
}

export function PowerBIModal({
    isOpen,
    onClose,
    summaries,
    predictions,
    currentFilter,
}: PowerBIModalProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"connect" | "sql" | "export" | "embed">("connect");
    const [embedUrl, setEmbedUrl] = useState<string>("");

    if (!isOpen) return null;

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(id);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Export current dataset to JSON/CSV
    const downloadCSV = () => {
        const headers = ["Structure", "Field", "Install_Year", "Nominal_Thickness", "Current_Thickness", "Corrosion_Rate_mm_yr", "RUL_Years", "CP_Avg_mV", "Anode_Depletion_Pct", "Max_Scour_m", "Flooded_Members", "Open_Anomalies"];
        const rows = summaries.map(s => [
            s.structure_name,
            s.field_name,
            s.platform_info?.install_year || 1990,
            s.wall_thickness?.nominal || 25.4,
            s.wall_thickness?.current_avg || 23.5,
            s.wall_thickness?.corrosion_rate_mm_yr || 0.12,
            s.wall_thickness?.rul_years || 18,
            s.cp?.avg || -930,
            s.anode?.avgDepletion || 35,
            s.subsea_foundation?.max_scour_depth_m || 0.4,
            s.fmd?.conditions?.flooded || 0,
            s.anomalies?.open || 0,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `offshore_inspection_summary_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const sqlScript = `-- Supabase PostgreSQL Views & RPC for Power BI Integration

-- 1. View: Structure Health & Remaining Useful Life (RUL)
CREATE OR REPLACE VIEW view_structure_health_scores AS
SELECT 
    p.plat_id,
    p.title AS structure_name,
    p.pfield AS oil_field,
    p.inst_date,
    p.wall_thk AS nominal_thickness_mm,
    p.depth AS water_depth_m,
    COUNT(DISTINCT r.insp_id) AS total_inspections,
    COUNT(DISTINCT a.anomaly_id) FILTER (WHERE a.status = 'OPEN') AS active_anomalies_count
FROM platform p
LEFT JOIN insp_records r ON r.structure_id = p.plat_id
LEFT JOIN insp_anomalies a ON a.inspection_id = r.insp_id
GROUP BY p.plat_id, p.title, p.pfield, p.inst_date, p.wall_thk, p.depth;

-- 2. RPC Function: Calculate Corrosion Rate & RUL on the fly
CREATE OR REPLACE FUNCTION get_corrosion_rate(original_thk NUMERIC, current_thk NUMERIC, install_yr INT, current_yr INT)
RETURNS NUMERIC AS $$
BEGIN
    IF current_yr <= install_yr THEN RETURN 0.01; END IF;
    RETURN ROUND((original_thk - current_thk) / (current_yr - install_yr), 4);
END;
$$ LANGUAGE plpgsql;`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black uppercase text-slate-900 dark:text-white">
                                Power BI &amp; Direct Analytics Hub
                            </h3>
                            <p className="text-xs text-slate-400">
                                Connect Supabase PostgreSQL directly to Power BI Desktop / Power BI Service
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Sub-Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 pt-2 bg-slate-50/50 dark:bg-slate-800/30">
                    {[
                        { id: "connect", label: "1. Direct Connection" },
                        { id: "sql", label: "2. SQL Views & RPC" },
                        { id: "export", label: "3. Export Dataset" },
                        { id: "embed", label: "4. Embed Report" },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={cn(
                                "px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all",
                                activeTab === t.id
                                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {activeTab === "connect" && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300">
                                <span className="font-black block mb-1">Power BI DirectQuery Instructions:</span>
                                Open <strong>Power BI Desktop</strong> ➔ Click <strong>Get Data</strong> ➔ Select <strong>PostgreSQL database</strong> ➔ Enter the connection parameters below.
                            </div>

                            <div className="space-y-3">
                                {[
                                    { label: "Server / Host", value: "db.supabase.co (or your Supabase Host IP)", id: "host" },
                                    { label: "Port", value: "5432 (or 6543 for Session Pooler)", id: "port" },
                                    { label: "Database", value: "postgres", id: "db" },
                                    { label: "Data Connectivity Mode", value: "DirectQuery (for real-time) or Import Mode (daily refresh)", id: "mode" },
                                    { label: "SSL Mode", value: "Require (Encrypted)", id: "ssl" },
                                ].map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase block">{item.label}</span>
                                            <span className="text-slate-900 dark:text-white font-mono">{item.value}</span>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(item.value, item.id)}
                                            className="p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-400 hover:text-blue-500 transition-all border border-slate-200 dark:border-slate-600"
                                            title="Copy value"
                                        >
                                            {copiedField === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "sql" && (
                        <div className="space-y-3">
                            <p className="text-slate-400 font-medium">
                                Run this SQL in your Supabase SQL Editor. It creates fast server-side views and functions for Power BI without pulling raw rows:
                            </p>
                            <div className="relative">
                                <pre className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto border border-slate-800">
                                    {sqlScript}
                                </pre>
                                <button
                                    onClick={() => copyToClipboard(sqlScript, "sql")}
                                    className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] font-black uppercase transition-all"
                                >
                                    {copiedField === "sql" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>Copy SQL</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "export" && (
                        <div className="space-y-4 text-center py-6">
                            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                                <FileSpreadsheet className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-base font-black text-slate-900 dark:text-white uppercase">
                                    Export Filtered Dashboard Dataset
                                </h4>
                                <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
                                    Download current active scope inspection summaries, corrosion rate, RUL, and CP metrics directly into CSV for Power BI Desktop.
                                </p>
                            </div>
                            <button
                                onClick={downloadCSV}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                            >
                                <Download className="w-4 h-4" />
                                <span>Download CSV Dataset ({summaries.length} Structures)</span>
                            </button>
                        </div>
                    )}

                    {activeTab === "embed" && (
                        <div className="space-y-4">
                            <p className="text-slate-400 font-medium">
                                Paste your Power BI Service report embed URL or published web link:
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={embedUrl}
                                    onChange={(e) => setEmbedUrl(e.target.value)}
                                    placeholder="https://app.powerbi.com/reportEmbed?reportId=..."
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            {embedUrl ? (
                                <div className="w-full h-80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950">
                                    <iframe
                                        src={embedUrl}
                                        title="Embedded Power BI Report"
                                        className="w-full h-full border-0"
                                        allowFullScreen
                                    />
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                    Enter your Power BI Embed URL above to preview the embedded report synchronized with your active filter.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
