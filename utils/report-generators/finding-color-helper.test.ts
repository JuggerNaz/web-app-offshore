import { describe, it, expect } from "vitest";
import { formatReportFindingText, getRecordStatusInfo } from "./finding-color-helper";
import { 
    normalizeRecordFindings, 
    normalizeReportRecords, 
    isPurelyIncompleteRecord, 
    getEffectiveFindings, 
    isStatusIncomplete, 
    hasSubstantiveInspectionFindings 
} from "./shared-logo";

describe("formatReportFindingText & normalizeRecordFindings for Riser Guard & Boatlanding", () => {
    it("prints Inspection Finding, blank line before Incomplete Reason, and blank line before Anomaly Description when all are keyed in", () => {
        const record = {
            description: "Marine growth hard 20mm observed on clamp",
            status: "INCOMPLETE",
            incomplete_reason: "High surge and current halted inspection",
            is_anomaly: true,
            defect_description: "Dent and crack at support bracket",
            anomaly_ref_no: "ANO-RG-001"
        };

        const findingText = formatReportFindingText(record);
        const expected = [
            "Marine growth hard 20mm observed on clamp",
            "",
            "Incomplete Reason: High surge and current halted inspection",
            "",
            "Anomaly Description: Dent and crack at support bracket",
            "Please refer to Anomaly No.: ANO-RG-001"
        ].join("\n");

        expect(findingText).toBe(expected);
    });

    it("prints Inspection Finding first and a blank line before Incomplete Reason when both are keyed in without anomaly", () => {
        const record = {
            description: "Light marine growth, coating intact",
            status: "INCOMPLETE",
            incomplete_reason: "ROV thruster malfunctioned",
        };

        const findingText = formatReportFindingText(record);
        const expected = [
            "Light marine growth, coating intact",
            "",
            "Incomplete Reason: ROV thruster malfunctioned"
        ].join("\n");

        expect(findingText).toBe(expected);
    });

    it("prints Incomplete Reason on line 1 with no leading blank line when no inspection finding is entered", () => {
        const record = {
            description: "",
            status: "INCOMPLETE",
            incomplete_reason: "Visibility below 0.5m",
        };

        const findingText = formatReportFindingText(record);
        expect(findingText).toBe("Incomplete Reason: Visibility below 0.5m");
    });

    it("prints Incomplete Reason, blank line, and Anomaly Description when finding is placeholder but anomaly is flagged", () => {
        const record = {
            description: "No significant findings",
            status: "INCOMPLETE",
            incomplete_reason: "Visibility below 0.5m",
            is_anomaly: true,
            defect_description: "Missing retaining pin on riser guard",
            anomaly_ref_no: "ANO-002"
        };

        const findingText = formatReportFindingText(record);
        const expected = [
            "Incomplete Reason: Visibility below 0.5m",
            "",
            "Anomaly Description: Missing retaining pin on riser guard",
            "Please refer to Anomaly No.: ANO-002"
        ].join("\n");

        expect(findingText).toBe(expected);
    });

    it("does not destroy user-keyed description in normalizeRecordFindings when status is INCOMPLETE", () => {
        const record = {
            description: "Crack on boatlanding rubber fender",
            status: "INCOMPLETE",
            incomplete_reason: "Weather deteriorated",
            inspection_data: {
                findings: "Crack on boatlanding rubber fender",
                incomplete_reason: "Weather deteriorated"
            }
        };

        const normalized = normalizeRecordFindings(record);
        expect(normalized.description).toBe("Crack on boatlanding rubber fender");
        expect(normalized.inspection_data.findings).toBe("Crack on boatlanding rubber fender");
        expect(normalized.incomplete_reason).toBe("Weather deteriorated");

        const findingText = formatReportFindingText(normalized);
        expect(findingText).toBe(
            "Crack on boatlanding rubber fender\n\nIncomplete Reason: Weather deteriorated"
        );
    });

    it("handles explicit baseFinding passed from Riser Guard and Boatlanding reports with blank line separators", () => {
        const record = {
            description: "Debris noted",
            status: "INCOMPLETE",
            incomplete_reason: "Tide dropped below minimum depth",
            is_anomaly: true,
            defect_description: "Bent riser guard fender bar",
            anomaly_ref_no: "ANO-BL-003",
            inspection_data: {
                findings: "Debris noted",
                marine_growth: "Hard: 15mm",
                component_condition: "Fair"
            }
        };

        const baseFinding = [
            "Debris noted",
            "Marine Growth: Hard: 15mm",
            "Component Condition: Fair"
        ].join("\n");

        const findingText = formatReportFindingText(record, baseFinding);
        const expected = [
            "Debris noted",
            "Marine Growth: Hard: 15mm",
            "Component Condition: Fair",
            "",
            "Incomplete Reason: Tide dropped below minimum depth",
            "",
            "Anomaly Description: Bent riser guard fender bar",
            "Please refer to Anomaly No.: ANO-BL-003"
        ].join("\n");

        expect(findingText).toBe(expected);
    });

    it("appends 'Incomplete' with a blank line when record is incomplete but has substantive finding and no reason", () => {
        const record = {
            description: "Dent 15mm detected on member",
            status: "INCOMPLETE",
        };

        const findingText = formatReportFindingText(record);
        expect(findingText).toBe("Dent 15mm detected on member\n\nIncomplete");

        const effective = getEffectiveFindings(record);
        expect(effective).toBe("Dent 15mm detected on member\n\nIncomplete");
    });
});

describe("Purely Incomplete Filtering and Partial Incomplete Retention", () => {
    it("identifies purely incomplete records without findings or with findings identical to reason", () => {
        const noFinding = {
            status: "INCOMPLETE",
            incomplete_reason: "Member fully buried in seabed",
            description: ""
        };
        expect(isStatusIncomplete(noFinding)).toBe(true);
        expect(hasSubstantiveInspectionFindings(noFinding)).toBe(false);
        expect(isPurelyIncompleteRecord(noFinding)).toBe(true);

        const placeholderFinding = {
            status: "INCOMPLETE",
            incomplete_reason: "Member fully buried in seabed",
            description: "No significant findings"
        };
        expect(isPurelyIncompleteRecord(placeholderFinding)).toBe(true);

        const sameFindingAsReason = {
            status: "INCOMPLETE",
            incomplete_reason: "Member fully buried in seabed",
            description: "Member fully buried in seabed"
        };
        expect(isPurelyIncompleteRecord(sameFindingAsReason)).toBe(true);

        const prefixedReason = {
            status: "INCOMPLETE",
            incomplete_reason: "Member fully buried in seabed",
            description: "Incomplete Reason: Member fully buried in seabed"
        };
        expect(isPurelyIncompleteRecord(prefixedReason)).toBe(true);

        const justIncompleteText = {
            status: "INCOMPLETE",
            description: "Incomplete"
        };
        expect(isPurelyIncompleteRecord(justIncompleteText)).toBe(true);
    });

    it("identifies partially incomplete records that have substantive inspection findings", () => {
        const partialRecord = {
            status: "INCOMPLETE",
            incomplete_reason: "Diver recalled due to swell",
            description: "Hard marine growth 25mm on 6 o'clock toe"
        };
        expect(isStatusIncomplete(partialRecord)).toBe(true);
        expect(hasSubstantiveInspectionFindings(partialRecord)).toBe(true);
        expect(isPurelyIncompleteRecord(partialRecord)).toBe(false);

        const anomalyOnIncomplete = {
            status: "INCOMPLETE",
            incomplete_reason: "Poor visibility",
            is_anomaly: true,
            defect_description: "Dent 20mm on brace weld"
        };
        expect(isPurelyIncompleteRecord(anomalyOnIncomplete)).toBe(false);
    });

    it("normalizeReportRecords filters out purely incomplete records by default and keeps partial incomplete", () => {
        const records = [
            {
                q_id: "MB-01",
                status: "COMPLETED",
                description: "Clean member, no defect"
            },
            {
                q_id: "MB-02",
                status: "INCOMPLETE",
                incomplete_reason: "Buried under mud",
                description: ""
            },
            {
                q_id: "MB-03",
                status: "INCOMPLETE",
                incomplete_reason: "Buried under mud",
                description: "Buried under mud"
            },
            {
                q_id: "MB-04",
                status: "INCOMPLETE",
                incomplete_reason: "High surge halted dive",
                description: "Coating degraded 30% with pitting"
            }
        ];

        // By default (inspection reports), MB-02 and MB-03 are filtered out:
        const normalizedForStandardReports = normalizeReportRecords(records);
        expect(normalizedForStandardReports.length).toBe(2);
        expect(normalizedForStandardReports[0].q_id).toBe("MB-01");
        expect(normalizedForStandardReports[1].q_id).toBe("MB-04");

        // When formatted, MB-04 displays findings, blank line, and incomplete reason:
        const mb04Formatted = formatReportFindingText(normalizedForStandardReports[1]);
        expect(mb04Formatted).toBe("Coating degraded 30% with pitting\n\nIncomplete Reason: High surge halted dive");

        // When allowPurelyIncomplete is true (for dedicated Incomplete report), all records are preserved:
        const normalizedForIncompleteReport = normalizeReportRecords(records, { allowPurelyIncomplete: true });
        expect(normalizedForIncompleteReport.length).toBe(4);
    });
});
