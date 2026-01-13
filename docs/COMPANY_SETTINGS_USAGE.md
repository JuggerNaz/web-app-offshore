# Company Settings for Reports

This document explains how to use company settings (company name, department name, and logo) in generated reports.

## Settings Location

Company settings are configured in: **Settings** (bottom of sidebar) → **Company Information**

The following fields are available:
- **Company Name**: Main company name
- **Department Name**: Department/division name
- **Company Logo**: Company logo image (PNG/SVG recommended, max 2MB)

## Using Settings in Reports

### Import the utility function

```typescript
import { getReportHeaderData } from "@/utils/company-settings";
```

### Get report header data

```typescript
const reportData = getReportHeaderData();

// Available fields:
// - reportData.companyName
// - reportData.departmentName
// - reportData.companyLogo (base64 image string or null)
// - reportData.generatedDate
// - reportData.generatedTime
```

### Example: PDF Report Header

```typescript
import { getReportHeaderData } from "@/utils/company-settings";
import Image from "next/image";

function ReportHeader() {
  const { companyName, departmentName, companyLogo } = getReportHeaderData();

  return (
    <div className="report-header">
      {companyLogo && (
        <Image 
          src={companyLogo} 
          alt="Company Logo" 
          width={100} 
          height={100} 
        />
      )}
      <h1>{companyName}</h1>
      {departmentName && <h2>{departmentName}</h2>}
    </div>
  );
}
```

### Example: Export to PDF with jsPDF

```typescript
import jsPDF from "jspdf";
import { getReportHeaderData } from "@/utils/company-settings";

function generatePDFReport() {
  const doc = new jsPDF();
  const { companyName, departmentName, companyLogo, generatedDate } = getReportHeaderData();

  // Add logo if available
  if (companyLogo) {
    doc.addImage(companyLogo, 'PNG', 10, 10, 30, 30);
  }

  // Add company name
  doc.setFontSize(16);
  doc.text(companyName, 50, 20);

  // Add department name
  if (departmentName) {
    doc.setFontSize(12);
    doc.text(departmentName, 50, 30);
  }

  // Add generation date
  doc.setFontSize(10);
  doc.text(`Generated: ${generatedDate}`, 50, 40);

  // ... rest of your report content

  doc.save("report.pdf");
}
```

## Storage

Settings are stored in:
- **Client-side**: `localStorage` (key: `companySettings`)
- **Future**: Database table for multi-user environments

## Event Notifications

When settings are saved, a custom event is dispatched:
```typescript
window.addEventListener("companySettingsChanged", () => {
  // Reload settings or update UI
});
```

This allows real-time updates across the application (e.g., sidebar logo updates immediately).
