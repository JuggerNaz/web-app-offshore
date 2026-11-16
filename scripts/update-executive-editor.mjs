import fs from "fs";
import path from "path";

const filePath = path.resolve("app/dashboard/reports/executive-summary/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

// 1. Add dynamic import for ExecutiveRichEditor
const importTarget = `const InspectionAnalyticsDialog = dynamic(\n    () => import("./InspectionAnalyticsDialog").then((m) => m.InspectionAnalyticsDialog),\n    { ssr: false }\n);`;
const importTargetCRLF = `const InspectionAnalyticsDialog = dynamic(\r\n    () => import("./InspectionAnalyticsDialog").then((m) => m.InspectionAnalyticsDialog),\r\n    { ssr: false }\r\n);`;

const newImport = `const InspectionAnalyticsDialog = dynamic(
    () => import("./InspectionAnalyticsDialog").then((m) => m.InspectionAnalyticsDialog),
    { ssr: false }
);
const ExecutiveRichEditor = dynamic(
    () => import("./ExecutiveRichEditor").then((m) => m.ExecutiveRichEditor),
    {
        ssr: false,
        loading: () => (
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-500" />
                Loading Executive Editor...
            </div>
        ),
    }
);`;

if (content.includes(importTargetCRLF)) {
    content = content.replace(importTargetCRLF, newImport.replace(/\n/g, "\r\n"));
    console.log("Import replaced (CRLF)");
} else if (content.includes(importTarget)) {
    content = content.replace(importTarget, newImport);
    console.log("Import replaced (LF)");
} else {
    console.error("Could not find import target!");
}

// 2. Replace Textarea block with ExecutiveRichEditor
const regex = /<div className="grow p-6 flex flex-col">[\s\S]*?<Textarea[\s\S]*?<\/Textarea>[\s\S]*?<\/div>/;

const replacement = `<div className="grow p-4 flex flex-col min-h-0 overflow-hidden">
                                <ExecutiveRichEditor
                                    value={sectionsData[activeSectionId] || ""}
                                    onChange={(newVal) => setSectionsData(prev => ({ ...prev, [activeSectionId]: newVal }))}
                                    placeholder={\`Enter summary for \${activeSection?.title}...\`}
                                    sectionTitle={activeSection?.title}
                                    statsContext={insightData?.data}
                                />
                            </div>`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    console.log("Textarea replaced successfully!");
} else {
    console.error("Could not find Textarea block!");
}

fs.writeFileSync(filePath, content, "utf-8");
console.log("File updated successfully.");
