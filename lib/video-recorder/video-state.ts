import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export interface VideoLog {
    id: string;
    timestamp: string;
    timecode: string;
    event_type: string;
    remarks: string;
}

// Global State - Persistent
export const videoTapeIdAtom = atomWithStorage<number | null>('videoTapeId', null); // Database ID
export const videoTapeNoAtom = atomWithStorage<string>('videoTapeNo', ""); // Tape Number string
export const videoTimeCodeAtom = atom<string>("00:00:00"); // Formatted timecode (Derived/Ephemeral)
export const videoCounterAtom = atomWithStorage<number>('videoCounter', 0); // Raw seconds count (Persistent)

// Recording State - Persistent to recover state (logic must handle resumption)
export const isRecordingAtom = atomWithStorage<boolean>('isRecording', false); // Media Recording Active
export const isStreamingAtom = atomWithStorage<boolean>('isStreaming', false); // Camera Stream Active
export const isPausedAtom = atomWithStorage<boolean>('isPaused', false); // Recording/Task Paused
export const recordingStartTimeAtom = atomWithStorage<number | null>('recordingStartTime', null); // For resuming counter

// Task/Counter State
export const isTaskRunningAtom = atomWithStorage<boolean>('isTaskRunning', false); // Inspection Task Active
export const isTaskPausedAtom = atomWithStorage<boolean>('isTaskPaused', false); // Inspection Task Paused
export const lastActiveTimestampAtom = atomWithStorage<number | null>('lastActiveTimestamp', null); // To calculate elapsed time on resume
export const taskStartTimeAtom = atomWithStorage<number | null>('taskStartTime', null); // When current segment started
export const taskBaseDurationAtom = atomWithStorage<number>('taskBaseDuration', 0); // Accumulated duration before current segment

export const videoLogsAtom = atomWithStorage<VideoLog[]>('videoLogs', []); // Persist logs locally
