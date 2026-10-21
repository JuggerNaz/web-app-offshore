import { describe, it, expect } from "vitest";
import { formatReportFindingText, getRecordStatusInfo } from "./finding-color-helper";
import { normalizeRecordFindings } from "./shared-logo";

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
});
