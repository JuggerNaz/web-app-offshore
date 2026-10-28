import { describe, it, expect, vi } from "vitest";
import {
    parseTimecodeToSeconds,
    formatTimecode,
    formatInspectionDateTime,
    getInspectionTaskName,
    calculateTapeDurationSeconds,
    formatDurationSummary,
    formatDurationHMS,
    compileVideoLogAnalytics,
    detectLogAnomalyOrFinding,
    generateVideoLogReport,
} from "./video-log-report";

// Mock Supabase client
vi.mock("@/utils/supabase/client", () => ({
    createClient: () => ({
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => ({ data: null }),
                    single: async () => ({ data: null }),
                }),
                in: () => ({
                    order: async () => ({ data: [] }),
                }),
            }),
        }),
    }),
}));

describe("video-log-report helpers", () => {
    it("parses timecode to seconds correctly", () => {
        expect(parseTimecodeToSeconds("00:00:00")).toBe(0);
        expect(parseTimecodeToSeconds("00:06:38")).toBe(398);
        expect(parseTimecodeToSeconds("01:25:06")).toBe(5106);
        expect(parseTimecodeToSeconds("06:38")).toBe(398);
        expect(parseTimecodeToSeconds(398)).toBe(398);
        expect(parseTimecodeToSeconds(null)).toBe(-1);
        expect(parseTimecodeToSeconds("—")).toBe(-1);
        // Rogue counters (>12h) return -1
        expect(parseTimecodeToSeconds("762:05:25")).toBe(-1);
        expect(parseTimecodeToSeconds(2186626)).toBe(-1);
    });

    it("formats timecode into HH:MM:SS properly", () => {
        expect(formatTimecode(0)).toBe("00:00:00");
        expect(formatTimecode(398)).toBe("00:06:38");
        expect(formatTimecode("398")).toBe("00:06:38");
        expect(formatTimecode("00:06:38")).toBe("00:06:38");
        expect(formatTimecode("6:38")).toBe("00:06:38");
        expect(formatTimecode(null)).toBe("—");
        expect(formatTimecode("")).toBe("—");
        // Rogue counters (>12h) return "—"
        expect(formatTimecode("762:05:25")).toBe("—");
        expect(formatTimecode(2186626)).toBe("—");
    });

    it("formats inspection date and time into DD/MM/YYYY, HH:MM", () => {
        expect(formatInspectionDateTime("2026-08-24", "09:30:17")).toBe("24/08/2026, 09:30");
        expect(formatInspectionDateTime("2026-08-24T09:30:17")).toBe("24/08/2026, 09:30");
        expect(formatInspectionDateTime("2026-08-24", null)).toBe("24/08/2026");
        expect(formatInspectionDateTime(null, null)).toBe("—");
    });

    it("resolves inspection task names from inspection codes", () => {
        expect(getInspectionTaskName("RGVI")).toBe("ROV General Visual Inspection");
        expect(getInspectionTaskName("RSZCI")).toBe("Splash Zone Inspection");
        expect(getInspectionTaskName("RSCOR")).toBe("Scour / Marine Growth Survey");
        expect(getInspectionTaskName("RCPSU")).toBe("Cathodic Protection Survey");
        expect(getInspectionTaskName("UNKNOWN_CODE")).toBe("UNKNOWN_CODE");
        expect(getInspectionTaskName("")).toBe("");
    });

    it("calculates tape duration from timecodes and timestamps correctly with 12h max cap", () => {
        const logsWithTc = [
            { timecode_start: "00:00:00" },
            { timecode_start: "00:15:30" },
            { timecode_start: "01:25:06" },
        ];
        expect(calculateTapeDurationSeconds(logsWithTc)).toBe(5106);

        const logsWithSingleTc = [{ timecode_start: "00:45:00" }];
        expect(calculateTapeDurationSeconds(logsWithSingleTc)).toBe(2700);

        const logsWithDates = [
            { event_time: "2026-08-24T09:00:00Z" },
            { event_time: "2026-08-24T10:15:00Z" },
        ];
        expect(calculateTapeDurationSeconds(logsWithDates)).toBe(4500);

        // Clamps multi-day spans to 12 hours max (43200 seconds)
        const multiDayLogs = [
            { event_time: "2026-08-01T09:00:00Z" },
            { event_time: "2026-08-25T10:15:00Z" },
        ];
        expect(calculateTapeDurationSeconds(multiDayLogs)).toBe(43200);

        // Ignores rogue timecodes (>12h)
        const rogueTcLogs = [
            { timecode_start: "00:00:00" },
            { timecode_start: "00:30:00" },
            { timecode_start: "762:05:25" },
        ];
        expect(calculateTapeDurationSeconds(rogueTcLogs)).toBe(1800);

        expect(calculateTapeDurationSeconds([])).toBe(0);
    });

    it("formats durations accurately in human-readable and HMS formats", () => {
        expect(formatDurationSummary(0)).toBe("00:00:00");
        expect(formatDurationSummary(70)).toBe("1m 10s");
        expect(formatDurationSummary(5106)).toBe("1h 25m");
        expect(formatDurationHMS(5106)).toBe("01:25:06");
        expect(formatDurationHMS(70)).toBe("00:01:10");
    });
});

describe("compileVideoLogAnalytics", () => {
    const sampleTapes = [
        {
            tape_id: 1,
            tape_no: "AM26-016-02/BODP-A/V001R",
            chapter_no: "1",
            dive_no: "TGR011",
            logs: [
                { video_log_id: 1, event_type: "START_TAPE", timecode_start: "00:00:00", remarks: "Start intro" },
                { video_log_id: 2, event_type: "STOP_TAPE", timecode_start: "00:01:10", remarks: "Stop intro" },
            ],
        },
        {
            tape_id: 2,
            tape_no: "AM26-016-02/BODP-A/V001R",
            chapter_no: "2",
            dive_no: "TGR011",
            logs: [
                { video_log_id: 3, event_type: "NEW_LOG_START", timecode_start: "00:00:00", remarks: "Start survey" },
                {
                    video_log_id: "insp_1",
                    event_type: "INSPECTION",
                    is_inspection: true,
                    qid: "PG N708",
                    inspection_task: "ROV General Visual Inspection",
                    timecode_start: "00:06:38",
                    remarks: "Pile Guide in good condition",
                },
                { video_log_id: 4, event_type: "END", timecode_start: "01:25:06", remarks: "ROV reposition" },
            ],
        },
        {
            tape_id: 3,
            tape_no: "AM26-016-02/BODP-A/V002R",
            chapter_no: "1",
            dive_no: "TGR012",
            logs: [
                { video_log_id: 5, event_type: "START_TAPE", timecode_start: "00:00:00", remarks: "Start anode survey" },
                {
                    video_log_id: "insp_2",
                    event_type: "INSPECTION",
                    is_inspection: true,
                    qid: "ANODE A101",
                    inspection_task: "ROV Anode Inspection",
                    timecode_start: "00:10:00",
                    remarks: "Anode 10% depleted",
                },
                {
                    video_log_id: 6,
                    event_type: "ANOMALY",
                    timecode_start: "00:20:00",
                    remarks: "Dent anomaly detected on brace",
                },
                { video_log_id: 7, event_type: "STOP_TAPE", timecode_start: "00:45:00", remarks: "Tape complete" },
            ],
        },
    ];

    it("aggregates tape counts, chapters, duration, events, and categories correctly", () => {
        const summary = compileVideoLogAnalytics(sampleTapes);

        // 2 unique tapes
        expect(summary.totalTapesCount).toBe(2);
        // Tape 1 has 2 chapters, Tape 2 has 1 chapter -> 3 total chapters
        expect(summary.totalChaptersCount).toBe(3);
        expect(summary.avgChaptersPerTape).toBe(1.5);

        // Total dives
        expect(summary.totalDivesCount).toBe(2); // TGR011 and TGR012

        // Total logs = 2 + 3 + 4 = 9 logs
        expect(summary.totalLogsCount).toBe(9);

        // Inspections = 2 (PG N708 and ANODE A101)
        expect(summary.totalInspectionsCount).toBe(2);
        expect(summary.uniqueQidsCount).toBe(2);

        // Duration = 70s + 5106s + 2700s = 7876s (~2h 11m 16s)
        expect(summary.totalDurationSeconds).toBe(7876);

        // Event categories
        expect(summary.eventCategories.inspections).toBe(2);
        expect(summary.eventCategories.operations).toBe(6); // 2 in Ch1, 2 in Ch2, 2 in Tape2
        expect(summary.eventCategories.anomalies).toBe(1); // Dent anomaly
        expect(summary.totalAnomaliesCount).toBe(1);

        // Breakdown per tape
        expect(summary.tapesBreakdown).toHaveLength(2);
        expect(summary.tapesBreakdown[0].tapeNo).toBe("AM26-016-02/BODP-A/V001R");
        expect(summary.tapesBreakdown[0].chapterCount).toBe(2);
        expect(summary.tapesBreakdown[0].totalLogsCount).toBe(5);
        expect(summary.tapesBreakdown[0].anomalyCount).toBe(0);

        expect(summary.tapesBreakdown[1].tapeNo).toBe("AM26-016-02/BODP-A/V002R");
        expect(summary.tapesBreakdown[1].chapterCount).toBe(1);
        expect(summary.tapesBreakdown[1].totalLogsCount).toBe(4);
        expect(summary.tapesBreakdown[1].anomalyCount).toBe(1);
    });

    it("detects anomalies and findings accurately with reference numbers", () => {
        // Normal inspection
        const normalLog = {
            is_inspection: true,
            event_type: "INSPECTION",
            remarks: "Member in sound condition",
        };
        const normalRes = detectLogAnomalyOrFinding(normalLog);
        expect(normalRes.isAnomalyOrFinding).toBe(false);

        // Anomaly log with explicit flag and reference
        const anomLog = {
            is_inspection: true,
            has_anomaly: true,
            anomaly_ref_no: "A-0012",
            defect_description: "Dent on member",
        };
        const anomRes = detectLogAnomalyOrFinding(anomLog);
        expect(anomRes.isAnomalyOrFinding).toBe(true);
        expect(anomRes.isAnomaly).toBe(true);
        expect(anomRes.refNo).toBe("A-0012");
        expect(anomRes.description).toBe("Dent on member");
        expect(anomRes.actionLabel).toBe("Anomaly Detected");

        // Finding log without anomaly status is NOT counted as an anomaly
        const findingLog = {
            is_inspection: true,
            is_finding: true,
            ref_no: "F-0004",
            defect_description: "Debris observed near mudline",
        };
        const findingRes = detectLogAnomalyOrFinding(findingLog);
        expect(findingRes.isAnomalyOrFinding).toBe(false);
        expect(findingRes.isAnomaly).toBe(false);

        // Record with status explicitly stated as Anomaly
        const statusAnomLog = {
            is_inspection: true,
            status: "Anomaly",
            anomaly_ref_no: "A-0045",
            defect_description: "Severe pitting observed on bracing",
        };
        const statusRes = detectLogAnomalyOrFinding(statusAnomLog);
        expect(statusRes.isAnomalyOrFinding).toBe(true);
        expect(statusRes.isAnomaly).toBe(true);
        expect(statusRes.refNo).toBe("A-0045");
        expect(statusRes.actionLabel).toBe("Anomaly Detected");
    });
});

describe("generateVideoLogReport", () => {
    const sampleJobPack = {
        id: 101,
        name: "UIMC2026/SKA/PLAT01",
        metadata: { vessel: "MEO RESOLUTION" },
    };

    const sampleStructure = {
        id: 258,
        str_name: "BODP-A",
        field_name: "BOKOR.",
    };

    const sampleCompany = {
        company_name: "Petronas Carigali Sdn Bhd (SKA)",
        department_name: "Technical Services Department",
    };

    it("generates a video log report containing executive analytics header and tables", async () => {
        // Mock global fetch to return sample video log data with inspection records and anomalies
        global.fetch = vi.fn().mockResolvedValue({
            json: async () => ({
                data: [
                    {
                        tape_id: 11148,
                        tape_no: "AM26-016-02/BODP-A/V001R",
                        chapter_no: "1",
                        dive_no: "TGR011",
                        logs: [
                            {
                                video_log_id: 1,
                                event_type: "START_TAPE",
                                event_time: "2026-08-24T01:03:27Z",
                                timecode_start: "00:00:00",
                                remarks: "Commence video introduction",
                            },
                            {
                                video_log_id: 2,
                                event_type: "STOP_TAPE",
                                event_time: "2026-08-24T01:04:37Z",
                                timecode_start: "00:01:10",
                                remarks: "Completed video introduction",
                            },
                        ],
                    },
                    {
                        tape_id: 11150,
                        tape_no: "AM26-016-02/BODP-A/V001R",
                        chapter_no: "2",
                        dive_no: "TGR011",
                        logs: [
                            {
                                video_log_id: 3,
                                event_type: "NEW_LOG_START",
                                event_time: "2026-08-24T01:07:00Z",
                                timecode_start: "00:00:00",
                                remarks: "Commence GVI & CP survey",
                            },
                            {
                                video_log_id: "insp_187050",
                                event_type: "INSPECTION",
                                is_inspection: true,
                                has_anomaly: true,
                                anomaly_ref_no: "A-0012",
                                defect_description: "Pitting corrosion detected on Skirt Pile Guide",
                                qid: "PG N708",
                                inspection_task: "ROV General Visual Inspection",
                                inspection_type_code: "RGVI",
                                timecode_start: "00:06:38",
                                date_time_display: "24/08/2026, 09:30",
                                description: "Skirt Pile Guide was inspected to be in good condition.",
                                remarks: "Skirt Pile Guide was inspected to be in good condition.",
                            },
                            {
                                video_log_id: 4,
                                event_type: "END",
                                event_time: "2026-08-24T02:32:06Z",
                                timecode_start: "01:25:06",
                                remarks: "ROV reposition",
                            },
                        ],
                    },
                ],
            }),
        });

        // Test in Standard Color mode
        const colorBlob = await generateVideoLogReport(
            sampleJobPack,
            sampleStructure,
            "AM26-016-02",
            sampleCompany,
            { returnBlob: true, printFriendly: false, showPageNumbers: true } as any
        );

        expect(colorBlob).toBeTruthy();
        expect(colorBlob).toBeInstanceOf(Blob);

        // Test in Print-Friendly mode
        const pfBlob = await generateVideoLogReport(
            sampleJobPack,
            sampleStructure,
            "AM26-016-02",
            sampleCompany,
            { returnBlob: true, printFriendly: true, showPageNumbers: true } as any
        );

        expect(pfBlob).toBeTruthy();
        expect(pfBlob).toBeInstanceOf(Blob);
    });

    it("generates report with 14 full tape numbers and in-cell volume bars cleanly", async () => {
        // Create 14 tapes with full realistic tape numbers
        const fourteenTapes = Array.from({ length: 14 }, (_, i) => {
            const tapeIdx = String(i + 1).padStart(3, "0");
            const fullTapeNo = `AM26-016-02/BODP-A/V${tapeIdx}R`;
            const hasAnom = i === 2 || i === 7;
            return {
                tape_id: 20000 + i,
                tape_no: fullTapeNo,
                chapter_no: String(i + 1),
                dive_no: `TGR${String(10 + i)}`,
                logs: [
                    {
                        video_log_id: `start_${i}`,
                        event_type: "START_TAPE",
                        timecode_start: "00:00:00",
                        remarks: `Start recording ${fullTapeNo}`,
                    },
                    {
                        video_log_id: `insp_${i}`,
                        event_type: hasAnom ? "ANOMALY" : "INSPECTION",
                        is_inspection: true,
                        has_anomaly: hasAnom,
                        anomaly_ref_no: hasAnom ? `A-00${i + 1}` : undefined,
                        defect_description: hasAnom ? `Marine growth defect on tape ${fullTapeNo}` : undefined,
                        qid: `MEMBER-${i + 1}`,
                        inspection_task: "ROV General Visual Inspection",
                        timecode_start: "00:15:30",
                        remarks: hasAnom ? `Defect found on member` : `Sound member condition`,
                    },
                    {
                        video_log_id: `stop_${i}`,
                        event_type: "STOP_TAPE",
                        timecode_start: "01:00:00",
                        remarks: `End tape ${fullTapeNo}`,
                    },
                ],
            };
        });

        const reportBlob = await generateVideoLogReport(
            sampleJobPack,
            sampleStructure,
            "AM26-016-02",
            sampleCompany,
            { returnBlob: true, tapes: fourteenTapes, printFriendly: false, showPageNumbers: true } as any
        );

        expect(reportBlob).toBeTruthy();
        expect(reportBlob).toBeInstanceOf(Blob);
    });

    it("generates a blank video log report cleanly when requested", async () => {
        const blankBlob = await generateVideoLogReport(
            sampleJobPack,
            sampleStructure,
            "AM26-016-02",
            sampleCompany,
            { returnBlob: true, isBlankReport: true } as any
        );

        expect(blankBlob).toBeTruthy();
        expect(blankBlob).toBeInstanceOf(Blob);
    });
});

