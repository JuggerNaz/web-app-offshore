import jsPDF from "jspdf";
import "jspdf-autotable";

// Helper to load image for PDF
const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg"));
      } else {
        reject(new Error("Canvas context is null"));
      }
    };
    img.onerror = (e) => reject(e);
  });
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
  pfield?: string;
  depth?: number;
  desg_life?: number;
  inst_date?: string;
  northing?: number;
  easting?: number;
  true_north_angle?: number;
  platform_north_side?: string;
  ptype?: string;
  function?: string;
  material?: string;
  cp_system?: string;
  corr_ctg?: string;
  inst_contractor?: string;
  max_leg_dia?: number;
  max_wall_thk?: number;
  helipad?: string;
  manned?: string;
  // Extended inventory fields
  conductors?: number;
  internal_piles?: number;
  slots?: string;
  fenders?: number;
  risers?: number;
  sumps?: number;
  skirt_piles?: number;
  caissons?: number;
  anodes?: number;
  cranes?: number;
  unit_system?: string;
  levels?: any[];
  legs?: any[];
  elevations?: any[];
  faces?: any[];
  discussions?: any[];
  visuals?: any[];
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
  reviewedBy: { name: string; date: string };
  approvedBy: { name: string; date: string };
  watermark: { enabled: boolean; text: string; transparency: number };
  showContractorLogo: boolean;
  showPageNumbers: boolean;
  returnBlob?: boolean;
}

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
  const headerBlue: [number, number, number] = [26, 54, 93];
  const sectionBlue: [number, number, number] = [44, 82, 130];

  // ===== HEADER WITH LOGO =====
  doc.setFillColor(...headerBlue);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Logo area (right side)
  if (companySettings?.logo_url) {
    try {
      // Load and add the actual logo image with padding
      const logoData = await loadImage(companySettings.logo_url);
      // Box is 18x18, logo is 16x16 with 1mm padding on each side
      doc.addImage(logoData, 'PNG', pageWidth - 24, 5, 16, 16);
    } catch (error) {
      console.error("Error loading company logo:", error);
      // Fallback to placeholder box if image fails to load
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.rect(pageWidth - 25, 4, 18, 18);
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text("LOGO", pageWidth - 16, 13.5, { align: "center" });
    }
  }

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const companyName = companySettings?.company_name || "NasQuest Resources Sdn Bhd";
  doc.text(companyName, 10, 9);

  // Department Name
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(companySettings?.department_name || "Engineering Department", 10, 14);

  // Report Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PIPELINE SPECIFICATIONS REPORT", 10, 20);

  // Subtitle and Report No
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Comprehensive Structure Assessment & Data Sheet", 10, 24);

  if (config) {
    const reportNo = `${config.reportNoPrefix}-${config.reportYear}-${structure.str_id}`;
    doc.text(`Report: ${reportNo}`, pageWidth - 10, 24, { align: "right" });
  } else if (companySettings?.serial_no) {
    doc.text(`Report: ${companySettings.serial_no}`, pageWidth - 10, 24, { align: "right" });
  }

  let yPos = 32;

  // Define autoTable helper for jsPDF
  const autoTable = (doc as any).autoTable || require('jspdf-autotable').default;

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
  doc.setFillColor(...sectionBlue);
  doc.rect(col1X, yPos, colWidth, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("GENERAL INFO", col1X + 2, yPos + 3.5);

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
  doc.setFillColor(...sectionBlue);
  doc.rect(col2X, yPos, colWidth, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("TECHNICAL PARAMS", col2X + 2, yPos + 3.5);

  let col2Y = yPos + 5;
  const techStart = col2Y;

  col2Y = drawCompactField("Outer Dia:", (structure as any).od ? `${(structure as any).od} in` : "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Wall Thick:", (structure as any).wall_thickness ? `${(structure as any).wall_thickness} mm` : "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Total Length:", (structure as any).plength ? `${(structure as any).plength} m` : "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Material:", structure.material || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("CP System:", structure.cp_system || "N/A", col2X, col2Y, colWidth);

  doc.rect(col2X, techStart, colWidth, col2Y - techStart);

  // COLUMN 3: Location & Path
  doc.setFillColor(...sectionBlue);
  doc.rect(col3X, yPos, colWidth, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("LOCATION & PATH", col3X + 2, yPos + 3.5);

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
  doc.setFillColor(...sectionBlue);
  doc.rect(10, yPos, pageWidth - 20, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("BURIAL & PROTECTION", 12, yPos + 3.5);
  yPos += 5;

  const burialStart = yPos;
  const burialWidth = pageWidth - 20; // Full width

  yPos = drawCompactField("Burial Status:", (structure as any).burial_status || "N/A", 10, yPos, burialWidth);
  yPos = drawCompactField("Protection Method:", (structure as any).protection_method || "N/A", 10, yPos, burialWidth);
  yPos = drawCompactField("Coating:", structure.corr_ctg || "N/A", 10, yPos, burialWidth);

  doc.rect(10, burialStart, pageWidth - 20, yPos - burialStart);
  yPos += 3;

  // ===== GEODETIC PARAMETERS (Full Width) =====
  doc.setFillColor(...sectionBlue);
  doc.rect(10, yPos, pageWidth - 20, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("GEODETIC PARAMETERS", 12, yPos + 3.5);
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

  // ===== COMMENTS =====
  if ((structure.comments || structure.description) && yPos < pageHeight - 20) {
    doc.setFillColor(...sectionBlue);
    doc.rect(10, yPos, pageWidth - 20, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("COMMENTS", 12, yPos + 3);

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

  // ===== FOOTER =====
  const footerY = pageHeight - 8;
  doc.setDrawColor(sectionBlue[0], sectionBlue[1], sectionBlue[2]);
  doc.setLineWidth(0.3);
  doc.line(10, footerY - 3, pageWidth - 10, footerY - 3);

  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 10, footerY);
  doc.text("CONFIDENTIAL", pageWidth - 10, footerY, { align: "right" });

  // ===== NEW CONFIGURATION FEATURES =====
  if (config) {
    // Watermark
    if (config.watermark?.enabled) {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: config.watermark.transparency || 0.1 }));
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(60);
      doc.text(config.watermark.text, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
      doc.restoreGraphicsState();
    }

    // Signatures
    const hasSignatures = config.preparedBy?.name || config.reviewedBy?.name || config.approvedBy?.name;
    if (hasSignatures) {
      // Create a signature block area at the bottom, shifting footer up or overlaying
      const sigY = pageHeight - 25; // Area above footer

      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);

      const sigWidth = (pageWidth - 20) / 3;

      if (config.preparedBy.name) {
        doc.text("Prepared By:", 10, sigY);
        doc.text(config.preparedBy.name, 10, sigY + 5);
        doc.text(config.preparedBy.date || "", 10, sigY + 9);
        doc.line(10, sigY + 10, 10 + sigWidth - 5, sigY + 10);
      }

      if (config.reviewedBy.name) {
        const x = 10 + sigWidth;
        doc.text("Reviewed By:", x, sigY);
        doc.text(config.reviewedBy.name, x, sigY + 5);
        doc.text(config.reviewedBy.date || "", x, sigY + 9);
        doc.line(x, sigY + 10, x + sigWidth - 5, sigY + 10);
      }

      if (config.approvedBy.name) {
        const x = 10 + (sigWidth * 2);
        doc.text("Approved By:", x, sigY);
        doc.text(config.approvedBy.name, x, sigY + 5);
        doc.text(config.approvedBy.date || "", x, sigY + 9);
        doc.line(x, sigY + 10, x + sigWidth - 5, sigY + 10);
      }
    }
  }

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
  const headerBlue: [number, number, number] = [26, 54, 93];
  const sectionBlue: [number, number, number] = [44, 82, 130];

  // ===== HEADER WITH LOGO =====
  doc.setFillColor(...headerBlue);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Logo area (right side) - Bigger Square layout
  if (companySettings?.logo_url) {
    try {
      // Load and add the actual logo image with padding
      const logoData = await loadImage(companySettings.logo_url);
      // Box is 18x18, logo is 16x16 with 1mm padding on each side
      doc.addImage(logoData, 'PNG', pageWidth - 24, 5, 16, 16);
    } catch (error) {
      console.error("Error loading company logo:", error);
      // Fallback to placeholder box if image fails to load
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.rect(pageWidth - 25, 4, 18, 18);
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text("LOGO", pageWidth - 16, 13.5, { align: "center" });
    }
  }

  // Company Name - LARGEST (left side)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const companyName = companySettings?.company_name || "NasQuest Resources Sdn Bhd";
  doc.text(companyName, 10, 9);

  // Department Name - Under Company Name
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(companySettings?.department_name || "Engineering Department", 10, 14);

  // Report Title - SMALLER
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PLATFORM SPECIFICATIONS REPORT", 10, 20);

  // Subtitle and Report No on same line
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Comprehensive Structure Assessment & Data Sheet", 10, 24);

  if (config) {
    const reportNo = `${config.reportNoPrefix}-${config.reportYear}-${structure.str_id}`;
    doc.text(`Report: ${reportNo}`, pageWidth - 10, 24, { align: "right" });
  } else if (companySettings?.serial_no) {
    doc.text(`Report: ${companySettings.serial_no}`, pageWidth - 10, 24, { align: "right" });
  }

  let yPos = 32;

  // Define autoTable helper for jsPDF
  const autoTable = (doc as any).autoTable || require('jspdf-autotable').default;

  // Helper function for compact field rendering
  const drawCompactField = (label: string, value: string, x: number, y: number, width: number) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(label, x + 1, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const valX = x + (width * 0.42);
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
  doc.setFillColor(...sectionBlue);
  doc.rect(col1X, yPos, colWidth, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("GENERAL INFO", col1X + 2, yPos + 3.5);

  let col1Y = yPos + 5;
  doc.setDrawColor(200, 200, 200);
  const genStart = col1Y;

  col1Y = drawCompactField("Structure:", structure.str_name || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Title:", structure.title || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Field:", structure.pfield || structure.field_name || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Install Date:", structure.inst_date || "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Depth:", structure.depth ? `${structure.depth} m` : "N/A", col1X, col1Y, colWidth);
  col1Y = drawCompactField("Design Life:", structure.desg_life ? `${structure.desg_life} yrs` : "N/A", col1X, col1Y, colWidth);

  doc.rect(col1X, genStart, colWidth, col1Y - genStart);

  // COLUMN 2: Configuration
  doc.setFillColor(...sectionBlue);
  doc.rect(col2X, yPos, colWidth, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CONFIGURATION", col2X + 2, yPos + 3.5);

  let col2Y = yPos + 5;
  const configStart = col2Y;

  col2Y = drawCompactField("Type:", structure.ptype || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Function:", structure.function || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Material:", structure.material || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("CP System:", structure.cp_system || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Corrosion:", structure.corr_ctg || "N/A", col2X, col2Y, colWidth);
  col2Y = drawCompactField("Contractor:", structure.inst_contractor || "N/A", col2X, col2Y, colWidth);

  doc.rect(col2X, configStart, colWidth, col2Y - configStart);

  // COLUMN 3: Location & Dimensions
  doc.setFillColor(...sectionBlue);
  doc.rect(col3X, yPos, colWidth, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("LOCATION & DIMS", col3X + 2, yPos + 3.5);

  let col3Y = yPos + 5;
  const locStart = col3Y;

  col3Y = drawCompactField("Northing:", structure.northing ? `${structure.northing} m` : "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("Easting:", structure.easting ? `${structure.easting} m` : "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("True North:", structure.true_north_angle ? `${structure.true_north_angle}°` : "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("Max Leg Dia:", structure.max_leg_dia ? `${structure.max_leg_dia} mm` : "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("Max Wall:", structure.max_wall_thk ? `${structure.max_wall_thk} mm` : "N/A", col3X, col3Y, colWidth);
  col3Y = drawCompactField("Helipad:", structure.helipad === "YES" || structure.helipad === "Yes" ? "Yes" : "No", col3X, col3Y, colWidth);

  doc.rect(col3X, locStart, colWidth, col3Y - locStart);

  yPos = Math.max(col1Y, col2Y, col3Y) + 5;

  // ===== STRUCTURE VISUALS =====
  const photos: string[] = [];
  if (structure.photo_url) photos.push(structure.photo_url);
  if (structure.photos) photos.push(...structure.photos.map(p => p.url));
  if (structure.visuals) photos.push(...structure.visuals.map((v: any) => v.url || v.file_url || v.meta?.file_url || v)); // Handle visuals if string or object

  // Filter unique valid URLs
  const uniquePhotos = Array.from(new Set(photos.filter(url => typeof url === 'string' && url.length > 0))).slice(0, 3);

  if (uniquePhotos.length > 0) {
    doc.setFillColor(...sectionBlue);
    doc.rect(10, yPos, pageWidth - 20, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`STRUCTURE VISUALS (${uniquePhotos.length})`, 12, yPos + 3.5);
    yPos += 5;

    const gap = 5;
    const totalWidth = pageWidth - 20;
    const imgWidth = (totalWidth - (gap * (uniquePhotos.length - 1))) / uniquePhotos.length;
    const imgHeight = 60;

    let currentX = 10;
    const padding = 1; // Inner padding for border

    // Load all images
    const imagePromises = uniquePhotos.map(url => loadImage(url).catch(e => null));
    try {
      const loadedImages = await Promise.all(imagePromises);

      loadedImages.forEach((imgData) => {
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
        currentX += imgWidth + gap;
      });

      yPos += imgHeight + 5;

    } catch (err) {
      console.error("Critical error in image section", err);
      yPos += 10;
    }
  }

  // ===== INVENTORY STATISTICS (Full Width, Compact Grid) =====
  doc.setFillColor(...sectionBlue);
  doc.rect(10, yPos, pageWidth - 20, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("INVENTORY STATISTICS", 12, yPos + 3.5);
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

    doc.setFillColor(...sectionBlue);
    doc.rect(10, yPos, pageWidth - 20, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`PLATFORM LEGS (${structure.legs.length} Active)`, 12, yPos + 3.5);
    yPos += 5;

    // Display legs in compact grid
    const legColWidth = (pageWidth - 20) / 10;
    const legRowHeight = 9;
    const numRows = Math.ceil(Math.min(structure.legs.length, 20) / 10);

    doc.setDrawColor(200, 200, 200);
    doc.rect(10, yPos, pageWidth - 20, numRows * legRowHeight);

    structure.legs.slice(0, 20).forEach((leg: any, idx: number) => {
      const col = idx % 10;
      const row = Math.floor(idx / 10);
      const x = 10 + (col * legColWidth);
      const y = yPos + (row * legRowHeight);

      if (col > 0) doc.line(x, y, x, y + legRowHeight);
      if (row > 0) doc.line(10, y, pageWidth - 10, y);

      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(`Leg ${idx + 1}`, x + legColWidth / 2, y + 3, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(leg.leg_name || leg.designation || `L${idx + 1}`, x + legColWidth / 2, y + 7, { align: "center" });
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
      doc.setFillColor(...sectionBlue);
      doc.rect(10, tablesStartY, (pageWidth - 25) / 2, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("ELEVATIONS (m)", 12, tablesStartY + 3.5);

      const elevWidth = (pageWidth - 25) / 2;
      autoTable(doc, {
        startY: tablesStartY + 5,
        head: [['Type', 'Value (m)']],
        body: (structure.elevations || []).slice(0, 6).map((elev: any) => [
          elev.orient || elev.name || elev.type || "Elevation",
          elev.elv || elev.value || elev.elevation || "N/A"
        ]),
        theme: 'grid',
        headStyles: { fillColor: sectionBlue, fontSize: 7, halign: 'center' },
        bodyStyles: { fontSize: 6, halign: 'center' },
        margin: { left: 10 },
        tableWidth: elevWidth,
        styles: { cellPadding: 1 }
      });
      maxTableY = Math.max(maxTableY, (doc as any).lastAutoTable.finalY);
    }

    // LEVELS TABLE (Right)
    if (hasLevels) {
      // Start slightly right of center (pageWidth/2 + 2.5) to create 5mm gap
      const rightTableX = pageWidth / 2 + 2.5;

      doc.setFillColor(...sectionBlue);
      doc.rect(rightTableX, tablesStartY, (pageWidth - 25) / 2, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("PLATFORM LEVELS", rightTableX + 2, tablesStartY + 3.5);

      autoTable(doc, {
        startY: tablesStartY + 5,
        head: [['Level', 'Start', 'End']],
        body: (structure.levels || []).slice(0, 6).map((level: any) => [
          level.level_name || "Level",
          level.elv_from || level.start_elv || 0,
          level.elv_to || level.end_elv || 0
        ]),
        theme: 'grid',
        headStyles: { fillColor: sectionBlue, fontSize: 7, halign: 'center' },
        bodyStyles: { fontSize: 6, halign: 'center' },
        margin: { left: rightTableX },
        tableWidth: (pageWidth - 25) / 2,
        styles: { cellPadding: 1 }
      });
      maxTableY = Math.max(maxTableY, (doc as any).lastAutoTable.finalY);
    }
    yPos = maxTableY + 3;
  }

  // ===== FACES (if available) =====
  if (structure.faces && structure.faces.length > 0) {
    if (yPos > pageHeight - 30) { doc.addPage(); yPos = 15; }

    doc.setFillColor(...sectionBlue);
    doc.rect(10, yPos, pageWidth - 20, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("PLATFORM FACES", 12, yPos + 3.5);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [['Face Name', 'From', 'To']],
      body: structure.faces.slice(0, 4).map((face: any) => [
        face.face || face.face_name || face.name || "Face",
        face.face_from || face.from || "N/A",
        face.face_to || face.to || "N/A"
      ]),
      theme: 'grid',
      headStyles: { fillColor: sectionBlue, fontSize: 7, halign: 'center' },
      bodyStyles: { fontSize: 6, halign: 'center' },
      margin: { left: 10, right: 10 },
      tableWidth: 'auto',
      styles: { cellPadding: 1.5 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 3;
  }

  // ===== COMMENTS (if space available) =====
  if ((structure.comments || structure.description) && yPos < pageHeight - 30) {
    doc.setFillColor(...sectionBlue);
    doc.rect(10, yPos, pageWidth - 20, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("COMMENTS", 12, yPos + 3);

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

  // ===== FOOTER =====
  const footerY = pageHeight - 8;
  doc.setDrawColor(sectionBlue[0], sectionBlue[1], sectionBlue[2]);
  doc.setLineWidth(0.3);
  doc.line(10, footerY - 3, pageWidth - 10, footerY - 3);

  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 10, footerY);
  doc.text("CONFIDENTIAL", pageWidth - 10, footerY, { align: "right" });

  // ===== NEW CONFIGURATION FEATURES =====
  if (config) {
    // Watermark
    if (config.watermark?.enabled) {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: config.watermark.transparency || 0.1 }));
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(60);
      const text = config.watermark.text;
      // Center on page
      const textWidth = doc.getTextWidth(text);
      const textX = pageWidth / 2;
      const textY = pageHeight / 2;
      doc.text(text, textX, textY, { align: 'center', angle: 45 });
      doc.restoreGraphicsState();
    }

    // Signatures
    const hasSignatures = config.preparedBy?.name || config.reviewedBy?.name || config.approvedBy?.name;
    if (hasSignatures) {
      const sigY = pageHeight - 25;

      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);

      const sigWidth = (pageWidth - 20) / 3;

      if (config.preparedBy.name) {
        doc.text("Prepared By:", 10, sigY);
        doc.text(config.preparedBy.name, 10, sigY + 5);
        doc.text(config.preparedBy.date || "", 10, sigY + 9);
        doc.line(10, sigY + 10, 10 + sigWidth - 5, sigY + 10);
      }

      if (config.reviewedBy.name) {
        const x = 10 + sigWidth;
        doc.text("Reviewed By:", x, sigY);
        doc.text(config.reviewedBy.name, x, sigY + 5);
        doc.text(config.reviewedBy.date || "", x, sigY + 9);
        doc.line(x, sigY + 10, x + sigWidth - 5, sigY + 10);
      }

      if (config.approvedBy.name) {
        const x = 10 + (sigWidth * 2);
        doc.text("Approved By:", x, sigY);
        doc.text(config.approvedBy.name, x, sigY + 5);
        doc.text(config.approvedBy.date || "", x, sigY + 9);
        doc.line(x, sigY + 10, x + sigWidth - 5, sigY + 10);
      }
    }
  }

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
      <div style="background-color: #1a365d; color: white; padding: 20px 30px; position: relative;">
        <div style="position: absolute; top: 15px; right: 30px;">
          ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border: 2px solid white; padding: 4px; background: white;" />`
      : `<div style="border: 2px solid white; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">LOGO</div>`
    }
        </div>
        
        <div style="padding-right: 100px;">
          <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">${companySettings?.company_name || "NasQuest Resources Sdn Bhd"}</h1>
          <p style="margin: 0 0 12px 0; font-size: 11px; opacity: 0.9;">${companySettings?.department_name || "Engineering Department"}</p>
          <h2 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; opacity: 0.95;">PIPELINE SPECIFICATIONS REPORT</h2>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <p style="margin: 0; font-size: 11px; opacity: 0.85; font-weight: 300;">Comprehensive Structure Assessment & Data Sheet</p>
            <p style="margin: 0; font-size: 9px; opacity: 0.8;">Report: ${companySettings?.serial_no || "N/A"}</p>
          </div>
        </div>
      </div>

      <div style="padding: 20px;">
        
        <!-- Three Column Layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          
          <!-- Column 1: General Info -->
          <div>
            <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
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
            <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
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
            <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
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
          <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
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
          <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
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
          <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Additional Comments
          </div>
          <div style="border: 1px solid #cbd5e0; border-top: none; padding: 10px; font-size: 9px; color: #2d3748; background: #fdfdfd; min-height: 30px;">
            ${structure.comments || structure.description || "No additional comments provided."}
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #718096; display: flex; justify-content: space-between; align-items: center;">
          <span>Generated: ${currentDate}</span>
          <span style="font-weight: 600; letter-spacing: 0.5px;">CONFIDENTIAL - INTERNAL USE ONLY</span>
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
      <div style="background-color: #1a365d; color: white; padding: 20px 30px; position: relative;">
        <!-- Logo positioned at far right - BIGGER -->
        <div style="position: absolute; top: 15px; right: 30px;">
          ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border: 2px solid white; padding: 4px; background: white;" />`
      : `<div style="border: 2px solid white; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">LOGO</div>`
    }
        </div>
        
        <!-- Title and company info with more space -->
        <div style="padding-right: 100px;">
          <!-- Company Name - LARGEST -->
          <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">${companySettings?.company_name || "NasQuest Resources Sdn Bhd"}</h1>
          
          <!-- Department Name - Under Company Name -->
          <p style="margin: 0 0 12px 0; font-size: 11px; opacity: 0.9;">${companySettings?.department_name || "Engineering Department"}</p>
          
          <!-- Report Title - SMALLER -->
          <h2 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; opacity: 0.95;">PLATFORM SPECIFICATIONS REPORT</h2>
          
          <!-- Subtitle and Report No on same line -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <p style="margin: 0; font-size: 11px; opacity: 0.85; font-weight: 300;">Comprehensive Structure Assessment & Data Sheet</p>
            <p style="margin: 0; font-size: 9px; opacity: 0.8;">Report: ${companySettings?.serial_no || "N/A"}</p>
          </div>
        </div>
      </div>

      <div style="padding: 20px;">
        
        <!-- Platform Picture (Dynamic: 1, 2, or 3+ photos) -->
        ${((structure.photos && structure.photos.length > 0) || (structure.photo_url && typeof structure.photo_url === 'string' && structure.photo_url.trim().length > 0)) ? `
          <div style="margin-bottom: 20px;">
            <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              Structure Visual${structure.photos && structure.photos.length > 1 ? `s (${structure.photos.length})` : ''}
            </div>
            <div style="border: 1px solid #cbd5e0; border-top: none; padding: 15px; background: #f8fafc; text-align: center;">
              <div style="display: flex; justify-content: center; align-items: center; gap: 15px; flex-wrap: wrap;">
                ${structure.photos && structure.photos.length > 0
        ? structure.photos.map((photo: any) => {
          const photoCount = structure.photos?.length || 0;
          let width = '100%';
          if (photoCount === 2) width = '48%';
          else if (photoCount === 3) width = '30%';
          else if (photoCount >= 4) width = '23%';
          return `<img src="${photo.url}" alt="${photo.name || 'Platform Visual'}" style="max-width: ${width}; max-height: 300px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 4px;" />`;
        }).join('')
        : `<img src="${structure.photo_url}" style="max-width: 100%; max-height: 300px; object-fit: contain;" />`
      }
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Three Column Layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          
          <!-- Column 1: General Info -->
          <div>
            <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              General Info
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <tbody>
                ${[
      ["Structure", structure.str_name],
      ["Title", structure.title],
      ["Field", structure.pfield || structure.field_name],
      ["Install Date", structure.inst_date],
      ["Depth", structure.depth ? `${structure.depth} m` : "N/A"],
      ["Design Life", structure.desg_life ? `${structure.desg_life} yrs` : "N/A"]
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
            <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              Configuration
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <tbody>
                ${[
      ["Type", structure.ptype],
      ["Function", structure.function],
      ["Material", structure.material],
      ["CP System", structure.cp_system],
      ["Corrosion", structure.corr_ctg],
      ["Contractor", structure.inst_contractor]
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
            <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              Location & Dims
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
              <tbody>
                ${[
      ["Northing", structure.northing ? `${structure.northing} m` : "N/A"],
      ["Easting", structure.easting ? `${structure.easting} m` : "N/A"],
      ["True North", structure.true_north_angle ? `${structure.true_north_angle}°` : "N/A"],
      ["Max Leg Dia", structure.max_leg_dia ? `${structure.max_leg_dia} mm` : "N/A"],
      ["Max Wall", structure.max_wall_thk ? `${structure.max_wall_thk} mm` : "N/A"],
      ["Helipad", structure.helipad === "YES" || structure.helipad === "Yes" ? "Yes" : "No"]
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
          <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Inventory Statistics
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e0; border-top: none;">
            <tbody>
              <tr style="background-color: #ffffff;">
                ${[
      ["Conductors", structure.conductors || 0],
      ["Int. Piles", structure.internal_piles || 0],
      ["Slots", structure.slots || "N/A"],
      ["Fenders", structure.fenders || 0],
      ["Risers", structure.risers || 0]
    ].map(([label, value]) => `
                  <td style="padding: 8px; text-align: center; border-right: 1px solid #e2e8f0;">
                    <div style="font-weight: 600; color: #718096; font-size: 8px; text-transform: uppercase; margin-bottom: 2px;">${label}</div>
                    <div style="font-size: 14px; font-weight: 700; color: #2c5282;">${value}</div>
                  </td>
                `).join('')}
              </tr>
               <tr style="background-color: #f7fafc;">
                ${[
      ["Sumps", structure.sumps || 0],
      ["Skirt Piles", structure.skirt_piles || 0],
      ["Caissons", structure.caissons || 0],
      ["Anodes", structure.anodes || 0],
      ["Cranes", structure.cranes || 0]
    ].map(([label, value]) => `
                  <td style="padding: 8px; text-align: center; border-right: 1px solid #e2e8f0;">
                    <div style="font-weight: 600; color: #718096; font-size: 8px; text-transform: uppercase; margin-bottom: 2px;">${label}</div>
                    <div style="font-size: 14px; font-weight: 700; color: #2c5282;">${value}</div>
                  </td>
                `).join('')}
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Platform Legs (ALWAYS SHOW) -->
        <div style="margin-bottom: 15px;">
          <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Platform Legs ${structure.legs && structure.legs.length > 0 ? `(${structure.legs.length} Active)` : ''}
          </div>
          <div style="border: 1px solid #cbd5e0; border-top: none; padding: 10px; min-height: 60px; ${structure.legs && structure.legs.length > 0 ? 'display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px;' : 'display: flex; align-items: center; justify-content: center; background: #f8fafc;'}">
            ${structure.legs && structure.legs.length > 0
      ? structure.legs.slice(0, 20).map((leg: any, idx: number) => `
                <div style="text-align: center; padding: 5px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <div style="font-size: 7px; color: #718096;">Leg ${idx + 1}</div>
                  <div style="font-size: 10px; font-weight: 700; color: #2c5282;">${leg.leg_name || leg.designation || `L${idx + 1}`}</div>
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
            <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
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
            <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
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
          <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
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
          <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Additional Comments
          </div>
          <div style="border: 1px solid #cbd5e0; border-top: none; padding: 10px; font-size: 9px; color: #2d3748; background: #fdfdfd; min-height: 30px;">
            ${structure.comments || structure.description || "No additional comments provided."}
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #718096; display: flex; justify-content: space-between; align-items: center;">
          <span>Generated: ${currentDate}</span>
          <span style="font-weight: 600; letter-spacing: 0.5px;">CONFIDENTIAL - INTERNAL USE ONLY</span>
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
  const autoTable = (doc as any).autoTable || require('jspdf-autotable').default;

  // Colors
  const headerBlue: [number, number, number] = [26, 54, 93];
  const sectionBlue: [number, number, number] = [44, 82, 130];
  const lightBlue: [number, number, number] = [235, 242, 250];

  // ===== HEADER =====
  doc.setFillColor(...headerBlue);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Logo
  if (companySettings?.logo_url) {
    try {
      const logoData = await loadImage(companySettings.logo_url).catch(() => null);
      if (logoData) {
        doc.addImage(logoData, 'PNG', pageWidth - 25, 4, 18, 18);
      } else {
        doc.setDrawColor(255, 255, 255);
        doc.rect(pageWidth - 25, 4, 18, 18);
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text("LOGO", pageWidth - 16, 13.5, { align: "center" });
      }
    } catch (e) { /* ignore */ }
  }

  // Company Headings
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companySettings?.company_name || "Company Name", 10, 10);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(companySettings?.department_name || "Engineering Department", 10, 16);

  // Report Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("COMPONENT SUMMARY REPORT", 10, 24);

  // Subtitle
  doc.setFontSize(10);
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
        ['Structure', structure.str_name || '-'],
        ['Title', structure.title || structure.str_name || '-'],
        ['Field', structure.field_name || structure.pfield || '-'],
        ['Install Date', structure.inst_date || '-'],
        ['Depth', structure.depth ? `${structure.depth} m` : '-'],
        ['Design Life', structure.desg_life ? `${structure.desg_life} yrs` : '-']
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
        ['Function', structure.function || '-'],
        ['Material', structure.material || '-'],
        ['CP System', structure.cp_system || '-'],
        ['Corrosion', structure.corr_ctg || '-'],
        ['Contractor', structure.inst_contractor || '-']
      ],
      theme: 'grid',
      headStyles: { fillColor: sectionBlue, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7, textColor: 50, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } },
      tableWidth: tableWidth,
      showHead: 'firstPage'
    });

    // Table 3: Location & Dims
    autoTable(doc, {
      startY: infoY,
      margin: { left: 10 + (tableWidth + colGap) * 2 },
      head: [['LOCATION & DIMS', '']],
      body: [
        ['Northing', structure.northing || 'N/A'],
        ['Easting', structure.easting || 'N/A'],
        ['True North', structure.true_north_angle || 'N/A'],
        ['Max Leg Dia', structure.max_leg_dia || 'N/A'],
        ['Max Wall', structure.max_wall_thk || 'N/A'],
        ['Helipad', structure.helipad || 'No']
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
  doc.setTextColor(26, 54, 93);
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
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    const today = new Date().toLocaleDateString();
    doc.text(`Generated: ${today}`, pageWidth - 10, pageHeight - 10, { align: "right" });
  }

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
  const thStyle = "background-color: #2c5282; color: white; padding: 4px 8px; text-align: left; font-weight: bold; font-size: 10px;";
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
    headerContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <div>
                <table style="${infoTableStyle}">
                    <thead><tr><th colspan="2" style="${thStyle}">GENERAL INFO</th></tr></thead>
                    <tbody>
                        ${InfoRow("Structure", structure.str_name)}
                        ${InfoRow("Title", structure.title || structure.str_name)}
                        ${InfoRow("Field", structure.field_name || structure.pfield)}
                        ${InfoRow("Install Date", structure.inst_date)}
                        ${InfoRow("Depth", structure.depth ? structure.depth + " m" : null)}
                        ${InfoRow("Design Life", structure.desg_life ? structure.desg_life + " yrs" : null)}
                    </tbody>
                </table>
            </div>
            <div>
                <table style="${infoTableStyle}">
                    <thead><tr><th colspan="2" style="${thStyle}">CONFIGURATION</th></tr></thead>
                    <tbody>
                        ${InfoRow("Type", structure.ptype || structure.str_type)}
                        ${InfoRow("Function", structure.function)}
                        ${InfoRow("Material", structure.material)}
                        ${InfoRow("CP System", structure.cp_system)}
                        ${InfoRow("Corrosion", structure.corr_ctg)}
                        ${InfoRow("Contractor", structure.inst_contractor)}
                    </tbody>
                </table>
            </div>
            <div>
                <table style="${infoTableStyle}">
                    <thead><tr><th colspan="2" style="${thStyle}">LOCATION & DIMS</th></tr></thead>
                    <tbody>
                        ${InfoRow("Northing", structure.northing)}
                        ${InfoRow("Easting", structure.easting)}
                        ${InfoRow("True North", structure.true_north_angle)}
                        ${InfoRow("Max Leg Dia", structure.max_leg_dia)}
                        ${InfoRow("Max Wall", structure.max_wall_thk)}
                        ${InfoRow("Helipad", structure.helipad)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
  }

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); color: #333;">
      
      <!-- Header -->
      <div style="background-color: #1a365d; color: white; padding: 20px 30px; position: relative;">
        <div style="position: absolute; top: 15px; right: 30px;">
          ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border: 2px solid white; padding: 4px; background: white;" />`
      : `<div style="border: 2px solid white; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">LOGO</div>`
    }
        </div>
        
        <div style="padding-right: 100px;">
          <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">${companySettings?.company_name || "Company Name"}</h1>
          <p style="margin: 0 0 12px 0; font-size: 11px; opacity: 0.9;">${companySettings?.department_name || "Engineering Department"}</p>
          <h2 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; opacity: 0.95;">COMPONENT SUMMARY REPORT</h2>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <p style="margin: 0; font-size: 11px; opacity: 0.85; font-weight: 300;">Structure: ${structure.str_name} (${structure.str_type})</p>
            <p style="margin: 0; font-size: 9px; opacity: 0.8;">Report: ${companySettings?.serial_no || "N/A"}</p>
          </div>
        </div>
      </div>

      <div style="padding: 20px;">

        <!-- Structure Info Tables -->
        ${headerContent}
        
        <!-- Statistics Table (Inventory Style Grid) -->
        <div style="margin-bottom: 30px;">
             <div style="background-color: #2c5282; color: white; padding: 6px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
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
                        <tr style="background-color: #2c5282; color: white;">
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
          <span>Generated: ${currentDate}</span>
          <span style="font-weight: 600; letter-spacing: 0.5px;">CONFIDENTIAL - INTERNAL USE ONLY</span>
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
  const autoTable = (doc as any).autoTable || require('jspdf-autotable').default;

  // Colors
  const headerBlue: [number, number, number] = [26, 54, 93];
  const sectionBlue: [number, number, number] = [44, 82, 130];

  // ===== HEADER =====
  doc.setFillColor(...headerBlue);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Logo
  if (companySettings?.logo_url) {
    try {
      const logoData = await loadImage(companySettings.logo_url).catch(() => null);
      if (logoData) {
        doc.addImage(logoData, 'PNG', pageWidth - 25, 4, 18, 18);
      } else {
        doc.setDrawColor(255, 255, 255);
        doc.rect(pageWidth - 25, 4, 18, 18);
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text("LOGO", pageWidth - 16, 13.5, { align: "center" });
      }
    } catch (e) { /* ignore */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companySettings?.company_name || "Company Name", 10, 10);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(companySettings?.department_name || "Engineering Department", 10, 16);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("COMPONENT DATA SHEET", 10, 24);

  // Subheader: Structure Context
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Structure: ${structure.str_name} (${structure.str_type})`, 10, 35);
  doc.setFontSize(9);
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
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    const today = new Date().toLocaleDateString();
    doc.text(`Generated: ${today}`, pageWidth - 10, pageHeight - 10, { align: "right" });
  }

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
  const thStyle = "background-color: #2c5282; color: white; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border: 1px solid #1a365d;";
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
      <div style="background-color: #1a365d; color: white; padding: 20px 30px; position: relative;">
        <!-- Logo Position -->
        <div style="position: absolute; top: 15px; right: 30px;">
           ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border: 2px solid white; padding: 4px; background: white;" />`
      : `<div style="border: 2px solid white; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">LOGO</div>`
    }
        </div>
        <div style="padding-right: 100px;">
          <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700;">${companySettings?.company_name || "Company Name"}</h1>
          <p style="margin: 0 0 12px 0; font-size: 11px; opacity: 0.9;">${companySettings?.department_name || "Engineering Department"}</p>
          <h2 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">COMPONENT DATA SHEET</h2>
          <p style="margin: 0; font-size: 11px; opacity: 0.85;">Structure: ${structure.str_name} | Type: ${resolveTypeName(component.type || component.code, typeMap)}</p>
        </div>
      </div>

      <div style="padding: 24px;">

        <!-- 1.0 IDENTITY -->
        <div style="margin-bottom: 24px;">
            <div style="background-color: #2c5282; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
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
            <div style="background-color: #2c5282; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
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
            <div style="background-color: #2c5282; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
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

        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #a0aec0; display: flex; justify-content: space-between;">
            <span>Generated: ${currentDate}</span>
            <span>COMPONENT SPEC SHEET - INTERNAL USE ONLY</span>
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
  const autoTable = (doc as any).autoTable || require('jspdf-autotable').default;

  // Colors
  const headerBlue: [number, number, number] = [26, 54, 93];
  const sectionBlue: [number, number, number] = [44, 82, 130];

  // ===== HEADER =====
  doc.setFillColor(...headerBlue);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Logo
  if (companySettings?.logo_url) {
    try {
      const logoData = await loadImage(companySettings.logo_url).catch(() => null);
      if (logoData) {
        doc.addImage(logoData, 'PNG', pageWidth - 25, 4, 18, 18);
      } else {
        doc.setDrawColor(255, 255, 255);
        doc.rect(pageWidth - 25, 4, 18, 18);
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text("LOGO", pageWidth - 16, 13.5, { align: "center" });
      }
    } catch (e) { /* ignore */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companySettings?.company_name || "Company Name", 10, 10);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(companySettings?.department_name || "Engineering Department", 10, 16);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TECHNICAL SPECIFICATIONS", 10, 24);

  doc.setFontSize(10);
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
      ['Structure Type', structure.str_type || '-', 'Installation Date', structure.inst_date || '-'],
      ['Function', structure.function || '-', 'Design Life', structure.desg_life ? `${structure.desg_life} Years` : '-'],
      ['Water Depth', structure.depth ? `${structure.depth} m` : '-', 'Manned Status', structure.manned || 'Unmanned'],
      ['Contractor', structure.inst_contractor || '-', 'Helipad', structure.helipad || 'No'],
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

  autoTable(doc, {
    startY: yPos,
    theme: 'grid',
    head: [],
    body: [
      ['Number of Legs', structure.legs ? structure.legs.length : (structure.components?.filter((c: any) => c.type === 'LEG').length || '-'), 'Max Leg Diameter', structure.max_leg_dia ? `${structure.max_leg_dia}"` : '-'],
      ['Number of Piles', structure.skirt_piles || structure.internal_piles || (structure.components?.filter((c: any) => c.type === 'PILE').length || '-'), 'Max Wall Thickness', structure.max_wall_thk ? `${structure.max_wall_thk}"` : '-'],
      ['Material Grade', structure.material || 'N/A', 'Corrosion Cat.', structure.corr_ctg || '-'],
      ['CP System', structure.cp_system || '-', 'Unit System', structure.unit_system || '-'],
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
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    const today = new Date().toLocaleDateString();
    doc.text(`Technical Specs Generated: ${today}`, pageWidth - 10, pageHeight - 10, { align: "right" });
  }

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
  const thStyle = "background-color: #2c5282; color: white; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border: 1px solid #1a365d;";
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
      <div style="background-color: #1a365d; color: white; padding: 20px 30px; position: relative;">
        <div style="position: absolute; top: 15px; right: 30px;">
          ${companySettings?.logo_url
      ? `<img src="${companySettings.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border: 2px solid white; padding: 4px; background: white;" />`
      : `<div style="border: 2px solid white; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">LOGO</div>`
    }
        </div>
        <div style="padding-right: 100px;">
          <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 700;">${companySettings?.company_name || "Company Name"}</h1>
          <p style="margin: 0 0 12px 0; font-size: 11px; opacity: 0.9;">${companySettings?.department_name || "Engineering Department"}</p>
          <h2 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">TECHNICAL SPECIFICATIONS</h2>
          <p style="margin: 0; font-size: 11px; opacity: 0.85;">Structure: ${structure.str_name} (${structure.str_type})</p>
        </div>
      </div>

      <div style="padding: 24px;">

        <!-- 1.0 DESIGN DATA -->
        <div style="margin-bottom: 24px;">
            <div style="background-color: #2c5282; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
                1.0 DESIGN & GENERAL DATA
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                    ${Row("Structure Type", structure.str_type, "Installation Date", structure.inst_date)}
                    ${Row("Function", structure.function, "Design Life", structure.desg_life ? structure.desg_life + " Years" : null)}
                    ${Row("Water Depth", structure.depth ? structure.depth + " m" : null, "Manned Status", structure.manned)}
                    ${Row("Contractor", structure.inst_contractor, "Helipad", structure.helipad)}
                </tbody>
            </table>
        </div>

        <!-- 2.0 CONFIGURATION -->
        <div style="margin-bottom: 24px;">
            <div style="background-color: #2c5282; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
                2.0 STRUCTURAL CONFIGURATION & MATERIALS
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                     ${Row("Number of Legs", structure.legs?.length || structure.components?.filter((c: any) => c.type === 'LEG').length, "Max Leg Diameter", structure.max_leg_dia ? structure.max_leg_dia + '"' : null)}
                     ${Row("Number of Piles", structure.skirt_piles || structure.internal_piles, "Max Wall Thickness", structure.max_wall_thk ? structure.max_wall_thk + '"' : null)}
                     ${Row("Material Grade", structure.material, "Corrosion Cat.", structure.corr_ctg)}
                     ${Row("CP System", structure.cp_system, "Unit System", structure.unit_system)}
                </tbody>
            </table>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- 3.0 ELEVATIONS -->
            <div>
                <div style="background-color: #2c5282; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
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
                 <div style="background-color: #2c5282; color: white; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px;">
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

        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #a0aec0; display: flex; justify-content: space-between;">
            <span>Generated: ${currentDate}</span>
            <span>INTERNAL ENGINEERING DATA SHEET - CONFIDENTIAL</span>
        </div>

      </div>
    </div>
  `;
};
