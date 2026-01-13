/**
 * Utility functions for managing company settings
 * Used for reports, branding, and application configuration
 */

export interface CompanySettings {
    companyName: string;
    departmentName: string;
    serialNo: string;
    companyLogo: string | null;
    storageProvider: string;
    storageLocation: string;
}

/**
 * Get company settings from localStorage
 * @returns CompanySettings object or default values
 */
export const getCompanySettings = (): CompanySettings => {
    if (typeof window === "undefined") {
        return getDefaultSettings();
    }

    try {
        const savedSettings = localStorage.getItem("companySettings");
        if (savedSettings) {
            return JSON.parse(savedSettings);
        }
    } catch (error) {
        console.error("Error loading company settings:", error);
    }

    return getDefaultSettings();
};

/**
 * Get default company settings
 * @returns Default CompanySettings object
 */
export const getDefaultSettings = (): CompanySettings => {
    return {
        companyName: "OFFSHORE DATA MANAGEMENT",
        departmentName: "",
        serialNo: "",
        companyLogo: null,
        storageProvider: "Supabase",
        storageLocation: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    };
};

/**
 * Save company settings to localStorage
 * @param settings - CompanySettings object to save
 */
export const saveCompanySettings = (settings: CompanySettings): void => {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem("companySettings", JSON.stringify(settings));
        // Dispatch event to notify other components
        window.dispatchEvent(new Event("companySettingsChanged"));
    } catch (error) {
        console.error("Error saving company settings:", error);
        throw error;
    }
};

/**
 * Get report header data for PDF/document generation
 * @returns Object with company name, department, and logo for reports
 */
export const getReportHeaderData = () => {
    const settings = getCompanySettings();

    return {
        companyName: settings.companyName,
        departmentName: settings.departmentName,
        serialNo: settings.serialNo,
        companyLogo: settings.companyLogo,
        generatedDate: new Date().toLocaleDateString(),
        generatedTime: new Date().toLocaleTimeString(),
    };
};
