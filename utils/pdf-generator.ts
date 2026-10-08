import jsPDF from "jspdf";
import autoTablePlugin from "jspdf-autotable";
import {
  loadLogoWithTransparency,
  drawLogo as drawSharedLogo,
  applyWatermarkAndSignaturesGlobal,
  REPORT_FOOTER_APP_TEXT,
  formatPdfDate
} from "./report-generators/shared-logo";

// Helper to load image for PDF with transparency support
const loadLogo = async (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
  return await loadLogoWithTransparency(url);
};

const drawLogo = (doc: any, logo: any, maxW: number, maxH: number, x: number, y: number, alignX = 'left', alignY = 'center') => {
  drawSharedLogo(doc, logo, maxW, maxH, x, y, alignX, alignY);
};

const getPublicStorageUrl = (pathOrUrl: string): string => {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const str = pathOrUrl.trim().replace(/\\/g, '/');
  if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:") || str.startsWith("/")) {
    return str;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const cleanPath = str.replace(/^\/?(attachments\/)?/, "").replace(/^\//, "");
  return supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/attachments/${cleanPath}` : str;
};

const loadImage = async (url: string, id?: number | string): Promise<string> => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    if (id) {
      url = `/api/attachment/url?id=${id}`;
    } else {
      throw new Error("Empty or invalid image URL");
    }
  }

  const cleanUrl = url.trim();
  if (cleanUrl.startsWith("data:image/")) {
    return cleanUrl;
  }

  // Helper: convert a Blob to a base64 data URL string
  const blobToDataUrl = (blob: Blob): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!blob || blob.size === 0) { resolve(null); return; }
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  };

  // Helper: fetch a URL and return data URL, or null
  const fetchAsDataUrl = async (fetchUrl: string): Promise<string | null> => {
    try {
      const resp = await fetch(fetchUrl);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return await blobToDataUrl(blob);
    } catch {
      return null;
    }
  };

  // ── Strategy 1: /api/attachment/url proxy (server-side download, NO CORS) ──
  // This is the most reliable method. The server downloads from Supabase storage
  // using the service role key and streams the binary back as a same-origin response.
  if (id) {
    const proxyUrl = `/api/attachment/url?id=${id}`;
    const result = await fetchAsDataUrl(proxyUrl);
    if (result) return result;
  }

  // If the url is already an /api/ proxy path, try it directly
  if (cleanUrl.startsWith("/api/")) {
    const result = await fetchAsDataUrl(cleanUrl);
    if (result) return result;
  }

  // ── Strategy 2: Direct fetch (works for same-origin or CORS-enabled URLs) ──
  const fullUrl = getPublicStorageUrl(cleanUrl);
  {
    const result = await fetchAsDataUrl(fullUrl);
    if (result) return result;
  }

  // ── Strategy 3: Next.js image proxy ──
  if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://")) {
    const nextProxyUrl = `/_next/image?url=${encodeURIComponent(fullUrl)}&w=1200&q=85`;
    const result = await fetchAsDataUrl(nextProxyUrl);
    if (result) return result;
  }

  // ── Strategy 4: /api/attachment/url?path= proxy ──
  if (fullUrl.includes("structure-images") || fullUrl.includes("attachments")) {
    const p = fullUrl.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/attachments\//, "").replace(/^\/?attachments\//, "");
    if (p) {
      const result = await fetchAsDataUrl(`/api/attachment/url?path=${encodeURIComponent(p)}`);
      if (result) return result;
    }
  }

  throw new Error(`Failed to load image from URL: ${url}`);
};

// Helper to format dates cleanly for reports
const formatDisplayDate = (val?: string | null): string => {
  if (!val) return "N/A";
  const str = String(val).trim();
  if (!str) return "N/A";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const d = new Date(str.includes("T") ? str : `${str}T00:00:00`);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return str.split("T")[0];
};

interface StructureData {
  str_id: string | number;
  str_name: string;
  str_type: string;
  field_name: string;
  photo_url?: string;
  photos?: Array<{ id: number; url: string; name: string }>;
  title?: string;
  description?: string;
  pdesc?: string;
  pfield?: string;
  depth?: number | string;
  desg_life?: number | string;
  inst_date?: string;
  northing?: number | string;
  easting?: number | string;
  st_north?: number | string;
  st_east?: number | string;
  true_north_angle?: number | string;
  north_angle?: number | string;
  platform_north_side?: string;
  nleg_t1?: string;
  nleg_t2?: string;
  ptype?: string;
  function?: string;
  process?: string;
  material?: string;
  cp_system?: string;
  corr_ctg?: string;
  inst_contractor?: string;
  inst_ctr?: string;
  max_leg_dia?: number | string;
  dleg?: number | string;
  max_wall_thk?: number | string;
  wall_thk?: number | string;
  helipad?: string | boolean;
  manned?: string | boolean;
  // Extended inventory fields
  conductors?: number;
  conduct?: number;
  internal_piles?: number;
  pileint?: number;
  slots?: string | number;
  cslot?: string | number;
  cslota?: string | number;
  fenders?: number;
  fender?: number;
  risers?: number;
  riser?: number;
  sumps?: number;
  sump?: number;
  skirt_piles?: number;
  pileskt?: number;
  caissons?: number;
  caisson?: number;
  anodes?: number;
  an_qty?: number;
  cranes?: number;
  crane?: number;
  unit_system?: string;
  def_unit?: string;
  levels?: any[];
  legs?: any[];
  elevations?: any[];
  faces?: any[];
  discussions?: any[];
  visuals?: any[];
  images?: any[];
  attachments?: any[];
  comments?: string;
  components?: any[];
}

interface CompanySettings {
  company_name?: string;
  department_name?: string;
  serial_no?: string;
  logo_url?: string;
}

export interface ReportConfig {
  reportNoPrefix: string;
  reportYear: string;
  preparedBy: { name: string; date: string };
  reviewedBy?: { name: string; date: string };
  approvedBy?: { name: string; date: string };
  watermark?: { enabled: boolean; text: string; transparency: number };
  showContractorLogo: boolean;
  contractorLogoUrl?: string;
  showPageNumbers: boolean;
  returnBlob?: boolean;
  printFriendly?: boolean;
  showSignatures?: boolean;
}

interface Draw3SectionHeaderOptions {
  pageWidth: number;
  companySettings?: CompanySettings;
  config?: ReportConfig;
  reportTitle: string;
  reportNo?: string;
  structureName?: string;
  isPrintFriendly?: boolean;
  headerBlue?: [number, number, number];
}

const draw3SectionHeader = async (
  doc: any,
  options: Draw3SectionHeaderOptions
) => {
  const {
    pageWidth,
    companySettings,
    config,
    reportTitle,
    reportNo,
    structureName,
    isPrintFriendly = false,
    headerBlue = [7, 78, 136],
  } = options;

  const headerMargin = 10;
  const headerY = 7;
  const headerH = 25;
  const col1W = 55; // Left: Contractor
  const col2W = 80; // Middle: Report Title
  const col3W = 55; // Right: Client
  const x1 = headerMargin;
  const x2 = x1 + col1W;
  const x3 = x2 + col2W;

  const headerBorderColor: [number, number, number] = [200, 200, 200];
  const headerLineWidth = 0.2;
  const titleTextColor: [number, number, number] = isPrintFriendly ? [7, 78, 136] : [255, 255, 255];
  const titleSubTextColor: [number, number, number] = isPrintFriendly ? [51, 65, 85] : [219, 234, 254];

  // Resolve Contractor Logo
  const contractorLogoUrl = config?.contractorLogoUrl || (config as any)?.contractorLogo;
  let contractorLogoData: any = null;
  if (config?.showContractorLogo !== false && contractorLogoUrl) {
    try {
      contractorLogoData = await loadLogoWithTransparency(contractorLogoUrl);
    } catch (err) {
      console.warn("Error loading contractor logo in structure report:", err);
    }
  }

  // Resolve Client Logo
  let clientLogoData: any = null;
  if (companySettings?.logo_url) {
    try {
      clientLogoData = await loadLogoWithTransparency(companySettings.logo_url);
    } catch (err) {
      console.warn("Error loading company logo in structure report:", err);
    }
  }

  // --- 1. LEFT BOX: CONTRACTOR (White Background + Border) ---
  doc.setFillColor(255, 255, 255);
  doc.rect(x1, headerY, col1W, headerH, "F");
  doc.setDrawColor(...headerBorderColor);
  doc.setLineWidth(headerLineWidth);
  doc.rect(x1, headerY, col1W, headerH, "S");

  if (contractorLogoData) {
    drawLogo(doc, contractorLogoData, 48, 20, x1 + (col1W - 48) / 2, headerY + (headerH - 20) / 2, 'center', 'center');
  }

  // --- 2. MIDDLE BOX: REPORT TITLE (Navy/White + Border) ---
  if (isPrintFriendly) {
    doc.setFillColor(255, 255, 255);
  } else {
    doc.setFillColor(...headerBlue);
  }
  doc.rect(x2, headerY, col2W, headerH, "F");
  doc.setDrawColor(...headerBorderColor);
  doc.setLineWidth(headerLineWidth);
  doc.rect(x2, headerY, col2W, headerH, "S");

  const titleCenterX = x2 + col2W / 2;

  const companyName = companySettings?.company_name || "Petronas Carigali Sdn Bhd (SKA)";
  const deptName = companySettings?.department_name || (companySettings as any)?.departmentName || "Technical Services Department";

  // Line 1: Company Name (bold, size 8)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...titleTextColor);
  const compLines = doc.splitTextToSize(companyName, col2W - 8);
  doc.text(compLines[0] || companyName, titleCenterX, headerY + 4.5, { align: "center" });

  // Line 2: Department Name (no bold, size 8)
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...titleSubTextColor);
  const deptLines = doc.splitTextToSize(deptName, col2W - 8);
  doc.text(deptLines[0] || deptName, titleCenterX, headerY + 8.8, { align: "center" });

  // Line 3: Report Title (bold, size 8)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...titleTextColor);
  const titleLines = doc.splitTextToSize(reportTitle, col2W - 8);
  doc.text(titleLines[0] || reportTitle, titleCenterX, headerY + 13.2, { align: "center" });

  // Line 4: Report No (no bold, size 8)
  const rawReportNo = reportNo || (config ? `${config.reportNoPrefix}-${config.reportYear}` : (companySettings?.serial_no ? `${companySettings.serial_no}` : ""));
  const reportNoStr = rawReportNo
    ? (rawReportNo.toLowerCase().startsWith("report no") ? rawReportNo : `Report No: ${rawReportNo}`)
    : "Report No: N/A";
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...titleSubTextColor);
  doc.text(reportNoStr, titleCenterX, headerY + 17.6, { align: "center" });

  // Line 5: Platform Name / Structure Name (bold, size 8)
  if (structureName) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...titleTextColor);
    const structLines = doc.splitTextToSize(structureName, col2W - 8);
    doc.text(structLines[0] || "", titleCenterX, headerY + 22.2, { align: "center" });
  }

  // --- 3. RIGHT BOX: CLIENT (White Background + Border) ---
  doc.setFillColor(255, 255, 255);
  doc.rect(x3, headerY, col3W, headerH, "F");
  doc.setDrawColor(...headerBorderColor);
  doc.setLineWidth(headerLineWidth);
  doc.rect(x3, headerY, col3W, headerH, "S");

  if (clientLogoData) {
    drawLogo(doc, clientLogoData, 48, 20, x3 + (col3W - 48) / 2, headerY + (headerH - 20) / 2, 'center', 'center');
  }

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
};

export const generateStructureReport = async (
  structure: StructureData,
  companySettings?: CompanySettings,
  config?: ReportConfig
) => {
  // Route to appropriate template based on structure type
  if (structure.str_type === "PIPELINE") {
    return generatePipelineReport(structure, companySettings, config);
  } else {
    return generatePlatformReport(structure, companySettings, config);
  }
};

const generatePipelineReport = async (
  structure: StructureData,
  companySettings?: CompanySettings,
  config?: ReportConfig
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ... (Header and content generation logic remains same) ...
  // I will skip replacing the entire body and focus on the interface and return.

  // This tool replaces a block. I must cover the interface definition at least.
  // But wait, the interface is at line 82. The function ends at ~390. This is too large a block if I don't want to re-paste everything.

  // I will split this into two edits.
  // 1. Update Interface.
  // 2. Update return statement of generatePipelineReport.


  // Colors
  const headerBlue: [number, number, number] = [7, 78, 136];
  const sectionBlue: [number, number, number] = [7, 78, 136];
  // Used by the print-friendly footer below (kept from dev-jitesh)
  const navy: [number, number, number] = [7, 78, 136];
  const isPrintFriendly = config?.printFriendly === true;

  // ===== HEADER (3 SECTIONS: Contractor Logo | Middle Info | Client Logo) =====
  await draw3SectionHeader(doc, {
    pageWidth,
    companySettings,
    config,
    reportTitle: "Pipeline Specifications Report",
    structureName: structure.str_name || structure.title || undefined,
    isPrintFriendly,
    headerBlue,
  });

  let yPos = 35;

  // Define autoTable helper for jsPDF
  const autoTable = (doc as any).autoTable || autoTablePlugin;

  // Helper to draw section header bar (print-friendly aware)
  const drawSectionBar = (x: number, y: number, w: number, h: number, text: string, textX: number, textY: number) => {
    if (isPrintFriendly) {
      doc.setFillColor(240, 240, 240);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.rect(x, y, w, h, "FD");
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setFillColor(sectionBlue[0], sectionBlue[1], sectionBlue[2]);
      doc.rect(x, y, w, h, "F");
      doc.setTextColor(255, 255, 255);
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(text, textX, textY);
  };

  // Helper function for compact field rendering
  const drawCompactField = (label: string, value: any, x: number, y: number, width: number) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(label, x + 1, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const valX = x + (width * 0.42);
    const valueStr = value != null ? String(value) : "N/A";
    doc.text(valueStr, valX, y + 3);

    doc.setDrawColor(230, 230, 230);
    doc.line(x, y + 4.5, x + width, y + 4.5);

    return y + 5;
  };

  // ===== THREE COLUMN LAYOUT =====
  const col1X = 10;
  const col2X = 75;
  const col3X = 140;
  const colWidth = 60;

  // COLUMN 1: General Info
  drawSectionBar(col1X, yPos, colWidth, 5, "GENERAL INFO", col1X + 2, yPos + 3.5);

  let col1Y = yPos + 5;
  doc.setDrawColor(200, 200, 200);
  const genStart = col1Y;

  col1Y = drawCompactField("Pipeline:", structure.str_name || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Title:", structure.title || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Field:", structure.pfield || structure.field_name || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Install Date:", structure.inst_date || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Description:", (structure.description || "N/A").substring(0, 30), col1X, col1Y, colWidth);

  doc.rect(col1X, genStart, colWidth, col1Y - genStart);

  // COLUMN 2: Technical Parameters
  drawSectionBar(col2X, yPos, colWidth, 5, "TECHNICAL PARAMS", col2X + 2, yPos + 3.5);

  let col2Y = yPos + 5;
  const techStart = col2Y;

  col2Y = drawCompactField("Outer Dia:", (structure as any).od ? `${(structure as any).od} in` : "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Wall Thick:", (structure as any).wall_thickness ? `${(structure as any).wall_thickness} mm` : "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Total Length:", (structure as any).plength ? `${(structure as any).plength} m` : "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Material:", structure.material || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("CP System:", structure.cp_system || "N/A", col2X, col2Y, colWidth);

  doc.rect(col2X, techStart, colWidth, col2Y - techStart);

  // COLUMN 3: Location & Path
  drawSectionBar(col3X, yPos, colWidth, 5, "LOCATION & PATH", col3X + 2, yPos + 3.5);

  let col3Y = yPos + 5;
  const locStart = col3Y;

  col3Y = drawCompactField("From Platform:", (structure as any).from_plat || "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("To Platform:", (structure as any).to_plat || "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("Start North:", (structure as any).start_northing ? `${(structure as any).start_northing} m` : "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("Start East:", (structure as any).start_easting ? `${(structure as any).start_easting} m` : "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("End North:", (structure as any).end_northing ? `${(structure as any).end_northing} m` : "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("End East:", (structure as any).end_easting ? `${(structure as any).end_easting} m` : "N/A", col3X, col3Y, colWidth);

  doc.rect(col3X, locStart, colWidth, col3Y - locStart);

  yPos = Math.max(col1Y, col2Y, col3Y) + 3;

  // ===== BURIAL & PROTECTION (Full Width) =====
  drawSectionBar(10, yPos, pageWidth - 20, 5, "BURIAL & PROTECTION", 12, yPos + 3.5);
  yPos += 5;

  const burialStart = yPos;
  const burialWidth = pageWidth - 20; // Full width

  yPos = drawCompactField("Burial Status:", (structure as any).burial_status || "N/A", 10, yPos, burialWidth);
  yPos = drawCompactField("Protection Method:", (structure as any).protection_method || "N/A", 10, yPos, burialWidth);
  yPos = drawCompactField("Coating:", structure.corr_ctg || "N/A", 10, yPos, burialWidth);

  doc.rect(10, burialStart, pageWidth - 20, yPos - burialStart);
  yPos += 3;

  // ===== GEODETIC PARAMETERS (Full Width) =====
  drawSectionBar(10, yPos, pageWidth - 20, 5, "GEODETIC PARAMETERS", 12, yPos + 3.5);
  yPos += 5;

  const geoStart = yPos;
  const geoGap = 5;
  const geoWidth = (pageWidth - 20 - geoGap) / 2;

  // Column 1
  col1Y = yPos;
  col1Y = drawCompactField("Project Name:", (structure as any).project_name || "N/A", 10, col1Y, geoWidth);
  col1Y = drawCompactField("Unit:", (structure as any).unit || (structure as any).unit_system || "N/A", 10, col1Y, geoWidth);
  col1Y = drawCompactField("Datum:", (structure as any).datum || "N/A", 10, col1Y, geoWidth);
  col1Y = drawCompactField("Ellipsoid:", (structure as any).ellipsoid || (structure as any).spheroid || "N/A", 10, col1Y, geoWidth);

  // Column 2
  col2Y = yPos;
  const geoCol2X = 10 + geoWidth + geoGap;
  col2Y = drawCompactField("Datum Shift:", (structure as any).datum_shift || "N/A", geoCol2X, col2Y, geoWidth);
  col2Y = drawCompactField("Dx:", (structure as any).dx || "N/A", geoCol2X, col2Y, geoWidth);
  col2Y = drawCompactField("Dy:", (structure as any).dy || "N/A", geoCol2X, col2Y, geoWidth);
  col2Y = drawCompactField("Dz:", (structure as any).dz || "N/A", geoCol2X, col2Y, geoWidth);

  yPos = Math.max(col1Y, col2Y);

  // Draw outer box
  doc.rect(10, geoStart, pageWidth - 20, yPos - geoStart);

  // Draw vertical divider
  doc.line(10 + geoWidth + (geoGap / 2), geoStart, 10 + geoWidth + (geoGap / 2), yPos);

  yPos += 3;

  // ===== DISCUSSIONS / COMMENTS =====
  const pipeDiscussions = (structure.discussions || []).filter((d) => !d.is_deleted);
  if (pipeDiscussions.length > 0) {
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = 15; }

    drawSectionBar(10, yPos, pageWidth - 20, 5, `COMMENTS (${pipeDiscussions.length})`, 12, yPos + 3.5);
    yPos += 9;

    // Sort discussions by created_at ascending
    const sortedPipeDiscussions = [...pipeDiscussions].sort((a: any, b: any) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

    for (const disc of sortedPipeDiscussions) {
      // Check if we need a new page
      if (yPos > pageHeight - 25) {
        doc.addPage();
        yPos = 15;
        drawSectionBar(10, yPos, pageWidth - 20, 5, `COMMENTS (continued)`, 12, yPos + 3.5);
        yPos += 9;
      }

      // Format date
      const createdAt = disc.created_at ? new Date(disc.created_at) : null;
      const dateStr = createdAt
        ? createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "Unknown Date";

      // Posted by user
      const userName = disc.user_name || disc.user_id || "Unknown";

      // Date & user line (small font, gray)
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text(`${dateStr}  \u2014  ${userName}`, 12, yPos);
      yPos += 3;

      // Comment text
      const commentText = disc.text || disc.content || disc.message || "";
      if (commentText) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        const textLines = doc.splitTextToSize(commentText, pageWidth - 28);
        const linesToRender = textLines.slice(0, 6); // Cap at 6 lines per comment
        doc.text(linesToRender, 12, yPos);
        yPos += linesToRender.length * 3;
      }

      // Separator line between comments
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(12, yPos, pageWidth - 12, yPos);
      yPos += 3;
    }

    yPos += 2;
  } else if ((structure.comments || structure.description) && yPos < pageHeight - 20) {
    // Fallback: legacy single comment field
    drawSectionBar(10, yPos, pageWidth - 20, 4, "COMMENTS", 12, yPos + 3);

    yPos += 4;
    const commentText = structure.comments || structure.description || "";
    const textLines = doc.splitTextToSize(commentText, pageWidth - 26);
    const boxHeight = Math.min(15, textLines.length * 3 + 4);

    doc.setDrawColor(200, 200, 200);
    doc.rect(10, yPos, pageWidth - 20, boxHeight);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(6);
    doc.text(textLines.slice(0, 4), 12, yPos + 3);
  }

  // ===== SIGNATURES =====
  if (config?.showSignatures !== false) {
    const hasSignatures = config?.preparedBy?.name || config?.reviewedBy?.name || config?.approvedBy?.name;
    if (hasSignatures) {
      let sigY = pageHeight - 38;
      if (yPos > sigY - 10) {
        doc.addPage();
        sigY = pageHeight - 38;
      }
      const sigWidth = (pageWidth - 20) / 3;
      const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
        doc.setDrawColor(...navy);
        doc.setLineWidth(0.1);
        doc.rect(lx, sigY, sigWidth - 4, 18);
        if (!isPrintFriendly) {
          doc.setFillColor(...navy);
          doc.rect(lx, sigY, sigWidth - 4, 4.5, "F");
          doc.setTextColor(255);
        } else {
          doc.setTextColor(...navy);
        }
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(label, lx + 2, sigY + 3.5);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("Name:", lx + 2, sigY + 10);
        if (person?.name) doc.text(person.name, lx + 14, sigY + 10);
        doc.text("Date:", lx + 2, sigY + 13.5);
        if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 13.5);
        doc.text("Signature:", lx + 2, sigY + 17);
      };

      drawSig("PREPARED BY", 10, config?.preparedBy);
      drawSig("REVIEWED BY", 10 + sigWidth, config?.reviewedBy);
      drawSig("APPROVED BY", 10 + (sigWidth * 2), config?.approvedBy);
    }
  }

  // ===== FOOTERS (ALL PAGES) =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);
    doc.text(REPORT_FOOTER_APP_TEXT, 10, pageHeight - 6);
    if (config?.showPageNumbers !== false) {
      doc.text(`Page ${i}`, pageWidth - 10, pageHeight - 6, { align: "right" });
    }
  }

  applyWatermarkAndSignaturesGlobal(doc, config);

  if (config?.returnBlob) {
    return doc.output('blob');
  } else {
    doc.save(`Pipeline_Report_${structure.str_id}.pdf`);
  }
};



const generatePlatformReport = async (
  structure: StructureData,
  companySettings?: CompanySettings,
  config?: ReportConfig
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Colors
  const headerBlue: [number, number, number] = [7, 78, 136];
  const sectionBlue: [number, number, number] = [7, 78, 136];
  // Used by the print-friendly footer below (kept from dev-jitesh)
  const navy: [number, number, number] = [7, 78, 136];
  const isPrintFriendly = config?.printFriendly === true;

  // ===== HEADER (3 SECTIONS: Contractor Logo | Middle Info | Client Logo) =====
  await draw3SectionHeader(doc, {
    pageWidth,
    companySettings,
    config,
    reportTitle: "Platform Specifications Report",
    structureName: structure.str_name || structure.title || undefined,
    isPrintFriendly,
    headerBlue,
  });

  let yPos = 35;

  // Define autoTable helper for jsPDF
  const autoTable = (doc as any).autoTable || autoTablePlugin;

  // Helper to draw section header bar (print-friendly aware)
  const drawSectionBar = (x: number, y: number, w: number, h: number, text: string, textX: number, textY: number) => {
    if (isPrintFriendly) {
      doc.setFillColor(240, 240, 240);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.rect(x, y, w, h, "FD");
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setFillColor(sectionBlue[0], sectionBlue[1], sectionBlue[2]);
      doc.rect(x, y, w, h, "F");
      doc.setTextColor(255, 255, 255);
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(text, textX, textY);
  };

  // Helper function for compact field rendering
  const drawCompactField = (label: string, value: string, x: number, y: number, width: number) => {
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(label, x + 1, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const labelW = doc.getTextWidth(label);
    const valX = Math.max(x + (width * 0.44), x + labelW + 2);
    doc.text(value, valX, y + 3);

    doc.setDrawColor(230, 230, 230);
    doc.line(x, y + 4.5, x + width, y + 4.5);

    return y + 5;
  };

  // ===== THREE COLUMN LAYOUT FOR COMPACTNESS =====
  const col1X = 10;
  const col2X = 75;
  const col3X = 140;
  const colWidth = 60;

  // COLUMN 1: General Info
  drawSectionBar(col1X, yPos, colWidth, 5, "GENERAL INFO", col1X + 2, yPos + 3.5);

  let col1Y = yPos + 5;
  doc.setDrawColor(200, 200, 200);
  const genStart = col1Y;

  col1Y = drawCompactField("Title:", structure.title || structure.str_name || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Field:", structure.pfield || structure.field_name || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Install Date:", formatDisplayDate(structure.inst_date), col1X, col1Y, colWidth);
  col1Y = drawCompactField("Depth:", (structure.depth !== undefined && structure.depth !== null && String(structure.depth).trim() !== "") ? `${structure.depth} m` : "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Design Life:", (structure.desg_life !== undefined && structure.desg_life !== null && String(structure.desg_life).trim() !== "") ? `${structure.desg_life} yrs` : "N/A", col1X, col1Y, colWidth);

  doc.rect(col1X, genStart, colWidth, col1Y - genStart);

  // COLUMN 2: Configuration
  drawSectionBar(col2X, yPos, colWidth, 5, "CONFIGURATION", col2X + 2, yPos + 3.5);

  let col2Y = yPos + 5;
  const configStart = col2Y;

  col2Y = drawCompactField("Type:", structure.ptype || structure.str_type || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Function:", structure.function || structure.process || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Material:", structure.material || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("CP System:", structure.cp_system || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Corrosion Coating:", structure.corr_ctg || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Contractor:", structure.inst_contractor || structure.inst_ctr || "N/A", col2X, col2Y, colWidth);

  doc.rect(col2X, configStart, colWidth, col2Y - configStart);

  // COLUMN 3: Location & Dimensions
  drawSectionBar(col3X, yPos, colWidth, 5, "LOCATION & DIMENSION", col3X + 2, yPos + 3.5);

  let col3Y = yPos + 5;
  const locStart = col3Y;

  const northingVal = (structure.northing !== undefined && structure.northing !== null && String(structure.northing).trim() !== "") ? `${structure.northing} m` : (structure.st_north !== undefined && structure.st_north !== null && String(structure.st_north).trim() !== "" ? `${structure.st_north} m` : "N/A");
  const eastingVal = (structure.easting !== undefined && structure.easting !== null && String(structure.easting).trim() !== "") ? `${structure.easting} m` : (structure.st_east !== undefined && structure.st_east !== null && String(structure.st_east).trim() !== "" ? `${structure.st_east} m` : "N/A");
  const northAngleVal = (structure.true_north_angle !== undefined && structure.true_north_angle !== null && String(structure.true_north_angle).trim() !== "") ? `${structure.true_north_angle}°` : (structure.north_angle !== undefined && structure.north_angle !== null && String(structure.north_angle).trim() !== "" ? `${structure.north_angle}°` : "N/A");
  const maxLegDiaVal = (structure.max_leg_dia !== undefined && structure.max_leg_dia !== null && String(structure.max_leg_dia).trim() !== "") ? `${structure.max_leg_dia} mm` : (structure.dleg !== undefined && structure.dleg !== null && String(structure.dleg).trim() !== "" ? `${structure.dleg} mm` : "N/A");
  const maxWallThkVal = (structure.max_wall_thk !== undefined && structure.max_wall_thk !== null && String(structure.max_wall_thk).trim() !== "") ? `${structure.max_wall_thk} mm` : (structure.wall_thk !== undefined && structure.wall_thk !== null && String(structure.wall_thk).trim() !== "" ? `${structure.wall_thk} mm` : "N/A");
  const isHelipad = structure.helipad === "YES" || structure.helipad === "Yes" || structure.helipad === "1" || structure.helipad === true;

  col3Y = drawCompactField("Northing:", northingVal, col3X, col3Y, colWidth);
  col3Y = drawCompactField("Easting:", eastingVal, col3X, col3Y, colWidth);
  col3Y = drawCompactField("True North:", northAngleVal, col3X, col3Y, colWidth);
  col3Y = drawCompactField("Max Leg Dia:", maxLegDiaVal, col3X, col3Y, colWidth);
  col3Y = drawCompactField("Max Wall:", maxWallThkVal, col3X, col3Y, colWidth);
  col3Y = drawCompactField("Helipad:", isHelipad ? "Yes" : "No", col3X, col3Y, colWidth);

  doc.rect(col3X, locStart, colWidth, col3Y - locStart);

  yPos = Math.max(col1Y, col2Y, col3Y) + 5;

  // ===== STRUCTURE VISUALS =====
  interface VisualItem {
    id?: number | string;
    url: string;
    title: string;
    path?: string;
  }

  const formatCleanTitle = (raw: string): string => {
    if (!raw) return "Structure Visual";
    let str = String(raw).trim();
    const isFileOrUrl = str.includes("/") || str.includes("\\") || /\.(png|jpe?g|webp|gif|bmp|tiff|svg)$/i.test(str);
    if (str.includes("/") || str.includes("\\")) {
      str = str.split(/[/\\]/).pop() || str;
    }
    try {
      str = decodeURIComponent(str);
    } catch {}
    // Strip file extensions (.png, .jpg, etc.)
    str = str.replace(/\.(png|jpe?g|webp|gif|bmp|tiff|svg)$/i, "");
    // Strip UUID or timestamp prefixes
    str = str.replace(/^[0-9a-fA-F-]{32,36}_?/, "");
    str = str.replace(/^\d{10,14}_?/, "");
    
    // If it was a filename, clean underscores and hyphens between words
    if (isFileOrUrl) {
      str = str.replace(/[_]/g, " ");
      if (/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)+$/.test(str)) {
        str = str.replace(/-/g, " ");
      }
    }
    return str.trim() || "Structure Visual";
  };

  // Helper: check if an attachment looks like an image file
  const isImageAttachment = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    const meta = typeof item.meta === 'string' ? (() => { try { return JSON.parse(item.meta); } catch { return {}; } })() : (item.meta || {});
    const fileType = String(meta?.file_type || item.file_type || "").toLowerCase();
    if (fileType.startsWith("image/")) return true;
    const filePath = String(meta?.file_path || meta?.file_url || item.path || item.file_url || item.name || "").toLowerCase();
    return /\.(jpg|jpeg|png|webp|gif|bmp|tiff|svg)(\?.*)?$/i.test(filePath);
  };

  // Collect visuals — structure.visuals and structure.photos are the SAME array from the API,
  // so only iterate structure.visuals to avoid duplicates.
  const rawVisuals: VisualItem[] = [];
  const seenIds = new Set<string>();

  const addVisualItem = (item: any) => {
    if (!item || typeof item !== 'object') return;
    // Skip non-image attachments
    if (!isImageAttachment(item)) return;
    // Deduplicate by attachment id
    const itemId = String(item.id || "");
    if (itemId && seenIds.has(itemId)) return;
    if (itemId) seenIds.add(itemId);

    let metaObj = item.meta;
    if (typeof metaObj === 'string') {
      try { metaObj = JSON.parse(metaObj); } catch {}
    }

    // Build the URL — PRIORITIZE proxy_url (server-side, no CORS) over direct Supabase URL
    let url = "";
    if (item.id) {
      url = `/api/attachment/url?id=${item.id}`;
    } else if (item.proxy_url) {
      url = item.proxy_url;
    } else {
      const directUrl = metaObj?.file_url || item.file_url || item.url || item.path || "";
      url = directUrl;
    }
    if (!url || typeof url !== 'string' || !url.trim()) return;

    // Resolve title
    const explicitTitle = metaObj?.title || item.title;
    let title = "";
    if (explicitTitle && String(explicitTitle).trim().length > 0) {
      title = String(explicitTitle).trim();
    } else {
      const rawTitle = item.name || metaObj?.name || item.description || metaObj?.description || metaObj?.original_file_name || item.file_name || metaObj?.file_name || "Structure Visual";
      title = formatCleanTitle(rawTitle);
    }

    rawVisuals.push({ id: item.id, url: url.trim(), title, path: item.path || metaObj?.file_path });
  };

  // Only iterate structure.visuals (structure.photos is the same array from the API — don't double-count)
  if (Array.isArray(structure.visuals)) {
    structure.visuals.forEach((v: any) => addVisualItem(v));
  }
  // Fallback: if visuals was empty, try photos/images/attachments
  if (rawVisuals.length === 0 && Array.isArray(structure.photos)) {
    structure.photos.forEach((p: any) => addVisualItem(p));
  }
  if (rawVisuals.length === 0 && Array.isArray(structure.images)) {
    structure.images.forEach((i: any) => addVisualItem(i));
  }
  if (rawVisuals.length === 0 && Array.isArray((structure as any).attachments)) {
    (structure as any).attachments.forEach((a: any) => addVisualItem(a));
  }
  // photo_url string fallback
  if (rawVisuals.length === 0 && structure.photo_url && typeof structure.photo_url === 'string') {
    const url = getPublicStorageUrl(structure.photo_url);
    if (url) rawVisuals.push({ url, title: structure.title || structure.str_name || "Platform Overview" });
  }

  const uniquePhotos = rawVisuals;

  if (uniquePhotos.length > 0) {
    const page1Photos = uniquePhotos.slice(0, 4);
    const count = page1Photos.length;
    drawSectionBar(10, yPos, pageWidth - 20, 5, `STRUCTURE VISUALS (${uniquePhotos.length})`, 12, yPos + 3.5);
    yPos += 5;

    const gap = count === 4 ? 3.5 : 5;
    const totalWidth = pageWidth - 20;
    const imgWidth = (totalWidth - (gap * (count - 1))) / count;
    const imgHeight = count === 4 ? 50 : (count === 3 ? 54 : 58);

    let currentX = 10;
    const padding = 1; // Inner padding for border

    // Load images SEQUENTIALLY through the /api/attachment/url proxy to avoid CORS and rate-limiting
    const loadedImages: (string | null)[] = [];
    for (const p of page1Photos) {
      try {
        const imgData = await loadImage(p.url, p.id);
        loadedImages.push(imgData);
      } catch (e) {
        console.error(`[StructureReport] Failed to load image id=${p.id} url=${p.url}`, e);
        loadedImages.push(null);
      }
    }

    try {
      loadedImages.forEach((imgData, idx) => {
        const photoItem = page1Photos[idx];

        // Draw border container
        doc.setDrawColor(200, 200, 200);
        doc.rect(currentX, yPos, imgWidth, imgHeight);

        if (imgData) {
          try {
            // Add image with slight padding inside the box
            doc.addImage(imgData, 'JPEG', currentX + padding, yPos + padding, imgWidth - (padding * 2), imgHeight - (padding * 2));
          } catch (e) {
            console.error("Error adding PDF image", e);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6);
            doc.setTextColor(150, 150, 150);
            doc.text("Error", currentX + 5, yPos + 10);
          }
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(150, 150, 150);
          doc.text("No Img", currentX + 5, yPos + 10);
        }

        // Semi-transparent Title Overlay over the photo (bottom bar)
        if (photoItem && photoItem.title) {
          const bannerH = count === 4 ? 5.5 : 6;
          const bannerY = yPos + imgHeight - bannerH - padding;
          const bannerX = currentX + padding;
          const bannerW = imgWidth - (padding * 2);

          doc.saveGraphicsState();
          try {
            if ((doc as any).GState) {
              doc.setGState(new (doc as any).GState({ opacity: 0.65 }));
            }
            doc.setFillColor(15, 23, 42); // slate-900 semi-transparent dark
            doc.rect(bannerX, bannerY, bannerW, bannerH, 'F');
          } finally {
            doc.restoreGraphicsState();
          }

          // Overlay Title Text
          doc.setFont("helvetica", "bold");
          doc.setFontSize(count === 4 ? 5.5 : 6.5);
          doc.setTextColor(255, 255, 255);

          const maxTextW = bannerW - 3;
          let displayTitle = photoItem.title;
          if (doc.getTextWidth(displayTitle) > maxTextW) {
            while (displayTitle.length > 3 && doc.getTextWidth(displayTitle + "...") > maxTextW) {
              displayTitle = displayTitle.slice(0, -1);
            }
            displayTitle += "...";
          }

          doc.text(displayTitle, bannerX + bannerW / 2, bannerY + (count === 4 ? 3.8 : 4.2), { align: "center" });
        }

        currentX += imgWidth + gap;
      });

      yPos += imgHeight + 5;

    } catch (err) {
      console.error("Critical error in image section", err);
      yPos += 10;
    }
  }

  // ===== INVENTORY STATISTICS (Full Width, Compact Grid) =====
  drawSectionBar(10, yPos, pageWidth - 20, 5, "INVENTORY STATISTICS", 12, yPos + 3.5);
  yPos += 5;

  // Create compact inventory grid (5 columns x 2 rows)
  const invCols = 5;
  const invColWidth = (pageWidth - 20) / invCols;
  const inventoryItems = [
    ["Conductors", structure.conductors || 0],
    ["Int. Piles", structure.internal_piles || 0],
    ["Slots", structure.slots || "N/A"],
    ["Fenders", structure.fenders || 0],
    ["Risers", structure.risers || 0],
    ["Sumps", structure.sumps || 0],
    ["Skirt Piles", structure.skirt_piles || 0],
    ["Caissons", structure.caissons || 0],
    ["Anodes", structure.anodes || 0],
    ["Cranes", structure.cranes || 0]
  ];

  doc.setDrawColor(200, 200, 200);
  const invRowHeight = 10;
  doc.rect(10, yPos, pageWidth - 20, invRowHeight * 2);

  inventoryItems.forEach((item, idx) => {
    const row = Math.floor(idx / invCols);
    const col = idx % invCols;
    const x = 10 + (col * invColWidth);
    const y = yPos + (row * invRowHeight);

    // Vertical dividers
    if (col > 0) {
      doc.line(x, y, x, y + invRowHeight);
    }
    // Horizontal divider
    if (row > 0) {
      doc.line(10, y, pageWidth - 10, y);
    }

    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(item[0] as string, x + invColWidth / 2, y + 3.5, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(sectionBlue[0], sectionBlue[1], sectionBlue[2]);
    doc.text(String(item[1]), x + invColWidth / 2, y + 8, { align: "center" });
  });

  yPos += (invRowHeight * 2) + 3;

  // ===== LEGS CONFIGURATION (if available) =====
  if (structure.legs && structure.legs.length > 0) {
    if (yPos > pageHeight - 30) { doc.addPage(); yPos = 15; }

    drawSectionBar(10, yPos, pageWidth - 20, 5, `PLATFORM LEGS (${structure.legs.length} Active)`, 12, yPos + 3.5);
    yPos += 5;

    // Display legs with auto and uniform column spacing across full width
    const totalLegs = Math.min(structure.legs.length, 30);
    const numRows = Math.ceil(totalLegs / 10);
    const colsPerRow = Math.ceil(totalLegs / numRows);
    const legColWidth = (pageWidth - 20) / colsPerRow;
    const legRowHeight = 9;

    doc.setDrawColor(200, 200, 200);
    doc.rect(10, yPos, pageWidth - 20, numRows * legRowHeight);

    structure.legs.slice(0, totalLegs).forEach((leg: any, idx: number) => {
      const row = Math.floor(idx / colsPerRow);
      const col = idx % colsPerRow;
      const x = 10 + (col * legColWidth);
      const y = yPos + (row * legRowHeight);

      if (col > 0) doc.line(x, y, x, y + legRowHeight);
      if (row > 0) doc.line(10, y, pageWidth - 10, y);

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Leg ${idx + 1}`, x + legColWidth / 2, y + 3.2, { align: "center" });
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(leg.leg_name || leg.designation || `L${idx + 1}`, x + legColWidth / 2, y + 7.2, { align: "center" });
    });

    yPos += (numRows * legRowHeight) + 3;
  }

  // ===== ELEVATIONS & LEVELS TABLES (Side-by-side) =====
  const hasElevations = structure.elevations && structure.elevations.length > 0;
  const hasLevels = structure.levels && structure.levels.length > 0;

  if (hasElevations || hasLevels) {
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = 15; }

    const tablesStartY = yPos;
    let maxTableY = yPos;

    // ELEVATIONS TABLE (Left)
    if (hasElevations) {
      const elevWidth = (pageWidth - 25) / 2;
      autoTable(doc, {
        startY: tablesStartY,
        head: [
          [{
            content: 'ELEVATIONS (m)',
            colSpan: 2,
            styles: {
              halign: 'left',
              fontStyle: 'bold',
              fontSize: 8,
              fillColor: isPrintFriendly ? [240, 240, 240] : sectionBlue,
              textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
              cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
            }
          }],
          ['Type', 'Value (m)']
        ],
        body: (structure.elevations || []).slice(0, 6).map((elev: any) => [
          elev.orient || elev.name || elev.type || "Elevation",
          elev.elv || elev.value || elev.elevation || "N/A"
        ]),
        theme: 'grid',
        styles: {
          lineWidth: 0.2,
          lineColor: [200, 200, 200],
          cellPadding: 1.5,
          valign: 'middle',
        },
        headStyles: {
          fillColor: isPrintFriendly ? [240, 240, 240] : sectionBlue,
          textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
          fontSize: 7,
          halign: 'center',
          fontStyle: 'bold',
          lineWidth: 0.2,
          lineColor: [200, 200, 200],
        },
        bodyStyles: {
          fontSize: 6.5,
          halign: 'center',
          textColor: [0, 0, 0],
          lineWidth: 0.2,
          lineColor: [200, 200, 200],
        },
        margin: { left: 10 },
        tableWidth: elevWidth,
      });
      maxTableY = Math.max(maxTableY, (doc as any).lastAutoTable.finalY);
    }

    // LEVELS TABLE (Right)
    if (hasLevels) {
      // Start slightly right of center (pageWidth/2 + 2.5) to create 5mm gap
      const rightTableX = pageWidth / 2 + 2.5;
      const levelsWidth = (pageWidth - 25) / 2;

      autoTable(doc, {
        startY: tablesStartY,
        head: [
          [{
            content: 'PLATFORM LEVELS',
            colSpan: 3,
            styles: {
              halign: 'left',
              fontStyle: 'bold',
              fontSize: 8,
              fillColor: isPrintFriendly ? [240, 240, 240] : sectionBlue,
              textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
              cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
            }
          }],
          ['Level', 'Start', 'End']
        ],
        body: (structure.levels || []).slice(0, 6).map((level: any) => [
          level.level_name || "Level",
          level.elv_from || level.start_elv || 0,
          level.elv_to || level.end_elv || 0
        ]),
        theme: 'grid',
        styles: {
          lineWidth: 0.2,
          lineColor: [200, 200, 200],
          cellPadding: 1.5,
          valign: 'middle',
        },
        headStyles: {
          fillColor: isPrintFriendly ? [240, 240, 240] : sectionBlue,
          textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
          fontSize: 7,
          halign: 'center',
          fontStyle: 'bold',
          lineWidth: 0.2,
          lineColor: [200, 200, 200],
        },
        bodyStyles: {
          fontSize: 6.5,
          halign: 'center',
          textColor: [0, 0, 0],
          lineWidth: 0.2,
          lineColor: [200, 200, 200],
        },
        margin: { left: rightTableX },
        tableWidth: levelsWidth,
      });
      maxTableY = Math.max(maxTableY, (doc as any).lastAutoTable.finalY);
    }
    yPos = maxTableY + 3;
  }

  // ===== FACES (if available) =====
  if (structure.faces && structure.faces.length > 0) {
    if (yPos > pageHeight - 30) { doc.addPage(); yPos = 15; }

    autoTable(doc, {
      startY: yPos,
      head: [
        [{
          content: 'PLATFORM FACES',
          colSpan: 3,
          styles: {
            halign: 'left',
            fontStyle: 'bold',
            fontSize: 8,
            fillColor: isPrintFriendly ? [240, 240, 240] : sectionBlue,
            textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
            cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
          }
        }],
        ['Face Name', 'From', 'To']
      ],
      body: structure.faces.slice(0, 4).map((face: any) => [
        face.face || face.face_name || face.name || "Face",
        face.face_from || face.from || "N/A",
        face.face_to || face.to || "N/A"
      ]),
      theme: 'grid',
      styles: {
        lineWidth: 0.2,
        lineColor: [200, 200, 200],
        cellPadding: 1.5,
        valign: 'middle',
      },
      headStyles: {
        fillColor: isPrintFriendly ? [240, 240, 240] : sectionBlue,
        textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
        fontSize: 7,
        halign: 'center',
        fontStyle: 'bold',
        lineWidth: 0.2,
        lineColor: [200, 200, 200],
      },
      bodyStyles: {
        fontSize: 6.5,
        halign: 'center',
        textColor: [0, 0, 0],
        lineWidth: 0.2,
        lineColor: [200, 200, 200],
      },
      margin: { left: 10, right: 10 },
      tableWidth: pageWidth - 20,
    });

    yPos = (doc as any).lastAutoTable.finalY + 3;
  }

  // ===== DISCUSSIONS / COMMENTS =====
  const discussions = (structure.discussions || []).filter((d) => !d.is_deleted);
  if (discussions.length > 0) {
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = 15; }

    drawSectionBar(10, yPos, pageWidth - 20, 5, `COMMENTS (${discussions.length})`, 12, yPos + 3.5);
    yPos += 9;

    // Sort discussions by created_at ascending
    const sortedDiscussions = [...discussions].sort((a: any, b: any) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

    for (const disc of sortedDiscussions) {
      // Check if we need a new page
      if (yPos > pageHeight - 25) {
        doc.addPage();
        yPos = 15;
        drawSectionBar(10, yPos, pageWidth - 20, 5, `COMMENTS (continued)`, 12, yPos + 3.5);
        yPos += 9;
      }

      // Format date
      const createdAt = disc.created_at ? new Date(disc.created_at) : null;
      const dateStr = createdAt
        ? createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "Unknown Date";

      // Posted by user
      const userName = disc.user_name || disc.user_id || "Unknown";

      // Date & user line (small font, gray)
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text(`${dateStr}  \u2014  ${userName}`, 12, yPos);
      yPos += 3;

      // Comment text
      const commentText = disc.text || disc.content || disc.message || "";
      if (commentText) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        const textLines = doc.splitTextToSize(commentText, pageWidth - 28);
        const linesToRender = textLines.slice(0, 6); // Cap at 6 lines per comment
        doc.text(linesToRender, 12, yPos);
        yPos += linesToRender.length * 3;
      }

      // Separator line between comments
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(12, yPos, pageWidth - 12, yPos);
      yPos += 3;
    }

    yPos += 2;
  } else if ((structure.comments || structure.description) && yPos < pageHeight - 30) {
    // Fallback: legacy single comment field
    drawSectionBar(10, yPos, pageWidth - 20, 4, "COMMENTS", 12, yPos + 3);

    yPos += 4;
    const commentText = structure.comments || structure.description || "";
    const textLines = doc.splitTextToSize(commentText, pageWidth - 26);
    const boxHeight = Math.min(15, textLines.length * 3 + 4);

    yPos += boxHeight + 4;
  }

  // ===== ADDITIONAL STRUCTURE VISUAL DOCUMENTATION (for remaining photos > 4) =====
  if (uniquePhotos.length > 4) {
    const remainingPhotos = uniquePhotos.slice(4);
    const photosPerPage = 4; // 2x2 grid per page

    for (let pageIdx = 0; pageIdx < Math.ceil(remainingPhotos.length / photosPerPage); pageIdx++) {
      doc.addPage();
      yPos = 15;

      // Header bar for additional visuals page
      drawSectionBar(10, yPos, pageWidth - 20, 5, `STRUCTURE VISUAL DOCUMENTATION (Page ${pageIdx + 2})`, 12, yPos + 3.5);
      yPos += 8;

      const currentBatch = remainingPhotos.slice(pageIdx * photosPerPage, (pageIdx + 1) * photosPerPage);
      const gridCols = 2;
      const gridGap = 6;
      const cellWidth = (pageWidth - 20 - gridGap) / 2;
      const cellHeight = 90;

      // Load batch images
      const batchPromises = currentBatch.map(p => loadImage(p.url, p.id).catch(e => null));
      const loadedBatch = await Promise.all(batchPromises);

      loadedBatch.forEach((imgData, idx) => {
        const photoItem = currentBatch[idx];
        const row = Math.floor(idx / gridCols);
        const col = idx % gridCols;
        const x = 10 + (col * (cellWidth + gridGap));
        const y = yPos + (row * (cellHeight + gridGap));

        // Draw border container
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, cellWidth, cellHeight);

        if (imgData) {
          try {
            doc.addImage(imgData, 'JPEG', x + 1, y + 1, cellWidth - 2, cellHeight - 8);
          } catch (e) {
            console.error("Error adding PDF gallery image", e);
          }
        }

        // Title banner
        if (photoItem && photoItem.title) {
          doc.setFillColor(15, 23, 42);
          doc.rect(x + 1, y + cellHeight - 7, cellWidth - 2, 6, 'F');
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(255, 255, 255);
          doc.text(photoItem.title, x + cellWidth / 2, y + cellHeight - 3, { align: "center" });
        }
      });
    }
  }

  // ===== SIGNATURES =====
  if (config?.showSignatures !== false) {
    const hasSignatures = config?.preparedBy?.name || config?.reviewedBy?.name || config?.approvedBy?.name;
    if (hasSignatures) {
      let sigY = pageHeight - 38;
      if (yPos > sigY - 10) {
        doc.addPage();
        sigY = pageHeight - 38;
      }
      const sigWidth = (pageWidth - 20) / 3;
      const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
        doc.setDrawColor(...navy);
        doc.setLineWidth(0.1);
        doc.rect(lx, sigY, sigWidth - 4, 18);
        if (!isPrintFriendly) {
          doc.setFillColor(...navy);
          doc.rect(lx, sigY, sigWidth - 4, 4.5, "F");
          doc.setTextColor(255);
        } else {
          doc.setTextColor(...navy);
        }
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(label, lx + 2, sigY + 3.5);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("Name:", lx + 2, sigY + 10);
        if (person?.name) doc.text(person.name, lx + 14, sigY + 10);
        doc.text("Date:", lx + 2, sigY + 13.5);
        if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 13.5);
        doc.text("Signature:", lx + 2, sigY + 17);
      };

      drawSig("PREPARED BY", 10, config?.preparedBy);
      drawSig("REVIEWED BY", 10 + sigWidth, config?.reviewedBy);
      drawSig("APPROVED BY", 10 + (sigWidth * 2), config?.approvedBy);
    }
  }

  // ===== FOOTERS (ALL PAGES) =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);
    doc.text(REPORT_FOOTER_APP_TEXT, 10, pageHeight - 6);
    if (config?.showPageNumbers !== false) {
      doc.text(`Page ${i}`, pageWidth - 10, pageHeight - 6, { align: "right" });
    }
  }

  applyWatermarkAndSignaturesGlobal(doc, config);

  if ((config as any)?.returnBlob) {
    return doc.output('blob');
  } else {
    doc.save(`${structure.str_name.replace(/\s+/g, "_")}_Specifications.pdf`);
  }
};

export const generateReportHTML = (
  structure: StructureData,
  companySettings?: CompanySettings
): string => {
  // Route to appropriate template based on structure type
  if (structure.str_type === "PIPELINE") {
    return generatePipelineHTML(structure, companySettings);
  } else {
    return generatePlatformHTML(structure, companySettings);
  }
};

const generatePipelineHTML = (
  structure: StructureData,
  companySettings?: CompanySettings
): string => {
  const currentDate = new Date().toLocaleDateString();

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); color: #333;">
      
      <!-- Header -->
      <div style="background-color: #074e88; color: white; padding: 20px 30px; position: relative;">
        <div style="position: absolute; top: 15px; right: 30px;">
          ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border: 2px solid white; padding: 4px; background: white;" />`
      : `<div style="border: 2px solid white; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">LOGO</div>`
    }
        </div>
        
        <!-- Centered title and company info -->
        <div style="text-align: center; margin: 0 auto; max-width: calc(100% - 200px);">
          <!-- Company Name - SAME size as Report Title -->
          <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">${companySettings?.company_name || "NasQuest Resources Sdn Bhd"}</h1>
          
          <!-- Department Name (Sub-header) - Slightly increased font size -->
          <p style="margin: 0 0 6px 0; font-size: 13px; opacity: 0.9;">${companySettings?.department_name || "Technical Inspection Division"}</p>
          
          <!-- Report Title - SAME size as Company Title -->
          <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px; opacity: 0.95;">Pipeline Specifications Report</h2>
          
          <!-- Report No - Centered below Report Title -->
          <p style="margin: 0; font-size: 11px; opacity: 0.85; font-weight: 400;">Report: ${companySettings?.serial_no || "N/A"}</p>
        </div>
      </div>

      <div style="padding: 20px;">
        
        <!-- Three Column Layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          
          <!-- Column 1: General Info -->
          <div>
            <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              General Info
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <tbody>
                ${[
      ["Pipeline", structure.str_name],
      ["Title", structure.title],
      ["Field", structure.pfield || structure.field_name],
      ["Install Date", structure.inst_date],
      ["Description", (structure.description || "N/A").substring(0, 50)]
    ].map(([label, value], i) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                    <td style="padding: 5px 8px; font-weight: 600; color: #4a5568; width: 45%;">${label}</td>
                    <td style="padding: 5px 8px; color: #1a202c;">${value || "N/A"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Column 2: Technical Parameters -->
          <div>
            <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              Technical Parameters
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <tbody>
                ${[
      ["Outer Diameter", (structure as any).od ? `${(structure as any).od} in` : "N/A"],
      ["Wall Thickness", (structure as any).wall_thickness ? `${(structure as any).wall_thickness} mm` : "N/A"],
      ["Total Length", (structure as any).plength ? `${(structure as any).plength} m` : "N/A"],
      ["Material Type", structure.material],
      ["CP System", structure.cp_system]
    ].map(([label, value], i) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                    <td style="padding: 5px 8px; font-weight: 600; color: #4a5568; width: 45%;">${label}</td>
                    <td style="padding: 5px 8px; color: #1a202c;">${value || "N/A"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Column 3: Location & Path -->
          <div>
            <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              Location & Path
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <tbody>
                ${[
      ["From Platform", (structure as any).from_plat],
      ["To Platform", (structure as any).to_plat],
      ["Start Northing", (structure as any).start_northing ? `${(structure as any).start_northing} m` : "N/A"],
      ["Start Easting", (structure as any).start_easting ? `${(structure as any).start_easting} m` : "N/A"],
      ["End Northing", (structure as any).end_northing ? `${(structure as any).end_northing} m` : "N/A"],
      ["End Easting", (structure as any).end_easting ? `${(structure as any).end_easting} m` : "N/A"]
    ].map(([label, value], i) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                    <td style="padding: 5px 8px; font-weight: 600; color: #4a5568; width: 45%;">${label}</td>
                    <td style="padding: 5px 8px; color: #1a202c;">${value || "N/A"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Burial & Protection (Full Width) -->
        <div style="margin-bottom: 15px;">
          <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Burial & Protection
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
            <tbody>
              ${[
      ["Burial Status", (structure as any).burial_status],
      ["Protection Method", (structure as any).protection_method],
      ["Coating", structure.corr_ctg]
    ].map(([label, value], i) => `
                <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                  <td style="padding: 5px 8px; font-weight: 600; color: #4a5568; width: 20%;">${label}</td>
                  <td style="padding: 5px 8px; color: #1a202c;">${value || "N/A"}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Geodetic Parameters (Two Column) -->
        <div style="margin-bottom: 15px;">
          <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Geodetic Parameters
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #cbd5e0; border-top: none;">
            <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
              <tbody>
                ${[
      ["Project Name", (structure as any).project_name],
      ["Unit", (structure as any).unit || (structure as any).unit_system],
      ["Datum", (structure as any).datum],
      ["Ellipsoid / Spheroid", (structure as any).ellipsoid || (structure as any).spheroid]
    ].map(([label, value], i) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                    <td style="padding: 5px 8px; font-weight: 600; color: #4a5568; width: 45%; border-right: 1px solid #e2e8f0;">${label}</td>
                    <td style="padding: 5px 8px; color: #1a202c;">${value || "N/A"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
              <tbody>
                ${[
      ["Datum Shift", (structure as any).datum_shift],
      ["Dx", (structure as any).dx],
      ["Dy", (structure as any).dy],
      ["Dz", (structure as any).dz]
    ].map(([label, value], i) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                    <td style="padding: 5px 8px; font-weight: 600; color: #4a5568; width: 45%;">${label}</td>
                    <td style="padding: 5px 8px; color: #1a202c;">${value || "N/A"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Comments -->
        <div>
          <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Additional Comments
          </div>
          <div style="border: 1px solid #cbd5e0; border-top: none; padding: 10px; font-size: 9px; color: #2d3748; background: #fdfdfd; min-height: 30px;">
            ${structure.comments || structure.description || "No additional comments provided."}
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #718096; display: flex; justify-content: space-between; align-items: center;">
          <span>${REPORT_FOOTER_APP_TEXT}</span>
          <span style="font-weight: 600; letter-spacing: 0.5px;">Page 1</span>
        </div>

      </div>
    </div>
  `;
};

const generatePlatformHTML = (
  structure: StructureData,
  companySettings?: CompanySettings
): string => {
  const currentDate = new Date().toLocaleDateString();

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); color: #333;">
      
      <!-- Header with Square Logo -->
      <div style="background-color: #074e88; color: white; padding: 20px 30px; position: relative;">
        <!-- Logo positioned at far right -->
        <div style="position: absolute; top: 15px; right: 30px;">
          ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 50px; height: 50px; object-fit: contain; padding: 2px;" />`
      : `<div style="border: 1px solid rgba(255,255,255,0.4); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">LOGO</div>`
    }
        </div>
        
        <!-- Centered title and company info -->
        <div style="text-align: center; margin: 0 auto; max-width: calc(100% - 200px);">
          <!-- Company Name - SAME size as Report Title -->
          <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">${companySettings?.company_name || "NasQuest Resources Sdn Bhd"}</h1>
          
          <!-- Department Name (Sub-header) - Slightly increased font size -->
          <p style="margin: 0 0 6px 0; font-size: 13px; opacity: 0.9;">${companySettings?.department_name || "Technical Inspection Division"}</p>
          
          <!-- Report Title - SAME size as Company Title -->
          <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px; opacity: 0.95;">Platform Specifications Report</h2>
          
          <!-- Report No - Centered below Report Title -->
          <p style="margin: 0; font-size: 11px; opacity: 0.85; font-weight: 400;">Report: ${companySettings?.serial_no || "N/A"}</p>
        </div>
      </div>

      <div style="padding: 20px;">
        
        <!-- Platform Picture (Dynamic: 1, 2, or 3+ photos) -->
        ${(() => {
          // Only use structure.visuals (structure.photos is the same array from the API)
          const sourceVisuals: any[] = Array.isArray(structure.visuals) ? structure.visuals : [];

          const seenIds = new Set<string>();
          const uniqueItems: any[] = [];
          
          const isImage = (item: any): boolean => {
            if (!item || typeof item !== 'object') return false;
            const meta = typeof item.meta === 'string' ? (() => { try { return JSON.parse(item.meta); } catch { return {}; } })() : (item.meta || {});
            const ft = String(meta?.file_type || item.file_type || "").toLowerCase();
            if (ft.startsWith("image/")) return true;
            const fp = String(meta?.file_path || meta?.file_url || item.path || item.file_url || item.name || "").toLowerCase();
            return /\.(jpg|jpeg|png|webp|gif|bmp|tiff|svg)(\?.*)?$/i.test(fp);
          };

          for (const v of sourceVisuals) {
            if (!v || typeof v !== 'object') continue;
            if (!isImage(v)) continue;
            const vid = String(v.id || "");
            if (vid && seenIds.has(vid)) continue;
            if (vid) seenIds.add(vid);

            const meta = typeof v.meta === 'string' ? (() => { try { return JSON.parse(v.meta); } catch { return {}; } })() : (v.meta || {});
            
            // Use proxy URL for reliable loading (no CORS)
            const imgUrl = v.id ? `/api/attachment/url?id=${v.id}` : (meta?.file_url || v.file_url || v.url || '');
            if (!imgUrl) continue;

            const rawTitle = meta?.title || v.title || v.name || meta?.original_file_name || 'Platform Visual';
            uniqueItems.push({ url: imgUrl, title: rawTitle });
          }

          // Fallback to photo_url if no visuals found
          if (uniqueItems.length === 0 && structure.photo_url) {
            uniqueItems.push({ url: structure.photo_url, title: structure.title || structure.str_name || 'Platform Overview' });
          }

          if (uniqueItems.length === 0) return '';

          return `
            <div style="margin-bottom: 20px;">
              <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                Structure Visuals (${uniqueItems.length})
              </div>
              <div style="border: 1px solid #cbd5e0; border-top: none; padding: 15px; background: #f8fafc; text-align: center;">
                <div style="display: flex; justify-content: center; align-items: stretch; gap: 12px; flex-wrap: wrap;">
                  ${uniqueItems.slice(0, 4).map((photo: any) => {
                    const count = Math.min(uniqueItems.length, 4);
                    let width = '100%';
                    if (count === 2) width = '48%';
                    else if (count === 3) width = '31%';
                    else if (count >= 4) width = '23%';
                    return `
                      <div style="flex: 0 0 ${width}; max-width: ${width}; display: flex; flex-direction: column; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <img src="${photo.url}" alt="${photo.title}" style="max-width: 100%; max-height: 220px; object-fit: contain; border-radius: 4px;" />
                        <div style="font-size: 10px; font-weight: 600; color: #334155; margin-top: 6px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">${photo.title}</div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          `;
        })()}
        
        <!-- Three Column Layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          
          <!-- Column 1: General Info -->
          <div>
            <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              General Info
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <tbody>
                ${[
      ["Title", structure.title || structure.str_name || "N/A"],
      ["Field", structure.pfield || structure.field_name || "N/A"],
      ["Install Date", formatDisplayDate(structure.inst_date)],
      ["Depth", (structure.depth !== undefined && structure.depth !== null && String(structure.depth).trim() !== "") ? `${structure.depth} m` : "N/A"],
      ["Design Life", (structure.desg_life !== undefined && structure.desg_life !== null && String(structure.desg_life).trim() !== "") ? `${structure.desg_life} yrs` : "N/A"]
    ].map(([label, value], i) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                    <td style="padding: 5px 8px; font-weight: 600; color: #4a5568; width: 45%;">${label}</td>
                    <td style="padding: 5px 8px; color: #1a202c;">${value || "N/A"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Column 2: Configuration -->
          <div>
            <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              Configuration
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <tbody>
                ${[
      ["Type", structure.ptype || structure.str_type || "N/A"],
      ["Function", structure.function || structure.process || "N/A"],
      ["Material", structure.material || "N/A"],
      ["CP System", structure.cp_system || "N/A"],
      ["Corrosion Coating", structure.corr_ctg || "N/A"],
      ["Contractor", structure.inst_contractor || structure.inst_ctr || "N/A"]
    ].map(([label, value], i) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                    <td style="padding: 5px 8px; font-weight: 600; color: #4a5568; width: 45%;">${label}</td>
                    <td style="padding: 5px 8px; color: #1a202c;">${value || "N/A"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Column 3: Location & Dimensions -->
          <div>
            <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              Location & Dimension
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <tbody>
                ${[
      ["Northing", (structure.northing !== undefined && structure.northing !== null && String(structure.northing).trim() !== "") ? `${structure.northing} m` : (structure.st_north !== undefined && structure.st_north !== null && String(structure.st_north).trim() !== "" ? `${structure.st_north} m` : "N/A")],
      ["Easting", (structure.easting !== undefined && structure.easting !== null && String(structure.easting).trim() !== "") ? `${structure.easting} m` : (structure.st_east !== undefined && structure.st_east !== null && String(structure.st_east).trim() !== "" ? `${structure.st_east} m` : "N/A")],
      ["True North", (structure.true_north_angle !== undefined && structure.true_north_angle !== null && String(structure.true_north_angle).trim() !== "") ? `${structure.true_north_angle}°` : (structure.north_angle !== undefined && structure.north_angle !== null && String(structure.north_angle).trim() !== "" ? `${structure.north_angle}°` : "N/A")],
      ["Max Leg Dia", (structure.max_leg_dia !== undefined && structure.max_leg_dia !== null && String(structure.max_leg_dia).trim() !== "") ? `${structure.max_leg_dia} mm` : (structure.dleg !== undefined && structure.dleg !== null && String(structure.dleg).trim() !== "" ? `${structure.dleg} mm` : "N/A")],
      ["Max Wall", (structure.max_wall_thk !== undefined && structure.max_wall_thk !== null && String(structure.max_wall_thk).trim() !== "") ? `${structure.max_wall_thk} mm` : (structure.wall_thk !== undefined && structure.wall_thk !== null && String(structure.wall_thk).trim() !== "" ? `${structure.wall_thk} mm` : "N/A")],
      ["Helipad", (structure.helipad === "YES" || structure.helipad === "Yes" || structure.helipad === "1" || structure.helipad === true) ? "Yes" : "No"]
    ].map(([label, value], i) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                    <td style="padding: 5px 8px; font-weight: 600; color: #4a5568; width: 45%;">${label}</td>
                    <td style="padding: 5px 8px; color: #1a202c;">${value || "N/A"}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Inventory Statistics (Full Width) -->
        <div style="margin-bottom: 15px;">
          <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Inventory Statistics
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
            <tbody>
              <tr style="background-color: #ffffff;">
                ${[
      ["Conductors", structure.conductors ?? structure.conduct ?? 0],
      ["Int. Piles", structure.internal_piles ?? structure.pileint ?? 0],
      ["Slots", structure.slots ?? structure.cslot ?? structure.cslota ?? "N/A"],
      ["Fenders", structure.fenders ?? structure.fender ?? 0],
      ["Risers", structure.risers ?? structure.riser ?? 0]
    ].map(([label, value]) => `
                  <td style="padding: 8px; text-align: center; border-right: 1px solid #e2e8f0;">
                    <div style="font-weight: 600; color: #718096; font-size: 8px; text-transform: uppercase; margin-bottom: 2px;">${label}</div>
                    <div style="font-size: 14px; font-weight: 700; color: #074e88;">${value}</div>
                  </td>
                `).join('')}
              </tr>
               <tr style="background-color: #f7fafc;">
                ${[
      ["Sumps", structure.sumps ?? structure.sump ?? 0],
      ["Skirt Piles", structure.skirt_piles ?? structure.pileskt ?? 0],
      ["Caissons", structure.caissons ?? structure.caisson ?? 0],
      ["Anodes", structure.anodes ?? structure.an_qty ?? 0],
      ["Cranes", structure.cranes ?? structure.crane ?? 0]
    ].map(([label, value]) => `
                  <td style="padding: 8px; text-align: center; border-right: 1px solid #e2e8f0;">
                    <div style="font-weight: 600; color: #718096; font-size: 8px; text-transform: uppercase; margin-bottom: 2px;">${label}</div>
                    <div style="font-size: 14px; font-weight: 700; color: #074e88;">${value}</div>
                  </td>
                `).join('')}
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Platform Legs (ALWAYS SHOW) -->
        <div style="margin-bottom: 15px;">
          <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Platform Legs ${structure.legs && structure.legs.length > 0 ? `(${structure.legs.length} Active)` : ''}
          </div>
          <div style="border: 1px solid #cbd5e0; border-top: none; padding: 10px; min-height: 60px; ${structure.legs && structure.legs.length > 0 ? `display: grid; grid-template-columns: repeat(${Math.min(structure.legs.length, 10)}, 1fr); gap: 5px;` : 'display: flex; align-items: center; justify-content: center; background: #f8fafc;'}">
            ${structure.legs && structure.legs.length > 0
      ? structure.legs.slice(0, 20).map((leg: any, idx: number) => `
                <div style="text-align: center; padding: 5px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <div style="font-size: 7px; color: #718096;">Leg ${idx + 1}</div>
                  <div style="font-size: 10px; font-weight: 700; color: #074e88;">${leg.leg_name || leg.designation || `L${idx + 1}`}</div>
                </div>
              `).join('')
      : `<div style="color: #a0aec0; font-size: 11px; font-style: italic;">No leg configuration data available</div>`
    }
          </div>
        </div>

        <!-- Two Column: Elevations & Levels (ALWAYS SHOW) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          
          <!-- Elevations (ALWAYS SHOW) -->
          <div>
            <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              Elevations (m)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <thead>
                <tr style="background-color: #edf2f7;">
                  <th style="padding: 5px; text-align: left; font-weight: 600; color: #4a5568;">Type</th>
                  <th style="padding: 5px; text-align: center; font-weight: 600; color: #4a5568;">Value (m)</th>
                </tr>
              </thead>
              <tbody>
                ${structure.elevations && structure.elevations.length > 0
      ? structure.elevations.slice(0, 6).map((elev: any, i: number) => `
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                      <td style="padding: 5px 8px;">${elev.orient || elev.name || elev.type || "Elevation"}</td>
                      <td style="padding: 5px 8px; text-align: center; font-family: monospace;">${elev.elv || elev.value || elev.elevation || "N/A"}</td>
                    </tr>
                  `).join('')
      : `<tr><td colspan="2" style="padding: 15px; text-align: center; color: #a0aec0; font-style: italic;">No elevation data available</td></tr>`
    }
              </tbody>
            </table>
          </div>

          <!-- Levels (ALWAYS SHOW) -->
          <div>
            <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              Platform Levels
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <thead>
                <tr style="background-color: #edf2f7;">
                  <th style="padding: 5px; text-align: left; font-weight: 600; color: #4a5568;">Level</th>
                  <th style="padding: 5px; text-align: center; font-weight: 600; color: #4a5568;">Start</th>
                  <th style="padding: 5px; text-align: center; font-weight: 600; color: #4a5568;">End</th>
                </tr>
              </thead>
              <tbody>
                ${structure.levels && structure.levels.length > 0
      ? structure.levels.slice(0, 6).map((level: any, i: number) => `
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                      <td style="padding: 5px 8px;">${level.level_name || "Level"}</td>
                      <td style="padding: 5px 8px; text-align: center; font-family: monospace;">${level.elv_from || level.start_elv || 0}</td>
                      <td style="padding: 5px 8px; text-align: center; font-family: monospace;">${level.elv_to || level.end_elv || 0}</td>
                    </tr>
                  `).join('')
      : `<tr><td colspan="3" style="padding: 15px; text-align: center; color: #a0aec0; font-style: italic;">No level data available</td></tr>`
    }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Faces (ALWAYS SHOW) -->
        <div style="margin-bottom: 15px;">
          <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Platform Faces
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
            <thead>
              <tr style="background-color: #edf2f7;">
                <th style="padding: 5px; text-align: left; font-weight: 600; color: #4a5568;">Face Name</th>
                <th style="padding: 5px; text-align: center; font-weight: 600; color: #4a5568;">From</th>
                <th style="padding: 5px; text-align: center; font-weight: 600; color: #4a5568;">To</th>
              </tr>
            </thead>
            <tbody>
              ${structure.faces && structure.faces.length > 0
      ? structure.faces.slice(0, 4).map((face: any, i: number) => `
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${i % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                    <td style="padding: 5px 8px;">${face.face || face.face_name || face.name || "Face"}</td>
                    <td style="padding: 5px 8px; text-align: center;">${face.face_from || face.from || "N/A"}</td>
                    <td style="padding: 5px 8px; text-align: center;">${face.face_to || face.to || "N/A"}</td>
                  </tr>
                `).join('')
      : `<tr><td colspan="3" style="padding: 15px; text-align: center; color: #a0aec0; font-style: italic;">No face data available</td></tr>`
    }
            </tbody>
          </table>
        </div>

        <!-- Comments -->
        <div>
          <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Additional Comments
          </div>
          <div style="border: 1px solid #cbd5e0; border-top: none; padding: 10px; font-size: 9px; color: #2d3748; background: #fdfdfd; min-height: 30px;">
            ${structure.comments || structure.description || "No additional comments provided."}
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #718096; display: flex; justify-content: space-between; align-items: center;">
          <span>${REPORT_FOOTER_APP_TEXT}</span>
          <span style="font-weight: 600; letter-spacing: 0.5px;">Page 1</span>
        </div>

      </div>
    </div>
  `;
};

const FALLBACK_TYPE_MAP: Record<string, string> = {
  "BO": "BOAT LANDING",
  "BR": "BRACING",
  "GR": "GUARD RAIL",
  "ND": "NODE",
  "PA": "PAD EYE",
  "PT": "PROTECTION",
  "RL": "RAILING",
  "VS": "VENT STACK",
  "WK": "WALKWAY",
  "AN": "ANODE",
  "CL": "CLAMP",
  "CS": "CAISSON",
  "FA": "FACE",
  "FD": "BOAT FENDER",
  "HD": "HORIZONTAL DIAGONAL MEMBER",
  "HM": "HORIZONTAL MEMBER",
  "IT": "ITEM",
  "LA": "LADDER",
  "LG": "LEG",
  "PG": "PILE GUIDE",
  "PL": "PILE",
  "RS": "RISER",
  "RG": "RISER GUARD",
  "SD": "SEABED",
  "VD": "VERTICAL DIAG. MEMBER",
  "VM": "VERTICAL MEMBER",
  "WN": "NODE WELD",
  "WP": "SUPPORT WELD"
};

const resolveTypeName = (code: string, typeMap?: Record<string, string>): string => {
  if (typeMap && typeMap[code]) return typeMap[code];
  if (FALLBACK_TYPE_MAP[code]) return FALLBACK_TYPE_MAP[code];
  return code;
};

export const generateComponentSummaryReport = async (
  structure: StructureData,
  companySettings?: CompanySettings,
  typeMap?: Record<string, string>,
  config?: ReportConfig
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const autoTable = (doc as any).autoTable || autoTablePlugin;

  // Colors
  const headerBlue: [number, number, number] = [7, 78, 136];
  const sectionBlue: [number, number, number] = [7, 78, 136];
  const lightBlue: [number, number, number] = [235, 242, 250];
  const isPrintFriendly = config?.printFriendly === true;

  // ===== HEADER (3 SECTIONS: Contractor Logo | Middle Info | Client Logo) =====
  await draw3SectionHeader(doc, {
    pageWidth,
    companySettings,
    config,
    reportTitle: "Component Summary Report",
    isPrintFriendly,
    headerBlue,
  });

  // Subtitle
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Structure: ${structure.str_name} (${structure.str_type})`, 10, 35);

  let yPos = 40;

  // ===== STRUCTURE INFO TABLES =====
  const infoY = yPos;
  const colGap = 4;
  const tableWidth = (pageWidth - 20 - (colGap * 2)) / 3;

  if (structure.str_type === "PIPELINE") {
    // --- PIPELINE HEADERS ---

    // Table 1: General Info
    autoTable(doc, {
      startY: infoY,
      margin: { left: 10 },
      head: [['GENERAL INFO', '']],
      body: [
        ['Pipeline', structure.str_name || '-'],
        ['Title', structure.title || structure.str_name || '-'],
        ['Field', structure.pfield || structure.field_name || '-'],
        ['Install Date', structure.inst_date || '-'],
        ['Description', structure.description ? structure.description.substring(0, 30) : '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7, textColor: 50, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } },
      tableWidth: tableWidth,
      showHead: 'firstPage'
    });

    // Table 2: Technical Parameters
    autoTable(doc, {
      startY: infoY,
      margin: { left: 10 + tableWidth + colGap },
      head: [['TECHNICAL PARAMS', '']],
      body: [
        ['Type', structure.ptype || structure.str_type || '-'],
        ['Product', structure.function || '-'], // Mapping function to product for now if needed, or check interface
        ['Material', structure.material || '-'],
        ['Coating', structure.corr_ctg || '-'],
        ['CP System', structure.cp_system || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7, textColor: 50, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } },
      tableWidth: tableWidth,
      showHead: 'firstPage'
    });

    // Table 3: Dimensions & Location
    autoTable(doc, {
      startY: infoY,
      margin: { left: 10 + (tableWidth + colGap) * 2 },
      head: [['DIMS & LOCATION', '']],
      body: [
        ['Start Loc', structure.northing ? `N:${structure.northing}` : 'N/A'], // Simplified mapping
        ['End Loc', structure.easting ? `E:${structure.easting}` : 'N/A'],
        ['Length', structure.depth ? `${structure.depth} m` : '-'], // Often length is stored in depth or similar for pipelines
        ['Diameter', structure.max_leg_dia ? `${structure.max_leg_dia}"` : '-'],
        ['Wall Thk', structure.max_wall_thk ? `${structure.max_wall_thk}"` : '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7, textColor: 50, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } },
      tableWidth: tableWidth,
      showHead: 'firstPage'
    });

  } else {
    // --- PLATFORM HEADERS (Default) ---

    // Table 1: General Info
    autoTable(doc, {
      startY: infoY,
      margin: { left: 10 },
      head: [['GENERAL INFO', '']],
      body: [
        ['Title', structure.title || structure.str_name || '-'],
        ['Field', structure.field_name || structure.pfield || '-'],
        ['Install Date', formatDisplayDate(structure.inst_date)],
        ['Depth', (structure.depth !== undefined && structure.depth !== null && String(structure.depth).trim() !== "") ? `${structure.depth} m` : '-'],
        ['Design Life', (structure.desg_life !== undefined && structure.desg_life !== null && String(structure.desg_life).trim() !== "") ? `${structure.desg_life} yrs` : '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7, textColor: 50, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } },
      tableWidth: tableWidth,
      showHead: 'firstPage'
    });

    // Table 2: Configuration
    autoTable(doc, {
      startY: infoY,
      margin: { left: 10 + tableWidth + colGap },
      head: [['CONFIGURATION', '']],
      body: [
        ['Type', structure.ptype || structure.str_type || '-'],
        ['Function', structure.function || structure.process || '-'],
        ['Material', structure.material || '-'],
        ['CP System', structure.cp_system || '-'],
        ['Corrosion Coating', structure.corr_ctg || '-'],
        ['Contractor', structure.inst_contractor || structure.inst_ctr || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7, textColor: 50, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } },
      tableWidth: tableWidth,
      showHead: 'firstPage'
    });

    // Table 3: Location & Dimension
    const northingVal = (structure.northing !== undefined && structure.northing !== null && String(structure.northing).trim() !== "") ? `${structure.northing} m` : (structure.st_north !== undefined && structure.st_north !== null && String(structure.st_north).trim() !== "" ? `${structure.st_north} m` : 'N/A');
    const eastingVal = (structure.easting !== undefined && structure.easting !== null && String(structure.easting).trim() !== "") ? `${structure.easting} m` : (structure.st_east !== undefined && structure.st_east !== null && String(structure.st_east).trim() !== "" ? `${structure.st_east} m` : 'N/A');
    const northAngleVal = (structure.true_north_angle !== undefined && structure.true_north_angle !== null && String(structure.true_north_angle).trim() !== "") ? `${structure.true_north_angle}°` : (structure.north_angle !== undefined && structure.north_angle !== null && String(structure.north_angle).trim() !== "" ? `${structure.north_angle}°` : 'N/A');
    const maxLegDiaVal = (structure.max_leg_dia !== undefined && structure.max_leg_dia !== null && String(structure.max_leg_dia).trim() !== "") ? `${structure.max_leg_dia} mm` : (structure.dleg !== undefined && structure.dleg !== null && String(structure.dleg).trim() !== "" ? `${structure.dleg} mm` : 'N/A');
    const maxWallThkVal = (structure.max_wall_thk !== undefined && structure.max_wall_thk !== null && String(structure.max_wall_thk).trim() !== "") ? `${structure.max_wall_thk} mm` : (structure.wall_thk !== undefined && structure.wall_thk !== null && String(structure.wall_thk).trim() !== "" ? `${structure.wall_thk} mm` : 'N/A');
    const isHelipad = structure.helipad === "YES" || structure.helipad === "Yes" || structure.helipad === "1" || structure.helipad === true;

    autoTable(doc, {
      startY: infoY,
      margin: { left: 10 + (tableWidth + colGap) * 2 },
      head: [['LOCATION & DIMENSION', '']],
      body: [
        ['Northing', northingVal],
        ['Easting', eastingVal],
        ['True North', northAngleVal],
        ['Max Leg Dia', maxLegDiaVal],
        ['Max Wall', maxWallThkVal],
        ['Helipad', isHelipad ? 'Yes' : 'No']
      ],
      theme: 'grid',
      headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7, textColor: 50, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } },
      tableWidth: tableWidth,
      showHead: 'firstPage'
    });
  }

  // Update yPos to end of tallest table
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Filter Active Components
  const allComponents = structure.components || [];
  const components = allComponents.filter((c: any) =>
    !c.is_deleted &&
    (!c.DEL || c.DEL === 0 || c.DEL === "0")
  );

  // Group components by Type logic
  const grouped: Record<string, any[]> = {};
  components.forEach(comp => {
    // If code is available, use it as key, otherwise null
    const code = comp.code || comp.type || "Uncategorized";
    if (!grouped[code]) grouped[code] = [];
    grouped[code].push(comp);
  });

  const sortedTypes = Object.keys(grouped).sort();

  // ===== SUMMARY STATISTICS (INVENTORY STYLE GRID) =====
  doc.setFillColor(...sectionBlue);
  doc.rect(10, yPos, pageWidth - 20, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("COMPONENT STATISTICS", 12, yPos + 4);
  yPos += 8;

  const cols = 5;
  const gap = 0; // No gap between boxes for this style
  const colWidth = (pageWidth - 20) / cols;
  const rowHeight = 15;

  doc.setDrawColor(220, 220, 220); // Light grey border
  doc.setFont("helvetica", "normal");

  sortedTypes.forEach((code, index) => {
    // Check page break
    if (yPos + rowHeight > pageHeight - 15) {
      doc.addPage();
      yPos = 20;
    }

    const colIndex = index % cols;
    if (colIndex === 0 && index !== 0) {
      yPos += rowHeight;
    }

    const xPos = 10 + (colIndex * colWidth);
    const count = grouped[code].length;
    const typeName = resolveTypeName(code, typeMap);

    // Box Background (White with Border)
    doc.setFillColor(255, 255, 255);
    doc.rect(xPos, yPos, colWidth, rowHeight, "FD");

    // Label (Top, centered, small, uppercase)
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100); // Grey label
    doc.setFont("helvetica", "bold");

    let label = typeName.toUpperCase();
    if (label !== code && !label.includes(`(${code})`)) label += ` (${code})`;
    if (label.length > 25) label = label.substring(0, 23) + "...";

    doc.text(label, xPos + (colWidth / 2), yPos + 5, { align: "center" });

    // Count (Bottom, centered, large, dark)
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFont("helvetica", "bold");
    doc.text(String(count), xPos + (colWidth / 2), yPos + 11, { align: "center" });
  });

  // Add Total Box
  const totalIndex = sortedTypes.length;
  const totalColIndex = totalIndex % cols;
  if (totalColIndex === 0 && totalIndex !== 0) {
    yPos += rowHeight;
  }
  const totalXPos = 10 + (totalColIndex * colWidth);

  // Total Box Styling
  doc.setFillColor(240, 248, 255); // AliceBlue highlight
  doc.rect(totalXPos, yPos, colWidth, rowHeight, "FD");

  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  doc.text("TOTAL ACTIVE", totalXPos + (colWidth / 2), yPos + 5, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(7, 78, 136);
  doc.text(String(components.length), totalXPos + (colWidth / 2), yPos + 11, { align: "center" });

  yPos += rowHeight + 10;

  // ===== DETAILED LISTS =====

  for (const code of sortedTypes) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    // Section Header
    const typeName = resolveTypeName(code, typeMap);

    doc.setFillColor(230, 230, 230);
    doc.rect(10, yPos, pageWidth - 20, 6, "F");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${typeName} (${grouped[code].length})`, 12, yPos + 4);
    yPos += 6;

    const comps = grouped[code];

    const tableBody = comps.map((c, idx) => {
      const meta = c.metadata || {};
      return [
        idx + 1,
        c.q_id || "-",
        c.code || c.type || "-",
        `${meta.s_node || "-"} > ${meta.f_node || "-"}`,
        `${meta.s_leg || "-"} - ${meta.f_leg || "-"}`,
        `${meta.elv_1 || "-"} / ${meta.elv_2 || "-"}`
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['No.', 'Q ID', 'Type', 'Node Path (S/E)', 'Legs (S/E)', 'Elev (1/2)']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7, textColor: 50 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 20 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 30, halign: 'center' }
      },
      margin: { left: 10, right: 10 },
      styles: { cellPadding: 2 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);
    doc.text(REPORT_FOOTER_APP_TEXT, 10, pageHeight - 6);
    if (config?.showPageNumbers !== false) {
      doc.text(`Page ${i}`, pageWidth - 10, pageHeight - 6, { align: "right" });
    }
  }

  applyWatermarkAndSignaturesGlobal(doc, config);

  if (config?.returnBlob) {
    return doc.output('blob');
  } else {
    doc.save(`${structure.str_name.replace(/\s+/g, "_")}_Component_Summary.pdf`);
  }
};

export const generateComponentSummaryHTML = (
  structure: StructureData,
  companySettings?: CompanySettings,
  typeMap?: Record<string, string>
): string => {
  const currentDate = new Date().toLocaleDateString();
  const allComponents = structure.components || [];

  // Filter Active
  const components = allComponents.filter((c: any) =>
    !c.is_deleted && (!c.DEL || c.DEL === 0 || c.DEL === "0")
  );

  // Group components
  const grouped: Record<string, any[]> = {};
  components.forEach(comp => {
    const code = comp.code || comp.type || "Uncategorized";
    if (!grouped[code]) grouped[code] = [];
    grouped[code].push(comp);
  });
  const sortedTypes = Object.keys(grouped).sort();

  const infoTableStyle = "width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #cbd5e0;";
  const thStyle = "background-color: #074e88; color: white; padding: 4px 8px; text-align: left; font-weight: bold; font-size: 10px;";
  const tdLabelStyle = "padding: 4px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #4a5568; width: 35%; background-color: #f8fafc;";
  const tdValueStyle = "padding: 4px 8px; border-bottom: 1px solid #e2e8f0; color: #1a202c;";

  const InfoRow = (label: string, value: any) => `
    <tr><td style="${tdLabelStyle}">${label}</td><td style="${tdValueStyle}">${value || "-"}</td></tr>
  `;

  // Define Headers based on Structure Type
  let headerContent = "";
  if (structure.str_type === "PIPELINE") {
    headerContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <div>
                <table style="${infoTableStyle}">
                    <thead><tr><th colspan="2" style="${thStyle}">GENERAL INFO</th></tr></thead>
                    <tbody>
                        ${InfoRow("Pipeline", structure.str_name)}
                        ${InfoRow("Title", structure.title || structure.str_name)}
                        ${InfoRow("Field", structure.pfield || structure.field_name)}
                        ${InfoRow("Install Date", structure.inst_date)}
                        ${InfoRow("Description", structure.description)}
                    </tbody>
                </table>
            </div>
            <div>
                <table style="${infoTableStyle}">
                    <thead><tr><th colspan="2" style="${thStyle}">TECHNICAL PARAMS</th></tr></thead>
                    <tbody>
                        ${InfoRow("Type", structure.ptype || structure.str_type)}
                        ${InfoRow("Product", structure.function)}
                        ${InfoRow("Material", structure.material)}
                        ${InfoRow("Coating", structure.corr_ctg)}
                        ${InfoRow("CP System", structure.cp_system)}
                    </tbody>
                </table>
            </div>
            <div>
                <table style="${infoTableStyle}">
                    <thead><tr><th colspan="2" style="${thStyle}">DIMS & LOCATION</th></tr></thead>
                    <tbody>
                        ${InfoRow("Start Loc", structure.northing ? `N:${structure.northing}` : null)}
                        ${InfoRow("End Loc", structure.easting ? `E:${structure.easting}` : null)}
                        ${InfoRow("Length", structure.depth ? structure.depth + " m" : null)}
                        ${InfoRow("Diameter", structure.max_leg_dia ? structure.max_leg_dia + '"' : null)}
                        ${InfoRow("Wall Thk", structure.max_wall_thk ? structure.max_wall_thk + '"' : null)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
  } else {
    // Platform Headers
    const northingVal = (structure.northing !== undefined && structure.northing !== null && String(structure.northing).trim() !== "") ? `${structure.northing} m` : (structure.st_north !== undefined && structure.st_north !== null && String(structure.st_north).trim() !== "" ? `${structure.st_north} m` : null);
    const eastingVal = (structure.easting !== undefined && structure.easting !== null && String(structure.easting).trim() !== "") ? `${structure.easting} m` : (structure.st_east !== undefined && structure.st_east !== null && String(structure.st_east).trim() !== "" ? `${structure.st_east} m` : null);
    const northAngleVal = (structure.true_north_angle !== undefined && structure.true_north_angle !== null && String(structure.true_north_angle).trim() !== "") ? `${structure.true_north_angle}°` : (structure.north_angle !== undefined && structure.north_angle !== null && String(structure.north_angle).trim() !== "" ? `${structure.north_angle}°` : null);
    const maxLegDiaVal = (structure.max_leg_dia !== undefined && structure.max_leg_dia !== null && String(structure.max_leg_dia).trim() !== "") ? `${structure.max_leg_dia} mm` : (structure.dleg !== undefined && structure.dleg !== null && String(structure.dleg).trim() !== "" ? `${structure.dleg} mm` : null);
    const maxWallThkVal = (structure.max_wall_thk !== undefined && structure.max_wall_thk !== null && String(structure.max_wall_thk).trim() !== "") ? `${structure.max_wall_thk} mm` : (structure.wall_thk !== undefined && structure.wall_thk !== null && String(structure.wall_thk).trim() !== "" ? `${structure.wall_thk} mm` : null);
    const isHelipad = structure.helipad === "YES" || structure.helipad === "Yes" || structure.helipad === "1" || structure.helipad === true;

    headerContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <div>
                <table style="${infoTableStyle}">
                    <thead><tr><th colspan="2" style="${thStyle}">GENERAL INFO</th></tr></thead>
                    <tbody>
                        ${InfoRow("Title", structure.title || structure.str_name)}
                        ${InfoRow("Field", structure.field_name || structure.pfield)}
                        ${InfoRow("Install Date", formatDisplayDate(structure.inst_date))}
                        ${InfoRow("Depth", (structure.depth !== undefined && structure.depth !== null && String(structure.depth).trim() !== "") ? `${structure.depth} m` : null)}
                        ${InfoRow("Design Life", (structure.desg_life !== undefined && structure.desg_life !== null && String(structure.desg_life).trim() !== "") ? `${structure.desg_life} yrs` : null)}
                    </tbody>
                </table>
            </div>
            <div>
                <table style="${infoTableStyle}">
                    <thead><tr><th colspan="2" style="${thStyle}">CONFIGURATION</th></tr></thead>
                    <tbody>
                        ${InfoRow("Type", structure.ptype || structure.str_type)}
                        ${InfoRow("Function", structure.function || structure.process)}
                        ${InfoRow("Material", structure.material)}
                        ${InfoRow("CP System", structure.cp_system)}
                        ${InfoRow("Corrosion Coating", structure.corr_ctg)}
                        ${InfoRow("Contractor", structure.inst_contractor || structure.inst_ctr)}
                    </tbody>
                </table>
            </div>
            <div>
                <table style="${infoTableStyle}">
                    <thead><tr><th colspan="2" style="${thStyle}">LOCATION & DIMENSION</th></tr></thead>
                    <tbody>
                        ${InfoRow("Northing", northingVal)}
                        ${InfoRow("Easting", eastingVal)}
                        ${InfoRow("True North", northAngleVal)}
                        ${InfoRow("Max Leg Dia", maxLegDiaVal)}
                        ${InfoRow("Max Wall", maxWallThkVal)}
                        ${InfoRow("Helipad", isHelipad ? "Yes" : "No")}
                    </tbody>
                </table>
            </div>
        </div>
    `;
  }

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); color: #333;">
      
      <!-- Header -->
      <div style="background-color: #074e88; color: white; padding: 20px 30px; position: relative;">
        <div style="position: absolute; top: 15px; right: 30px;">
          ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border: 2px solid white; padding: 4px; background: white;" />`
      : `<div style="border: 2px solid white; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">LOGO</div>`
    }
        </div>
        
        <div style="text-align: center; margin: 0 auto; max-width: calc(100% - 200px);">
          <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">${companySettings?.company_name || "NasQuest Resources Sdn Bhd"}</h1>
          <p style="margin: 0 0 6px 0; font-size: 13px; opacity: 0.9;">${companySettings?.department_name || "Technical Inspection Division"}</p>
          <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px; opacity: 0.95;">Platform Component Summary Report</h2>
          <p style="margin: 0; font-size: 11px; opacity: 0.85;">Structure: ${structure.str_name} (${structure.str_type}) | Report: ${companySettings?.serial_no || "N/A"}</p>
        </div>
      </div>

      <div style="padding: 20px;">

        <!-- Structure Info Tables -->
        ${headerContent}
        
        <!-- Statistics Table (Inventory Style Grid) -->
        <div style="margin-bottom: 30px;">
             <div style="background-color: #074e88; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              COMPONENT STATISTICS
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid #e2e8f0; border-top: none;">
                ${sortedTypes.map(code => {
      const typeName = resolveTypeName(code, typeMap);
      const displayLabel = (typeName !== code && !typeName.includes(`(${code})`)) ? `${typeName} (${code})` : typeName;

      return `
                    <div style="border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 10px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50px;">
                        <span style="font-size: 8px; font-weight: bold; color: #64748b; text-transform: uppercase; text-align: center; margin-bottom: 4px;">
                            ${displayLabel}
                        </span>
                        <span style="font-size: 14px; font-weight: bold; color: #1e293b;">${grouped[code].length}</span>
                    </div>
                   `;
    }).join('')}
                
                <!-- Total Box -->
                <div style="border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 10px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50px; background-color: #eff6ff;">
                    <span style="font-size: 8px; font-weight: bold; color: #64748b; text-transform: uppercase;">TOTAL ACTIVE</span>
                    <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">${components.length}</span>
                </div>
            </div>
        </div>

        <!-- Detailed Lists -->
        ${sortedTypes.map(code => {
      const typeName = resolveTypeName(code, typeMap);
      return `
            <div style="margin-bottom: 20px;">
                <div style="background-color: #e2e8f0; color: #1e293b; padding: 6px 10px; font-size: 10px; font-weight: bold;">
                  ${typeName} (${grouped[code].length})
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
                    <thead>
                        <tr style="background-color: #074e88; color: white;">
                             <th style="padding: 6px; text-align: center; width: 40px;">No.</th>
                             <th style="padding: 6px; text-align: left;">Q ID</th>
                             <th style="padding: 6px; text-align: left;">Type</th>
                             <th style="padding: 6px; text-align: left;">Node Path (S/E)</th>
                             <th style="padding: 6px; text-align: center;">Legs (S/E)</th>
                             <th style="padding: 6px; text-align: center;">Elev (1/2)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${grouped[code].map((c, idx) => {
        const meta = c.metadata || {};
        return `
                            <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? 'white' : '#f8fafc'};">
                                <td style="padding: 4px 6px; text-align: center;">${idx + 1}</td>
                                <td style="padding: 4px 6px; font-weight: bold;">${c.q_id || "-"}</td>
                                <td style="padding: 4px 6px;">${c.code || c.type || "-"}</td>
                                <td style="padding: 4px 6px;">${meta.s_node || "-"} > ${meta.f_node || "-"}</td>
                                <td style="padding: 4px 6px; text-align: center;">${meta.s_leg || "-"} - ${meta.f_leg || "-"}</td>
                                <td style="padding: 4px 6px; text-align: center;">${meta.elv_1 || "-"} / ${meta.elv_2 || "-"}</td>
                            </tr>
                        `;
      }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }).join('')}

         <!-- Footer -->
        <div style="margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #718096; display: flex; justify-content: space-between; align-items: center;">
          <span>${REPORT_FOOTER_APP_TEXT}</span>
          <span style="font-weight: 600; letter-spacing: 0.5px;">Page 1</span>
        </div>

      </div>
    </div>
  `;
};

export const generateComponentSpecReport = async (
  structure: StructureData,
  component: any,
  companySettings?: CompanySettings,
  typeMap?: Record<string, string>,
  config?: ReportConfig
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const autoTable = (doc as any).autoTable || autoTablePlugin;

  // Colors
  const headerBlue: [number, number, number] = [7, 78, 136];
  const sectionBlue: [number, number, number] = [7, 78, 136];
  const isPrintFriendly = config?.printFriendly === true;

  // ===== HEADER (3 SECTIONS: Contractor Logo | Middle Info | Client Logo) =====
  await draw3SectionHeader(doc, {
    pageWidth,
    companySettings,
    config,
    reportTitle: "Component Data Sheet",
    isPrintFriendly,
    headerBlue,
  });

  // Subheader: Structure Context
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Structure: ${structure.str_name} (${structure.str_type})`, 10, 35);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Component Type: ${resolveTypeName(component.type || component.code, typeMap)}`, 10, 40);

  let yPos = 48;

  const drawSectionHeader = (title: string, y: number) => {
    doc.setFillColor(...sectionBlue);
    doc.rect(10, y, pageWidth - 20, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title, 12, y + 4);
    return y + 8;
  };

  // 1. COMPONENT IDENTITY
  yPos = drawSectionHeader("1.0 COMPONENT IDENTITY", yPos);

  const meta = component.metadata || {};

  autoTable(doc, {
    startY: yPos,
    theme: 'grid',
    head: [],
    body: [
      ['Component ID', component.q_id || '-', 'Legacy ID', meta.tag_no || component.id || '-'],
      ['Name / Tag', meta.name || component.name || '-', 'Code', component.type || component.code || '-'],
      ['Status', component.is_deleted ? 'DELETED' : 'ACTIVE', 'Service', meta.service || '-']
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 40 },
      3: { cellWidth: 55 }
    },
    margin: { left: 10, right: 10 }
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // 2. TECHNICAL SPECIFICATIONS
  // Convert metadata to a clean list of attributes, ignoring internal fields
  const ignoreKeys = ['s_node', 'f_node', 's_leg', 'f_leg', 'elv_1', 'elv_2', 'name', 'tag_no', 'service'];
  const specs = Object.entries(meta)
    .filter(([key]) => !ignoreKeys.includes(key) && key !== 'file_url' && key !== 'id')
    .map(([key, value]) => {
      // Format key: "wall_thk" -> "Wall Thk"
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return [label, String(value)];
    });

  if (specs.length > 0) {
    yPos = drawSectionHeader("2.0 TECHNICAL SPECIFICATIONS", yPos);

    autoTable(doc, {
      startY: yPos,
      head: [['Property', 'Value']],
      body: specs,
      theme: 'striped',
      headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: 50 },
      columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
      margin: { left: 10, right: 10 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // 3. LOCATION & CONNECTIVITY
  if (meta.s_node || meta.f_node || meta.elv_1 || meta.s_leg) {
    yPos = drawSectionHeader("3.0 LOCATION & CONNECTIVITY", yPos);

    autoTable(doc, {
      startY: yPos,
      theme: 'grid',
      head: [],
      body: [
        ['Start Elevation', meta.elv_1 ? `${meta.elv_1} m` : '-', 'End Elevation', meta.elv_2 ? `${meta.elv_2} m` : '-'],
        ['Start Node', meta.s_node || '-', 'End Node', meta.f_node || '-'],
        ['Start Leg', meta.s_leg || '-', 'End Leg', meta.f_leg || '-'],
        ['Zone', meta.zone || '-', 'Deck Level', meta.deck_level || '-']
      ],
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 40 },
        1: { cellWidth: 55 },
        2: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 40 },
        3: { cellWidth: 55 }
      },
      margin: { left: 10, right: 10 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);
    doc.text(REPORT_FOOTER_APP_TEXT, 10, pageHeight - 6);
    if (config?.showPageNumbers !== false) {
      doc.text(`Page ${i}`, pageWidth - 10, pageHeight - 6, { align: "right" });
    }
  }

  applyWatermarkAndSignaturesGlobal(doc, config);

  if (config?.returnBlob) {
    return doc.output('blob');
  } else {
    const tag = component.q_id || meta.tag_no || "Component";
    doc.save(`${tag}_Spec_Sheet.pdf`);
  }
};

export const generateComponentSpecHTML = (
  structure: StructureData,
  component: any,
  companySettings?: CompanySettings,
  typeMap?: Record<string, string>
) => {
  const meta = component.metadata || {};
  const currentDate = new Date().toLocaleDateString();

  // Helper Styles
  const thStyle = "background-color: #074e88; color: white; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border: 1px solid #074e88;";
  const tdLabelStyle = "background-color: #f8fafc; color: #4a5568; padding: 6px 10px; font-size: 11px; font-weight: bold; border: 1px solid #e2e8f0; width: 25%;";
  const tdValueStyle = "color: #2d3748; padding: 6px 10px; font-size: 11px; border: 1px solid #e2e8f0; width: 25%;";
  const Row = (l1: string, v1: any, l2: string, v2: any) => `
    <tr>
        <td style="${tdLabelStyle}">${l1}</td>
        <td style="${tdValueStyle}">${v1 || '-'}</td>
        <td style="${tdLabelStyle}">${l2}</td>
        <td style="${tdValueStyle}">${v2 || '-'}</td>
    </tr>
  `;

  // Tech Specs logic
  const ignoreKeys = ['s_node', 'f_node', 's_leg', 'f_leg', 'elv_1', 'elv_2', 'name', 'tag_no', 'service'];
  const specs = Object.entries(meta)
    .filter(([key]) => !ignoreKeys.includes(key) && key !== 'file_url' && key !== 'id')
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 6px; font-weight: bold; color: #4a5568; border-right: 1px solid #eee;">${label}</td>
                <td style="padding: 6px; color: #2d3748;">${String(value)}</td>
            </tr>
          `;
    }).join('');

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); color: #333;">
      
      <!-- Header -->
      <div style="background-color: #074e88; color: white; padding: 20px 30px; position: relative;">
        <!-- Logo Position -->
        <div style="position: absolute; top: 15px; right: 30px;">
           ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 50px; height: 50px; object-fit: contain; padding: 2px;" />`
      : `<div style="border: 1px solid rgba(255,255,255,0.4); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">LOGO</div>`
    }
        </div>
        <div style="text-align: center; margin: 0 auto; max-width: calc(100% - 200px);">
          <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">${companySettings?.company_name || "Company Name"}</h1>
          <p style="margin: 0 0 6px 0; font-size: 13px; opacity: 0.9;">${companySettings?.department_name || "Engineering Department"}</p>
          <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">COMPONENT DATA SHEET</h2>
          <p style="margin: 0; font-size: 11px; opacity: 0.85;">Structure: ${structure.str_name} | Type: ${resolveTypeName(component.type || component.code, typeMap)}</p>
        </div>
      </div>

      <div style="padding: 24px;">

        <!-- 1.0 IDENTITY -->
        <div style="margin-bottom: 24px;">
            <div style="background-color: #074e88; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
                1.0 COMPONENT IDENTITY
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                    ${Row("Component ID", component.q_id, "Legacy ID", meta.tag_no || component.id)}
                    ${Row("Name / Tag", meta.name || component.name, "Code", component.type || component.code)}
                    ${Row("Status", component.is_deleted ? 'DELETED' : 'ACTIVE', "Service", meta.service)}
                </tbody>
            </table>
        </div>

        <!-- 2.0 SPECS -->
        ${specs ? `
        <div style="margin-bottom: 24px;">
            <div style="background-color: #074e88; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
                2.0 TECHNICAL SPECIFICATIONS
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #eee;">
                <thead>
                    <tr style="background-color: #edf2f7;">
                        <th style="padding: 6px; text-align: left; width: 40%;">Property</th>
                        <th style="padding: 6px; text-align: left;">Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${specs}
                </tbody>
            </table>
        </div>` : ''}

        <!-- 3.0 LOCATION -->
        ${(meta.s_node || meta.f_node) ? `
        <div style="margin-bottom: 24px;">
            <div style="background-color: #074e88; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
                3.0 LOCATION & CONNECTIVITY
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                    ${Row("Start Elev", meta.elv_1, "End Elev", meta.elv_2)}
                    ${Row("Start Node", meta.s_node, "End Node", meta.f_node)}
                    ${Row("Start Leg", meta.s_leg, "End Leg", meta.f_leg)}
                    ${Row("Zone", meta.zone, "Deck", meta.deck_level)}
                </tbody>
            </table>
        </div>` : ''}

        <div style="margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 9px; color: #1e293b; display: flex; justify-content: space-between;">
            <span>${REPORT_FOOTER_APP_TEXT}</span>
            <span>Page 1</span>
        </div>
      </div>
    </div>
  `;
};

export const generateTechnicalSpecsReport = async (
  structure: StructureData,
  companySettings?: CompanySettings,
  config?: ReportConfig
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const autoTable = (doc as any).autoTable || autoTablePlugin;

  // Colors
  const headerBlue: [number, number, number] = [7, 78, 136];
  const sectionBlue: [number, number, number] = [7, 78, 136];
  const isPrintFriendly = config?.printFriendly === true;

  // ===== HEADER (3 SECTIONS: Contractor Logo | Middle Info | Client Logo) =====
  await draw3SectionHeader(doc, {
    pageWidth,
    companySettings,
    config,
    reportTitle: "Technical Specifications Report",
    isPrintFriendly,
    headerBlue,
  });

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Structure: ${structure.str_name} (${structure.str_type})`, 10, 35);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Field: ${structure.field_name || structure.pfield || "N/A"}`, 10, 39);

  let yPos = 45;

  // Helper for Section Headers
  const drawSectionHeader = (title: string, y: number) => {
    doc.setFillColor(...sectionBlue);
    doc.rect(10, y, pageWidth - 20, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title, 12, y + 4);
    return y + 8;
  };

  // 1. DESIGN & GENERAL DATA
  yPos = drawSectionHeader("1.0 DESIGN & GENERAL DATA", yPos);

  autoTable(doc, {
    startY: yPos,
    theme: 'grid',
    head: [],
    body: [
      ['Structure Type', structure.str_type || '-', 'Installation Date', formatDisplayDate(structure.inst_date)],
      ['Function', structure.function || structure.process || '-', 'Design Life', structure.desg_life ? `${structure.desg_life} Years` : '-'],
      ['Water Depth', (structure.depth !== undefined && structure.depth !== null && String(structure.depth).trim() !== "") ? `${structure.depth} m` : '-', 'Manned Status', (structure.manned === "YES" || structure.manned === "Yes" || structure.manned === "1" || structure.manned === true) ? 'Manned' : 'Unmanned'],
      ['Contractor', structure.inst_contractor || structure.inst_ctr || '-', 'Helipad', (structure.helipad === "YES" || structure.helipad === "Yes" || structure.helipad === "1" || structure.helipad === true) ? 'Yes' : 'No'],
    ],
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 40 },
      3: { cellWidth: 55 }
    },
    margin: { left: 10, right: 10 }
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // 2. STRUCTURAL CONFIGURATION & MATERIALS
  yPos = drawSectionHeader("2.0 STRUCTURAL CONFIGURATION & MATERIALS", yPos);

  const maxLegDiaStr = (structure.max_leg_dia !== undefined && structure.max_leg_dia !== null && String(structure.max_leg_dia).trim() !== "") ? `${structure.max_leg_dia} mm` : (structure.dleg !== undefined && structure.dleg !== null && String(structure.dleg).trim() !== "" ? `${structure.dleg} mm` : '-');
  const maxWallThkStr = (structure.max_wall_thk !== undefined && structure.max_wall_thk !== null && String(structure.max_wall_thk).trim() !== "") ? `${structure.max_wall_thk} mm` : (structure.wall_thk !== undefined && structure.wall_thk !== null && String(structure.wall_thk).trim() !== "" ? `${structure.wall_thk} mm` : '-');

  autoTable(doc, {
    startY: yPos,
    theme: 'grid',
    head: [],
    body: [
      ['Number of Legs', structure.legs ? structure.legs.length : (structure.components?.filter((c: any) => c.type === 'LEG').length || '-'), 'Max Leg Diameter', maxLegDiaStr],
      ['Number of Piles', structure.skirt_piles || structure.internal_piles || structure.pileint || (structure.components?.filter((c: any) => c.type === 'PILE').length || '-'), 'Max Wall Thickness', maxWallThkStr],
      ['Material Grade', structure.material || 'N/A', 'Corrosion Cat.', structure.corr_ctg || '-'],
      ['CP System', structure.cp_system || '-', 'Unit System', structure.unit_system || structure.def_unit || '-'],
    ],
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 40 },
      3: { cellWidth: 55 }
    },
    margin: { left: 10, right: 10 }
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // 3. ELEVATION SCHEDULE
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }
  yPos = drawSectionHeader("3.0 ELEVATION SCHEDULE", yPos);

  const levels = structure.levels || [];
  const elevations = structure.elevations || [];

  // Combine levels and elevations for a comprehensive list
  const allElevations = [
    ...levels.map((l: any) => ({ desc: l.name || l.type, elv: l.elevation || l.u_elevation })),
    ...elevations.map((e: any) => ({ desc: e.name || e.type, elv: e.elevation }))
  ].filter(e => e.elv !== undefined && e.elv !== null).sort((a, b) => b.elv - a.elv); // Sort descending

  const elvBody = allElevations.length > 0 ? allElevations.map((e: any) => [e.desc, `${e.elv} m`]) : [['No Elevation Data', '-']];

  autoTable(doc, {
    startY: yPos,
    head: [['Level / Elevation Description', 'Elevation (m)']],
    body: elvBody,
    theme: 'striped',
    headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: 50 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 40, halign: 'center' } },
    margin: { left: 10, right: 10 }
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // 4. APPURTENANCES INVENTORY
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }
  yPos = drawSectionHeader("4.0 APPURTENANCES & INVENTORY", yPos);

  const inventory = [
    ['Risers', structure.risers || '-'],
    ['Conductors', structure.conductors || '-'],
    ['Caissons', structure.caissons || '-'],
    ['J-Tubes', structure.slots || '-'], // Assuming slots might refer to J-tubes or well slots
    ['Boat Landings', structure.components?.filter((c: any) => c.type === 'BOAT LANDING' || c.code === 'BO').length || '-'],
    ['Staircases', structure.components?.filter((c: any) => c.type === 'STAIR' || c.code === 'ST').length || '-'],
    ['Cranes', structure.cranes || '-'],
    ['Anodes', structure.anodes || structure.components?.filter((c: any) => c.type === 'ANODE' || c.code === 'AN').length || '-'],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Item Description', 'Quantity / Value']],
    body: inventory,
    theme: 'striped',
    headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: 50 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 40, halign: 'center' } },
    margin: { left: 10, right: 10 }
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);
    doc.text(REPORT_FOOTER_APP_TEXT, 10, pageHeight - 6);
    if (config?.showPageNumbers !== false) {
      doc.text(`Page ${i}`, pageWidth - 10, pageHeight - 6, { align: "right" });
    }
  }

  applyWatermarkAndSignaturesGlobal(doc, config);

  if (config?.returnBlob) {
    return doc.output('blob');
  } else {
    doc.save(`${structure.str_name.replace(/\s+/g, "_")}_Tech_Specs.pdf`);
  }
};

export const generateTechnicalSpecsHTML = (
  structure: StructureData,
  companySettings?: CompanySettings
): string => {
  const currentDate = new Date().toLocaleDateString();

  // Helpers
  const thStyle = "background-color: #074e88; color: white; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border: 1px solid #074e88;";
  const tdLabelStyle = "background-color: #f8fafc; color: #4a5568; padding: 6px 10px; font-size: 11px; font-weight: bold; border: 1px solid #e2e8f0; width: 20%;";
  const tdValueStyle = "color: #2d3748; padding: 6px 10px; font-size: 11px; border: 1px solid #e2e8f0; width: 30%;";

  const Row = (l1: string, v1: any, l2: string, v2: any) => `
    <tr>
        <td style="${tdLabelStyle}">${l1}</td>
        <td style="${tdValueStyle}">${v1 || '-'}</td>
        <td style="${tdLabelStyle}">${l2}</td>
        <td style="${tdValueStyle}">${v2 || '-'}</td>
    </tr>
  `;

  // Combined Elevations for HTML
  const levels = structure.levels || [];
  const elevations = structure.elevations || [];
  const allElevations = [
    ...levels.map((l: any) => ({ desc: l.name || l.type, elv: l.elevation || l.u_elevation })),
    ...elevations.map((e: any) => ({ desc: e.name || e.type, elv: e.elevation }))
  ].filter(e => e.elv !== undefined && e.elv !== null).sort((a, b) => b.elv - a.elv);

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); color: #333;">
      
      <!-- Header -->
      <div style="background-color: #074e88; color: white; padding: 20px 30px; position: relative;">
        <div style="position: absolute; top: 15px; right: 30px;">
          ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 50px; height: 50px; object-fit: contain; padding: 2px;" />`
      : `<div style="border: 1px solid rgba(255,255,255,0.4); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">LOGO</div>`
    }
        </div>
        <div style="text-align: center; margin: 0 auto; max-width: calc(100% - 200px);">
          <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">${companySettings?.company_name || "Company Name"}</h1>
          <p style="margin: 0 0 6px 0; font-size: 13px; opacity: 0.9;">${companySettings?.department_name || "Engineering Department"}</p>
          <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">Technical Specifications Report</h2>
          <p style="margin: 0; font-size: 11px; opacity: 0.85;">Structure: ${structure.str_name} (${structure.str_type})</p>
        </div>
      </div>

      <div style="padding: 24px;">

        <!-- 1.0 DESIGN DATA -->
        <div style="margin-bottom: 24px;">
            <div style="background-color: #074e88; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
                1.0 DESIGN & GENERAL DATA
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                    ${Row("Structure Type", structure.str_type, "Installation Date", formatDisplayDate(structure.inst_date))}
                    ${Row("Function", structure.function || structure.process, "Design Life", structure.desg_life ? structure.desg_life + " Years" : null)}
                    ${Row("Water Depth", (structure.depth !== undefined && structure.depth !== null && String(structure.depth).trim() !== "") ? structure.depth + " m" : null, "Manned Status", (structure.manned === "YES" || structure.manned === "Yes" || structure.manned === "1" || structure.manned === true) ? "Manned" : "Unmanned")}
                    ${Row("Contractor", structure.inst_contractor || structure.inst_ctr, "Helipad", (structure.helipad === "YES" || structure.helipad === "Yes" || structure.helipad === "1" || structure.helipad === true) ? "Yes" : "No")}
                </tbody>
            </table>
        </div>

        <!-- 2.0 CONFIGURATION -->
        <div style="margin-bottom: 24px;">
            <div style="background-color: #074e88; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
                2.0 STRUCTURAL CONFIGURATION & MATERIALS
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                     ${Row("Number of Legs", structure.legs?.length || structure.components?.filter((c: any) => c.type === 'LEG').length, "Max Leg Diameter", (structure.max_leg_dia !== undefined && structure.max_leg_dia !== null && String(structure.max_leg_dia).trim() !== "") ? structure.max_leg_dia + ' mm' : (structure.dleg !== undefined && structure.dleg !== null && String(structure.dleg).trim() !== "" ? structure.dleg + ' mm' : null))}
                     ${Row("Number of Piles", structure.skirt_piles || structure.internal_piles || structure.pileint, "Max Wall Thickness", (structure.max_wall_thk !== undefined && structure.max_wall_thk !== null && String(structure.max_wall_thk).trim() !== "") ? structure.max_wall_thk + ' mm' : (structure.wall_thk !== undefined && structure.wall_thk !== null && String(structure.wall_thk).trim() !== "" ? structure.wall_thk + ' mm' : null))}
                     ${Row("Material Grade", structure.material, "Corrosion Coating", structure.corr_ctg)}
                     ${Row("CP System", structure.cp_system, "Unit System", structure.unit_system || structure.def_unit)}
                </tbody>
            </table>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- 3.0 ELEVATIONS -->
            <div>
                <div style="background-color: #074e88; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
                    3.0 ELEVATION SCHEDULE
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background-color: #edf2f7;">
                            <th style="padding: 6px; text-align: left; border-bottom: 2px solid #e2e8f0;">Level Description</th>
                            <th style="padding: 6px; text-align: right; border-bottom: 2px solid #e2e8f0;">Elevation (m)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allElevations.length > 0 ? allElevations.map((e: any, i) => `
                            <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${i % 2 === 0 ? 'white' : '#f8fafc'};">
                                <td style="padding: 6px;">${e.desc}</td>
                                <td style="padding: 6px; text-align: right; font-weight: bold;">${e.elv} m</td>
                            </tr>
                        `).join('') : `<tr><td colspan="2" style="padding: 8px; text-align: center; color: #718096;">No Elevation Data</td></tr>`}
                    </tbody>
                </table>
            </div>

            <!-- 4.0 INVENTORY -->
            <div>
                 <div style="background-color: #074e88; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
                    4.0 APPURTENANCES INVENTORY
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                     <thead>
                        <tr style="background-color: #edf2f7;">
                            <th style="padding: 6px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item Description</th>
                            <th style="padding: 6px; text-align: center; border-bottom: 2px solid #e2e8f0;">Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">Risers</td><td style="padding: 6px; text-align: center; font-weight: bold;">${structure.risers || "-"}</td></tr>
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">Conductors</td><td style="padding: 6px; text-align: center; font-weight: bold;">${structure.conductors || "-"}</td></tr>
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">Caissons</td><td style="padding: 6px; text-align: center; font-weight: bold;">${structure.caissons || "-"}</td></tr>
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">J-Tubes/Slots</td><td style="padding: 6px; text-align: center; font-weight: bold;">${structure.slots || "-"}</td></tr>
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">Boat Landings</td><td style="padding: 6px; text-align: center; font-weight: bold;">${structure.components?.filter((c: any) => c.type === 'BOAT LANDING' || c.code === 'BO').length || "-"}</td></tr>
                        <tr><td style="padding: 6px; border-bottom: 1px solid #eee;">Cranes</td><td style="padding: 6px; text-align: center; font-weight: bold;">${structure.cranes || "-"}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div style="margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 9px; color: #1e293b; display: flex; justify-content: space-between;">
            <span>${REPORT_FOOTER_APP_TEXT}</span>
            <span>Page 1</span>
        </div>

      </div>
    </div>
  `;
};
