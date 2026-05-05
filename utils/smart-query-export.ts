/**
 * Smart Query Export Utilities
 * Converts query results to various file formats: XLSX, CSV, TXT, JSON, XML
 */

export type ExportFormat = "xlsx" | "csv" | "txt" | "json" | "xml";

interface ExportOptions {
  filename: string;
  format: ExportFormat;
  columns: { key: string; label: string }[];
  data: Record<string, any>[];
}

// ─── CSV EXPORT ────────────────────────────────────────────────────────────────

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(columns: { key: string; label: string }[], data: Record<string, any>[]): string {
  const header = columns.map(c => escapeCSV(c.label)).join(",");
  const rows = data.map(row =>
    columns.map(c => escapeCSV(row[c.key])).join(",")
  );
  return [header, ...rows].join("\n");
}

// ─── TXT (TAB-SEPARATED) EXPORT ───────────────────────────────────────────────

function toTSV(columns: { key: string; label: string }[], data: Record<string, any>[]): string {
  const header = columns.map(c => c.label).join("\t");
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return "";
      return typeof val === "object" ? JSON.stringify(val) : String(val);
    }).join("\t")
  );
  return [header, ...rows].join("\n");
}

// ─── JSON EXPORT ───────────────────────────────────────────────────────────────

function toJSON(columns: { key: string; label: string }[], data: Record<string, any>[]): string {
  // Map data to use labels as keys
  const mapped = data.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach(c => {
      obj[c.label] = row[c.key] ?? null;
    });
    return obj;
  });
  return JSON.stringify(mapped, null, 2);
}

// ─── XML EXPORT ────────────────────────────────────────────────────────────────

function escapeXML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toXMLTagName(label: string): string {
  // Convert label to valid XML tag name
  return label
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^(\d)/, "_$1")
    .replace(/_+/g, "_")
    .replace(/_$/, "");
}

function toXML(columns: { key: string; label: string }[], data: Record<string, any>[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<QueryResults>\n';

  data.forEach((row, i) => {
    xml += `  <Record index="${i + 1}">\n`;
    columns.forEach(c => {
      const tag = toXMLTagName(c.label);
      const val = row[c.key];
      const strVal = val === null || val === undefined
        ? ""
        : typeof val === "object"
          ? escapeXML(JSON.stringify(val))
          : escapeXML(String(val));
      xml += `    <${tag}>${strVal}</${tag}>\n`;
    });
    xml += `  </Record>\n`;
  });

  xml += "</QueryResults>";
  return xml;
}

// ─── XLSX EXPORT (Simple SpreadsheetML) ────────────────────────────────────────

function toXLSX(columns: { key: string; label: string }[], data: Record<string, any>[]): string {
  // Use SpreadsheetML (XML-based) format which Excel can open natively
  // This avoids requiring the heavyweight `xlsx` npm package
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += '<Worksheet ss:Name="Smart Query Results">\n';
  xml += '<Table>\n';

  // Header row
  xml += '<Row>\n';
  columns.forEach(c => {
    xml += `  <Cell><Data ss:Type="String">${escapeXML(c.label)}</Data></Cell>\n`;
  });
  xml += '</Row>\n';

  // Data rows
  data.forEach(row => {
    xml += '<Row>\n';
    columns.forEach(c => {
      const val = row[c.key];
      if (val === null || val === undefined) {
        xml += '  <Cell><Data ss:Type="String"></Data></Cell>\n';
      } else if (typeof val === "number") {
        xml += `  <Cell><Data ss:Type="Number">${val}</Data></Cell>\n`;
      } else if (typeof val === "boolean") {
        xml += `  <Cell><Data ss:Type="String">${val ? "Yes" : "No"}</Data></Cell>\n`;
      } else if (typeof val === "object") {
        xml += `  <Cell><Data ss:Type="String">${escapeXML(JSON.stringify(val))}</Data></Cell>\n`;
      } else {
        xml += `  <Cell><Data ss:Type="String">${escapeXML(String(val))}</Data></Cell>\n`;
      }
    });
    xml += '</Row>\n';
  });

  xml += '</Table>\n</Worksheet>\n</Workbook>';
  return xml;
}

// ─── MAIN EXPORT FUNCTION ──────────────────────────────────────────────────────

export function exportQueryResults(options: ExportOptions): void {
  const { filename, format, columns, data } = options;

  let content: string;
  let mimeType: string;
  let extension: string;

  switch (format) {
    case "csv":
      content = toCSV(columns, data);
      mimeType = "text/csv;charset=utf-8;";
      extension = "csv";
      break;
    case "txt":
      content = toTSV(columns, data);
      mimeType = "text/plain;charset=utf-8;";
      extension = "txt";
      break;
    case "json":
      content = toJSON(columns, data);
      mimeType = "application/json;charset=utf-8;";
      extension = "json";
      break;
    case "xml":
      content = toXML(columns, data);
      mimeType = "application/xml;charset=utf-8;";
      extension = "xml";
      break;
    case "xlsx":
      content = toXLSX(columns, data);
      mimeType = "application/vnd.ms-excel;charset=utf-8;";
      extension = "xls"; // SpreadsheetML uses .xls extension
      break;
    default:
      content = toCSV(columns, data);
      mimeType = "text/csv;charset=utf-8;";
      extension = "csv";
  }

  // Trigger download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: string; description: string }[] = [
  { value: "xlsx", label: "Excel (.xls)", icon: "FileSpreadsheet", description: "Microsoft Excel spreadsheet" },
  { value: "csv", label: "CSV (.csv)", icon: "FileText", description: "Comma-separated values" },
  { value: "txt", label: "Text (.txt)", icon: "FileText", description: "Tab-separated text file" },
  { value: "json", label: "JSON (.json)", icon: "Braces", description: "JavaScript Object Notation" },
  { value: "xml", label: "XML (.xml)", icon: "Code", description: "Extensible Markup Language" },
];
