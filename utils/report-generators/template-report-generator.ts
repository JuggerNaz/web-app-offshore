import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import { saveAs } from "file-saver";

interface ReportOptions {
    templateUrl: string;
    data: any;
    fileName: string;
    logoUrl?: string;
}

/**
 * Generates a DOCX report based on a template with placeholders.
 * Supports image replacement for logos.
 */
export const generateTemplateReport = async ({ templateUrl, data, fileName, logoUrl }: ReportOptions) => {
    try {
        console.log(`[ReportGenerator] Fetching template from: ${templateUrl}`);
        const response = await fetch(templateUrl);
        if (!response.ok) throw new Error(`Failed to fetch template: ${response.statusText}`);
        
        const content = await response.arrayBuffer();
        const zip = new PizZip(content);

        // Configure Image Module
        const imageOptions: any = {
            centered: false,
            getImage: async (tagValue: string) => {
                if (!tagValue) return null;
                console.log(`[ReportGenerator] Fetching image: ${tagValue}`);
                const res = await fetch(tagValue);
                return await res.arrayBuffer();
            },
            getSize: (img: any, tagValue: string, tagName: string) => {
                // If the tag is CLIENT_LOGO, we can set specific dimensions
                if (tagName === "CLIENT_LOGO" || tagName === "LOGO") {
                    return [120, 60];
                }
                return [150, 150]; // Default size for other images
            }
        };

        const imageModule = new ImageModule(imageOptions);

        const doc = new Docxtemplater(zip, {
            modules: [imageModule],
            paragraphLoop: true,
            linebreaks: true,
        });

        // Add logo to data if provided
        const finalData = {
            ...data,
            CLIENT_LOGO: logoUrl || "",
        };

        // Use resolveData for async image fetching
        await doc.resolveData(finalData);
        
        doc.render();

        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        saveAs(out, fileName.endsWith(".docx") ? fileName : `${fileName}.docx`);
        console.log(`[ReportGenerator] Report generated: ${fileName}`);
        
    } catch (error) {
        console.error("[ReportGenerator] Error generating report:", error);
        throw error;
    }
};
