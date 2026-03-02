import { atom } from 'jotai';

// Atoms to share video recorder state with other components
export const videoTapeIdAtom = atom<number | null>(null); // Database ID
export const videoTapeNoAtom = atom<string>(""); // Tape Number string
export const videoTimeCodeAtom = atom<string>("00:00:00"); // Formatted timecode
export const videoCounterAtom = atom<number>(0); // Raw seconds count
export const isRecordingAtom = atom<boolean>(false);
export const isStreamingAtom = atom<boolean>(false);
