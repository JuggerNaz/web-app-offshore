/**
 * Structure Report PDF Template
 * Generates comprehensive structure reports with company branding
 */

import { getReportHeaderData } from "../company-settings";

export interface StructureReportData {
  // Structure Basic Info
  str_id: string;
  str_name: string;
  str_type: string;
  field_name: string;
  location: string;
  water_depth: number;
  installation_date: string;
  status: string;

  // Structure Photo
  photo_url?: string;
  photo_base64?: string;

  // Specifications
  specifications?: {
    height?: number;
    weight?: number;
    material?: string;
    design_life?: number;
    capacity?: string;
    [key: string]: any;
  };

  // Components
  components?: Array<{
    comp_id: string;
    comp_type: string;
    description: string;
    quantity: number;
    status: string;
  }>;
}

/**
 * Generate Structure Report PDF (Placeholder)
 * TODO: Implement with jsPDF when ready
 */
export const generateStructureReportPDF = async (data: StructureReportData) => {
  console.log("Generating Structure Report PDF for:", data.str_name);

  // Get company branding
  const header = getReportHeaderData();

  // TODO: Implement PDF generation with jsPDF
  // This is a placeholder that returns the structure for the PDF

  return {
    header,
    data,
    sections: [
      {
        title: "Structure Information",
        content: {
          "Structure ID": data.str_id,
          "Structure Name": data.str_name,
          "Type": data.str_type,
          "Oil Field": data.field_name,
          "Location": data.location,
          "Water Depth": `${data.water_depth}m`,
          "Installation Date": data.installation_date,
          "Status": data.status,
        }
      },
      {
        title: "Technical Specifications",
        content: data.specifications || {}
      },
      {
        title: "Components",
        table: {
          headers: ["Component ID", "Type", "Description", "Quantity", "Status"],
          rows: data.components?.map(c => [
            c.comp_id,
            c.comp_type,
            c.description,
            c.quantity.toString(),
            c.status
          ]) || []
        }
      }
    ]
  };
};

/**
 * HTML Template for Structure Report Preview
 */
export const getStructureReportHTML = (data: StructureReportData): string => {
  const header = getReportHeaderData();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Structure Report - ${data.str_name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      margin: 20px auto;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    
    /* Header */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
      margin-bottom: 30px;
    }
    
    .company-info {
      flex: 1;
    }
    
    .company-logo {
      max-width: 150px;
      max-height: 80px;
      object-fit: contain;
    }
    
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 5px;
    }
    
    .department-name {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 3px;
    }
    
    .serial-no {
      font-size: 12px;
      color: #94a3b8;
    }
    
    .report-meta {
      text-align: right;
      font-size: 12px;
      color: #64748b;
    }
    
    /* Title */
    .report-title {
      text-align: center;
      margin: 30px 0;
    }
    
    .report-title h1 {
      font-size: 28px;
      color: #1e293b;
      margin-bottom: 10px;
    }
    
    .report-title .subtitle {
      font-size: 16px;
      color: #64748b;
    }
    
    /* Structure Photo */
    .structure-photo {
      width: 100%;
      max-height: 400px;
      object-fit: cover;
      border-radius: 8px;
      margin: 20px 0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .no-photo {
      width: 100%;
      height: 300px;
      background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 18px;
      margin: 20px 0;
    }
    
    /* Sections */
    .section {
      margin: 30px 0;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1e40af;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 15px;
    }
    
    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 15px 0;
    }
    
    .info-item {
      padding: 12px;
      background: #f8fafc;
      border-left: 3px solid #3b82f6;
      border-radius: 4px;
    }
    
    .info-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .info-value {
      font-size: 14px;
      color: #1e293b;
      font-weight: 500;
    }
    
    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    
    th {
      background: #1e40af;
      color: white;
      padding: 12px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
    }
    
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    
    tr:nth-child(even) {
      background: #f8fafc;
    }
    
    tr:hover {
      background: #f1f5f9;
    }
    
    /* Footer */
    .report-footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
    
    /* Print Styles */
    @media print {
      body {
        background: white;
      }
      
      .page {
        margin: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="report-header">
      <div class="company-info">
        ${header.companyLogo ? `<img src="${header.companyLogo}" alt="Company Logo" class="company-logo">` : ''}
        <div class="company-name">${header.companyName}</div>
        ${header.departmentName ? `<div class="department-name">${header.departmentName}</div>` : ''}
        ${header.serialNo ? `<div class="serial-no">Serial No: ${header.serialNo}</div>` : ''}
      </div>
      <div class="report-meta">
        <div><strong>Report Type:</strong> Structure Report</div>
        <div><strong>Generated:</strong> ${header.generatedDate}</div>
        <div><strong>Time:</strong> ${header.generatedTime}</div>
      </div>
    </div>
    
    <!-- Title -->
    <div class="report-title">
      <h1>Structure Report</h1>
      <div class="subtitle">${data.str_name}</div>
    </div>
    
    <!-- Structure Photo -->
    ${data.photo_url || data.photo_base64 ? `
      <img src="${data.photo_url || data.photo_base64}" alt="${data.str_name}" class="structure-photo">
    ` : `
      <div class="no-photo">No Photo Available</div>
    `}
    
    <!-- Structure Information -->
    <div class="section">
      <div class="section-title">Structure Information</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Structure ID</div>
          <div class="info-value">${data.str_id}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Structure Name</div>
          <div class="info-value">${data.str_name}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Type</div>
          <div class="info-value">${data.str_type}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Oil Field</div>
          <div class="info-value">${data.field_name}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Location</div>
          <div class="info-value">${data.location}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Water Depth</div>
          <div class="info-value">${data.water_depth}m</div>
        </div>
        <div class="info-item">
          <div class="info-label">Installation Date</div>
          <div class="info-value">${data.installation_date}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Status</div>
          <div class="info-value">${data.status}</div>
        </div>
      </div>
    </div>
    
    <!-- Technical Specifications -->
    ${data.specifications ? `
    <div class="section">
      <div class="section-title">Technical Specifications</div>
      <div class="info-grid">
        ${Object.entries(data.specifications).map(([key, value]) => `
          <div class="info-item">
            <div class="info-label">${key.replace(/_/g, ' ').toUpperCase()}</div>
            <div class="info-value">${value}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- Components -->
    ${data.components && data.components.length > 0 ? `
    <div class="section">
      <div class="section-title">Components (${data.components.length})</div>
      <table>
        <thead>
          <tr>
            <th>Component ID</th>
            <th>Type</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.components.map(comp => `
            <tr>
              <td>${comp.comp_id}</td>
              <td>${comp.comp_type}</td>
              <td>${comp.description}</td>
              <td>${comp.quantity}</td>
              <td>${comp.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    <!-- Footer -->
    <div class="report-footer">
      <div>This is an automatically generated report from ${header.companyName}</div>
      <div>Generated on ${header.generatedDate} at ${header.generatedTime}</div>
      ${header.serialNo ? `<div>Document Serial: ${header.serialNo}</div>` : ''}
    </div>
  </div>
</body>
</html>
  `;
};
