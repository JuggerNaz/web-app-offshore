import { describe, it, expect } from "vitest";
import {
    categorizePhotoItem,
    getPhotoAnomalyRef,
    getPhotoFindingRef,
    sortNormalPhotos,
    sortAnomalyPhotos,
    sortFindingPhotos,
    generateROVPhotographyReport
} from "./rov-photography-report";
import { generateROVPhotographyLogReport } from "./rov-photography-log-report";

describe("ROV Photography Report & Log - Grouping & Sorting", () => {
    describe("categorizePhotoItem", () => {
        it("identifies normal inspection attachments", () => {
            const normalItem = {
                id: 1,
                name: "Anode general view.jpg",
                inspection_date: "2026-03-01",
                is_anomaly: false,
                is_finding: false
            };
            const result = categorizePhotoItem(normalItem);
            expect(result.category).toBe("NORMAL");
            expect(result.referenceNo).toBe("");
        });

        it("identifies anomaly attachments and extracts reference no", () => {
            const anomItem = {
                id: 2,
                name: "Damage to brace.jpg",
                anomaly_ref: "A-007",
                is_anomaly: true
            };
            const result = categorizePhotoItem(anomItem);
            expect(result.category).toBe("ANOMALY");
            expect(result.referenceNo).toBe("A-007");
        });

        it("identifies finding attachments and extracts reference no", () => {
            const findingItem = {
                id: 3,
                name: "Debris nearby.jpg",
                finding_ref: "F-002",
                is_finding: true
            };
            const result = categorizePhotoItem(findingItem);
            expect(result.category).toBe("FINDING");
            expect(result.referenceNo).toBe("F-002");
        });

        it("prioritizes finding if both are present or if ref starts with F-", () => {
            const item = {
                id: 4,
                anomaly_ref: "F-005",
                is_finding: true
            };
            const result = categorizePhotoItem(item);
            expect(result.category).toBe("FINDING");
            expect(result.referenceNo).toBe("F-005");
        });
    });

    describe("getPhotoAnomalyRef & getPhotoFindingRef", () => {
        it("extracts anomaly ref from description text pattern", () => {
            const photo = {
                name: "photo1.jpg",
                description: "Crack observed near weld (Anomaly No. A-012)"
            };
            expect(getPhotoAnomalyRef(photo)).toBe("A-012");
        });

        it("extracts finding ref from description text pattern", () => {
            const photo = {
                name: "photo2.jpg",
                description: "Marine growth level high, Finding Ref F-003"
            };
            expect(getPhotoFindingRef(photo)).toBe("F-003");
        });
    });

    describe("Sorting", () => {
        it("sorts normal photos chronologically by inspection date", () => {
            const photos = [
                { id: 1, inspection_date: "2026-03-10", _inspTime: "14:00" },
                { id: 2, inspection_date: "2026-03-05", _inspTime: "10:00" },
                { id: 3, inspection_date: "2026-03-05", _inspTime: "08:30" }
            ];
            const sorted = sortNormalPhotos(photos);
            expect(sorted.map(p => p.id)).toEqual([3, 2, 1]);
        });

        it("sorts anomaly photos naturally by anomaly reference no (A-001, A-002, A-007, A-010)", () => {
            const photos = [
                { id: 1, anomaly_ref: "A-010" },
                { id: 2, anomaly_ref: "A-007" },
                { id: 3, anomaly_ref: "A-001" },
                { id: 4, anomaly_ref: "A-002" }
            ];
            const sorted = sortAnomalyPhotos(photos);
            expect(sorted.map(p => p.anomaly_ref)).toEqual(["A-001", "A-002", "A-007", "A-010"]);
        });

        it("sorts finding photos naturally by finding reference no (F-001, F-002, F-010)", () => {
            const photos = [
                { id: 1, finding_ref: "F-010" },
                { id: 2, finding_ref: "F-002" },
                { id: 3, finding_ref: "F-001" }
            ];
            const sorted = sortFindingPhotos(photos);
            expect(sorted.map(p => p.finding_ref)).toEqual(["F-001", "F-002", "F-010"]);
        });
    });

    describe("Report PDF Generation", () => {
        const dummy1x1Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

        const dummyPhotos = [
            // Normal
            {
                id: 101,
                name: "Routine Leg A1",
                path: dummy1x1Png,
                inspection_date: "2026-03-01",
                inspection_time: "09:00",
                description: "Normal marine growth"
            },
            // Anomaly
            {
                id: 102,
                name: "Dent on Member 2",
                path: dummy1x1Png,
                anomaly_ref: "A-007",
                inspection_date: "2026-03-02",
                description: "Mechanical damage"
            },
            // Finding
            {
                id: 103,
                name: "Fishing Net Entanglement",
                path: dummy1x1Png,
                finding_ref: "F-001",
                inspection_date: "2026-03-03",
                description: "Abandoned fishing gear"
            }
        ];

        const headerData = {
            jobpackName: "BODP-A Inspection",
            platformName: "BODP-A",
            vessel: "MEO RESOLUTION",
            sowReportNo: "AM26-016-02"
        };

        const companySettings = {
            company_name: "Petronas Carigali Sdn Bhd (SKA)",
            department_name: "Technical Services Department"
        };

        it("generates Photography Report with all 3 sections returning a Blob", async () => {
            const blob = await generateROVPhotographyReport(
                dummyPhotos,
                headerData,
                companySettings,
                { returnBlob: true, printFriendly: false }
            );
            expect(blob).toBeTruthy();
            expect(blob instanceof Blob).toBe(true);
            expect((blob as Blob).size).toBeGreaterThan(1000);
        });

        it("generates Photography Log Report with all 3 sections returning a Blob", async () => {
            const blob = await generateROVPhotographyLogReport(
                dummyPhotos,
                headerData,
                companySettings,
                { returnBlob: true, printFriendly: false }
            );
            expect(blob).toBeTruthy();
            expect(blob instanceof Blob).toBe(true);
            expect((blob as Blob).size).toBeGreaterThan(1000);
        });
    });
});
