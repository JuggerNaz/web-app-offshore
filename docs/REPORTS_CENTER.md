# Reports Center - Documentation

## Overview

The Reports Center is a comprehensive reporting system that allows users to generate various types of reports based on structures, job packs, planning, and inspections.

## Features

### 📊 Report Categories

1. **Structure Reports**
   - Structure Summary Report
   - Component Catalogue
   - Technical Specifications

2. **Job Pack Reports**
   - Job Pack Summary
   - Work Scope Report
   - Resource Allocation

3. **Planning Reports**
   - Inspection Schedule
   - Planning Overview

4. **Inspection Reports**
   - Inspection Report
   - Defect Summary
   - Compliance Report

### 🎨 Design Features

- **Tabbed Interface**: Easy navigation between report categories
- **Color-Coded Tabs**: Each category has its own color scheme
  - Structure: Blue
  - Job Pack: Purple
  - Planning: Green
  - Inspection: Orange

- **Card-Based Templates**: Each report template is displayed as an interactive card
- **Hover Effects**: Cards animate on hover for better UX
- **Responsive Design**: Works on desktop, tablet, and mobile

### 🔧 Functionality

#### Current Features:
- ✅ Select structure/job pack/planning
- ✅ View available report templates
- ✅ Generate reports (placeholder)
- ✅ Preview reports (placeholder)
- ✅ Beautiful, modern UI

#### Planned Features:
- 🔄 Actual PDF generation
- 🔄 Report preview modal
- 🔄 Custom template creation
- 🔄 Report history
- 🔄 Scheduled reports
- 🔄 Email reports

## Adding New Report Templates

The system is designed for easy extensibility. To add a new report template:

### 1. Add to Template Object

In `app/dashboard/reports/page.tsx`, find the `reportTemplates` object and add your template:

```tsx
const reportTemplates = {
  structure: [
    // ... existing templates
    {
      id: "your-new-report",
      name: "Your New Report",
      icon: YourIcon,  // Import from lucide-react
      description: "Description of your report"
    },
  ],
  // ... other categories
};
```

### 2. Implement Generation Logic

Update the `handleGenerateReport` function to handle your new template:

```tsx
const handleGenerateReport = (templateId: string, category: string) => {
  if (templateId === "your-new-report") {
    // Your custom logic here
    generateYourReport();
  }
  // ... existing logic
};
```

### 3. Add Preview Logic (Optional)

Update the `handlePreviewReport` function if needed:

```tsx
const handlePreviewReport = (templateId: string) => {
  if (templateId === "your-new-report") {
    // Your custom preview logic
    showPreview();
  }
  // ... existing logic
};
```

## Adding New Report Categories

To add a completely new category (e.g., "Maintenance Reports"):

### 1. Add Tab

In the `TabsList`, add a new trigger:

```tsx
<TabsTrigger value="maintenance" className="gap-2 py-3">
  <Wrench className="w-4 h-4" />
  Maintenance Reports
</TabsTrigger>
```

### 2. Add Tab Content

Add the corresponding `TabsContent`:

```tsx
<TabsContent value="maintenance" className="space-y-6 mt-6">
  <Card className="border-2 border-red-100 dark:border-red-900/30 shadow-lg">
    <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20">
      <CardTitle className="flex items-center gap-2">
        <Wrench className="w-5 h-5 text-red-600" />
        Maintenance Selection
      </CardTitle>
      <CardDescription>
        Select maintenance records to generate reports
      </CardDescription>
    </CardHeader>
    <CardContent className="pt-6">
      {/* Your selection UI and report templates */}
    </CardContent>
  </Card>
</TabsContent>
```

### 3. Add Templates

Add templates to the `reportTemplates` object:

```tsx
const reportTemplates = {
  // ... existing categories
  maintenance: [
    {
      id: "maintenance-log",
      name: "Maintenance Log",
      icon: Wrench,
      description: "Complete maintenance history"
    },
  ],
};
```

## Integration with Company Settings

Reports automatically use company settings for headers:

```tsx
import { getReportHeaderData } from "@/utils/company-settings";

const reportData = getReportHeaderData();
// Use reportData.companyName, reportData.departmentName, 
// reportData.serialNo, reportData.companyLogo in your reports
```

## Styling Guidelines

### Color Schemes by Category:

- **Structure**: Blue (`blue-600`, `blue-100`, etc.)
- **Job Pack**: Purple (`purple-600`, `purple-100`, etc.)
- **Planning**: Green (`green-600`, `green-100`, etc.)
- **Inspection**: Orange (`orange-600`, `orange-100`, etc.)

### Card Hover Effects:

```tsx
className="group hover:shadow-xl transition-all duration-300 hover:border-blue-300"
```

### Icon Containers:

```tsx
<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 transition-colors">
  <Icon className="w-5 h-5 text-blue-600" />
</div>
```

## Future Enhancements

### Phase 1: PDF Generation
- Integrate jsPDF or similar library
- Create PDF templates
- Add download functionality

### Phase 2: Preview System
- Modal preview window
- Live data rendering
- Edit before download

### Phase 3: Template Management
- Custom template builder
- Save custom templates
- Share templates across users

### Phase 4: Advanced Features
- Scheduled report generation
- Email delivery
- Report history and versioning
- Batch report generation

## File Structure

```
app/dashboard/reports/
├── page.tsx                 # Main reports page
├── components/              # Future: Report-specific components
│   ├── ReportPreview.tsx
│   ├── TemplateBuilder.tsx
│   └── ReportHistory.tsx
└── templates/               # Future: Report template definitions
    ├── structure/
    ├── jobpack/
    ├── planning/
    └── inspection/
```

## API Integration (Future)

### Endpoints to Create:

```
GET  /api/reports/templates          # List all templates
GET  /api/reports/generate/:id       # Generate specific report
POST /api/reports/preview            # Preview report
GET  /api/reports/history            # Report generation history
POST /api/reports/schedule           # Schedule report
```

## Testing

### Manual Testing Checklist:

- [ ] All tabs switch correctly
- [ ] Dropdowns populate with data
- [ ] Template cards display properly
- [ ] Generate button triggers action
- [ ] Preview button triggers action
- [ ] Responsive on mobile
- [ ] Dark mode works correctly
- [ ] Hover effects work smoothly

## Accessibility

- All interactive elements have proper ARIA labels
- Keyboard navigation supported
- Color contrast meets WCAG standards
- Screen reader friendly

## Performance

- Lazy load report templates
- Optimize image assets
- Cache generated reports
- Pagination for large lists

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-06  
**Author**: Development Team
