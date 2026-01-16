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
export const getReportHeaderData = async () => {
    // Try to fetch from API first
    try {
        const response = await fetch("/api/company-settings");
        if (response.ok) {
            const { data } = await response.json();
            return {
                companyName: data.company_name || "OFFSHORE DATA MANAGEMENT",
                departmentName: data.department_name || "",
                serialNo: data.serial_no || "",
                companyLogo: data.logo_url || null,
                generatedDate: new Date().toLocaleDateString(),
                generatedTime: new Date().toLocaleTimeString(),
            };
        }
    } catch (error) {
        console.error("Error fetching company settings for report:", error);
    }

    // Fallback to localStorage
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
