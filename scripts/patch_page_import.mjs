import fs from "fs";
import path from "path";

const pagePath = path.resolve("app/dashboard/reports/executive-summary/page.tsx");
let content = fs.readFileSync(pagePath, "utf-8");

// 1. Add FileUp to lucide-react imports if missing
if (!content.includes("FileUp")) {
    content = content.replace('History\n} from "lucide-react"', 'History,\n    FileUp\n} from "lucide-react"');
    content = content.replace('History\r\n} from "lucide-react"', 'History,\r\n    FileUp\r\n} from "lucide-react"');
}

// 2. Add ImportDocumentDialog dynamic import
if (!content.includes("ImportDocumentDialog")) {
    const importHook = `const ImportDocumentDialog = dynamic(
    () => import("./ImportDocumentDialog").then((m) => m.ImportDocumentDialog),
    { ssr: false }
);`;
    content = content.replace(
        /const ImportHistoricalDialog = dynamic\([\s\S]*?\{ ssr: false \}\r?\n\);/,
        (match) => `${match}\n${importHook}`
    );
}

// 3. Add isImportDocOpen state
if (!content.includes("isImportDocOpen")) {
    content = content.replace(
        "const [isImportHistoryOpen, setIsImportHistoryOpen] = useState(false);",
        "const [isImportHistoryOpen, setIsImportHistoryOpen] = useState(false);\n    const [isImportDocOpen, setIsImportDocOpen] = useState(false);"
    );
}

// 4. Add the button in the action toolbar
if (!content.includes("setIsImportDocOpen(true)")) {
    const buttonHtml = `                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setIsImportDocOpen(true)} 
                                        className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 font-semibold"
                                        title="Import executive summary sections from PDF or Word (.docx) document"
                                    >
                                        <FileUp className="h-3.5 w-3.5" />
                                        Import PDF / Word
                                    </Button>\n`;

    content = content.replace(
        /({\/\* Templates \*\/|<Button variant="outline" size="sm" onClick={\(\) => setIsTemplatesOpen\(true\)}|<Button\s+variant="outline"\s+size="sm"\s+onClick={\(\) => setIsTemplatesOpen\(true\)})/,
        `${buttonHtml}$1`
    );
}

// 5. Add the dialog component
if (!content.includes("<ImportDocumentDialog")) {
    const dialogComponent = `            <ImportDocumentDialog
                open={isImportDocOpen}
                onOpenChange={setIsImportDocOpen}
                currentSectionsData={sectionsData}
                onApplyToSummary={(newSections, count) => {
                    setSectionsData(newSections);
                    toast.success(\`Imported \${count} section(s) into Executive Summary. Click 'Save Changes' to save.\`);
                }}
            />\n\n`;

    content = content.replace(
        "<ImportHistoricalDialog",
        `${dialogComponent}            <ImportHistoricalDialog`
    );
}

fs.writeFileSync(pagePath, content, "utf-8");
console.log("Successfully patched page.tsx for Document Import!");

