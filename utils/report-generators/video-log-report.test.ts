import { describe, it, expect, vi } from "vitest";
import {
    parseTimecodeToSeconds,
    formatTimecode,
    formatInspectionDateTime,
    getInspectionTaskName,
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
    });

    it("formats timecode into HH:MM:SS properly", () => {
        expect(formatTimecode(0)).toBe("00:00:00");
        expect(formatTimecode(398)).toBe("00:06:38");
        expect(formatTimecode("398")).toBe("00:06:38");
        expect(formatTimecode("00:06:38")).toBe("00:06:38");
        expect(formatTimecode("6:38")).toBe("00:06:38");
        expect(formatTimecode(null)).toBe("—");
        expect(formatTimecode("")).toBe("—");
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

    it("generates a video log report containing inspection logs with QID and Task", async () => {
        // Mock global fetch to return sample video log data with inspection records
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

        const blob = await generateVideoLogReport(
            sampleJobPack,
            sampleStructure,
            "AM26-016-02",
            sampleCompany,
            { returnBlob: true, printFriendly: true } as any
        );

        expect(blob).toBeTruthy();
        expect(blob).toBeInstanceOf(Blob);
    });
});
