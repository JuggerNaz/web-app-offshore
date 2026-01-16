# Reports System - Implementation Guide

## 🎯 Overview

The Reports Center is now fully integrated into your application with a beautiful, extensible UI and backend infrastructure ready for PDF generation.

## ✅ What's Complete

### 1. **UI Components**
- ✅ Main Reports page with 4 categories
- ✅ Tabbed interface (Structure, Job Pack, Planning, Inspection)
- ✅ Selection dropdowns for each category
- ✅ Report template cards with Generate & Preview buttons
- ✅ Responsive design with dark mode support
- ✅ Beautiful gradients and animations

### 2. **Navigation**
- ✅ Reports menu item added to sidebar
- ✅ FileText icon imported
- ✅ Proper routing to `/dashboard/reports`

### 3. **Backend Infrastructure**
- ✅ Report generation utilities (`utils/report-generator.ts`)
- ✅ API endpoint (`/api/reports/generate`)
- ✅ Company settings integration for headers
- ✅ Filename formatting utilities

### 4. **Documentation**
- ✅ Complete feature documentation
- ✅ Customization guide
- ✅ API reference
- ✅ Implementation roadmap

---

## 🚀 Next Steps - PDF Generation

To implement actual PDF generation, follow these steps:

### Phase 1: Install PDF Library

```bash
npm install jspdf jspdf-autotable
npm install --save-dev @types/jspdf
```

### Phase 2: Create PDF Templates

Create `utils/pdf-templates/` directory with template files:

```
utils/pdf-templates/
├── structure-summary.ts
├── component-catalogue.ts
├── technical-specs.ts
├── jobpack-summary.ts
├── work-scope.ts
├── resource-allocation.ts
├── inspection-schedule.ts
├── planning-overview.ts
├── inspection-report.ts
├── defect-summary.ts
└── compliance-report.ts
```

### Phase 3: Example PDF Template

Here's a starter template for Structure Summary:

```typescript
// utils/pdf-templates/structure-summary.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportHeader } from "../report-generator";

export const generateStructureSummaryPDF = (
  header: ReportHeader,
  structureData: any
) => {
  const doc = new jsPDF();
  
  // Add company logo if available
  if (header.companyLogo) {
    doc.addImage(header.companyLogo, "PNG", 10, 10, 30, 30);
  }
  
  // Add company info
  doc.setFontSize(16);
  doc.text(header.companyName, 50, 20);
  
  if (header.departmentName) {
    doc.setFontSize(12);
    doc.text(header.departmentName, 50, 28);
  }
  
  if (header.serialNo) {
    doc.setFontSize(10);
    doc.text(`Serial No: ${header.serialNo}`, 50, 35);
  }
  
  // Add report title
  doc.setFontSize(18);
  doc.text(header.reportTitle, 10, 50);
  
  // Add generation date
  doc.setFontSize(10);
  doc.text(`Generated: ${header.generatedDate} ${header.generatedTime}`, 10, 58);
  
  // Add structure details
  doc.setFontSize(12);
  doc.text("Structure Details", 10, 70);
  
  // Add table with structure data
  autoTable(doc, {
    startY: 75,
    head: [["Field", "Value"]],
    body: [
      ["Structure Name", structureData.name],
      ["Type", structureData.type],
      ["Location", structureData.location],
      ["Status", structureData.status],
    ],
  });
  
  // Add components table
  const componentsY = (doc as any).lastAutoTable.finalY + 10;
  doc.text("Components", 10, componentsY);
  
  autoTable(doc, {
    startY: componentsY + 5,
    head: [["Component ID", "Type", "Description", "Status"]],
    body: structureData.components.map((c: any) => [
      c.id,
      c.type,
      c.description,
      c.status,
    ]),
  });
  
  return doc;
};
```

### Phase 4: Update Report Generator

Update `utils/report-generator.ts` to use PDF templates:

```typescript
import { generateStructureSummaryPDF } from "./pdf-templates/structure-summary";

export const generateStructureSummaryReport = async (structureId: string) => {
  // Fetch structure data from API
  const response = await fetch(`/api/structure/${structureId}`);
  const structureData = await response.json();
  
  // Get report header
  const header = getReportHeader("Structure Summary Report", "Structure");
  
  // Generate PDF
  const doc = generateStructureSummaryPDF(header, structureData);
  
  // Generate filename
  const filename = formatReportFilename("structure_summary", structureId);
  
  // Save PDF
  doc.save(filename);
  
  return {
    header,
    filename,
    status: "completed",
  };
};
```

### Phase 5: Update Reports Page

Update the `handleGenerateReport` function in `app/dashboard/reports/page.tsx`:

```typescript
import { generateReport } from "@/utils/report-generator";

const handleGenerateReport = async (templateId: string, category: string) => {
  try {
    setIsGenerating(true);
    
    // Prepare data based on category
    let data = {};
    if (category === "structure") {
      data = { structureId: selectedStructure };
    } else if (category === "jobpack") {
      data = { jobPackId: selectedJobPack };
    } else if (category === "planning") {
      data = { planningId: selectedPlanning };
    } else if (category === "inspection") {
      data = {
        jobPackId: selectedJobPack,
        inspectionType: selectedInspectionType,
      };
    }
    
    // Generate report
    await generateReport({
      templateId,
      category,
      data,
      format: "pdf",
    });
    
    // Show success message
    toast.success("Report generated successfully!");
  } catch (error) {
    console.error("Error generating report:", error);
    toast.error("Failed to generate report");
  } finally {
    setIsGenerating(false);
  }
};
```

---

## 📊 Report Preview Feature

### Create Preview Modal Component

```typescript
// components/reports/ReportPreviewModal.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: any;
  templateId: string;
}

export function ReportPreviewModal({
  isOpen,
  onClose,
  reportData,
  templateId,
}: ReportPreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Render preview based on templateId */}
          <div className="border rounded-lg p-6 bg-white">
            {/* Preview content here */}
            <pre>{JSON.stringify(reportData, null, 2)}</pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 🔧 Database Schema for Report History

### Create Reports History Table

```sql
CREATE TABLE IF NOT EXISTS public.report_history (
    id SERIAL PRIMARY KEY,
    template_id TEXT NOT NULL,
    category TEXT NOT NULL,
    entity_id TEXT,
    filename TEXT NOT NULL,
    file_path TEXT,
    generated_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    parameters JSONB,
    status TEXT DEFAULT 'completed',
    file_size INTEGER,
    CONSTRAINT valid_category CHECK (category IN ('structure', 'jobpack', 'planning', 'inspection'))
);

-- Enable RLS
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own reports
CREATE POLICY "Users can read their own reports"
    ON public.report_history
    FOR SELECT
    TO authenticated
    USING (generated_by = auth.uid());

-- Allow users to insert reports
CREATE POLICY "Users can create reports"
    ON public.report_history
    FOR INSERT
    TO authenticated
    WITH CHECK (generated_by = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_report_history_user ON public.report_history(generated_by);
CREATE INDEX idx_report_history_date ON public.report_history(generated_at DESC);
```

---

## 📈 Advanced Features

### 1. Scheduled Reports

```typescript
// Future: Schedule reports to run automatically
interface ScheduledReport {
  id: string;
  templateId: string;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  parameters: any;
}
```

### 2. Batch Report Generation

```typescript
// Generate multiple reports at once
const generateBatchReports = async (reportIds: string[]) => {
  const results = await Promise.all(
    reportIds.map(id => generateReport({ templateId: id, ... }))
  );
  return results;
};
```

### 3. Report Templates Management

Create an admin interface to:
- Create custom templates
- Edit existing templates
- Share templates across users
- Version control for templates

---

## 🎨 Styling Customization

### Adding New Color Schemes

For a new category (e.g., "Maintenance"):

```tsx
// Use red color scheme
<Card className="border-2 border-red-100 dark:border-red-900/30">
  <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50">
    <CardTitle className="flex items-center gap-2">
      <Wrench className="w-5 h-5 text-red-600" />
      Maintenance Reports
    </CardTitle>
  </CardHeader>
</Card>
```

---

## 🧪 Testing Checklist

- [ ] All report templates generate successfully
- [ ] PDF downloads work correctly
- [ ] Preview modal displays properly
- [ ] Company logo appears in reports
- [ ] Company name and department show correctly
- [ ] Serial number displays when set
- [ ] Filename format is correct
- [ ] Reports save to history
- [ ] Dark mode works properly
- [ ] Responsive on all devices

---

## 📚 Resources

- [jsPDF Documentation](https://github.com/parallax/jsPDF)
- [jsPDF AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)
- [PDF Generation Best Practices](https://pdfkit.org/)

---

**Ready to implement PDF generation!** 🚀

Start with Phase 1 and work through each phase systematically.
