/**
 * Shared helper for ROV & Diving Anode Inspection Reports to extract
 * Anode Form and Anode Depletion cleanly — supporting both the new split fields
 * (`anode_form` + `anode_depletion`/`anode_depletion_percent`) and legacy
 * combined values (e.g. "Bar: 0 - 25% Depletion").
 */
export function extractAnodeFormAndDepletion(
    d: Record<string, any> = {},
    emptyFallback: string = "-"
): { anodeForm: string; depletion: string } {
    const rawForm = d.anode_form ?? d.anodeForm ?? d["Anode Form"] ?? "";
    let anodeForm = String(rawForm || "").trim();

    const rawDepl =
        d.anode_depletion_percent ??
        d.depletion_percent ??
        d.anode_depletion ??
        d.depletion ??
        "";
    const deplStr = rawDepl !== undefined && rawDepl !== null ? String(rawDepl).trim() : "";

    let depletion = "";

    if (deplStr !== "") {
        // Detect legacy form prefix if anode_form is not explicitly set
        const prefixMatch = deplStr.match(/^(bar|bracelet|collar|sled)\s*[:\-]?\s*(.*)$/i);
        let cleaned = deplStr;
        if (prefixMatch) {
            if (!anodeForm) {
                const f = prefixMatch[1].toLowerCase();
                anodeForm = f.charAt(0).toUpperCase() + f.slice(1);
            }
            cleaned = (prefixMatch[2] || "").trim();
        }

        // Remove trailing "Depletion" word
        cleaned = cleaned.replace(/\s*depletion\s*$/i, "").trim();

        if (cleaned !== "") {
            const lower = cleaned.toLowerCase();
            if (lower.includes("unable to estimate") || lower.includes("n/a") || lower.includes("not evaluated")) {
                depletion = cleaned;
            } else if (cleaned.includes("%")) {
                depletion = cleaned;
            } else if (/^\d+(\.\d+)?(\s*[-–]\s*\d+(\.\d+)?)?$/.test(cleaned)) {
                depletion = `${cleaned}%`;
            } else {
                depletion = cleaned;
            }
        }
    }

    return {
        anodeForm: anodeForm || emptyFallback,
        depletion: depletion || emptyFallback,
    };
}
