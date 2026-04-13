import { useCallback, useEffect } from "react";

export function useTapeDuration(
    videoEvents: any[], 
    vidState: "IDLE" | "RECORDING" | "PAUSED", 
    tapeId: number | null,
    setVidTimer: (val: number) => void
) {
    const calculateTapeDuration = useCallback((tId: number | null) => {
        if (!tId) return 0;
        const events = videoEvents.filter(ev => ev.tapeId === tId && ev.logType === 'video_log');
        if (events.length === 0) return 0;

        // Sort events ascending to process timeline
        const sorted = [...events].sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());
        
        let totalMs = 0;
        let lastStart: number | null = null;

        sorted.forEach(ev => {
            const time = new Date(ev.eventTime).getTime();
            if (ev.action === "Start Tape" || ev.action === "Resume") {
                lastStart = time;
            } else if (ev.action === "Pause" || ev.action === "Stop Tape") {
                if (lastStart) {
                    totalMs += (time - lastStart);
                    lastStart = null;
                }
            }
        });

        // If currently recording/resumed without a stop/pause yet
        if (lastStart && vidState === 'RECORDING') {
            totalMs += (new Date().getTime() - lastStart);
        }

        return Math.floor(totalMs / 1000);
    }, [videoEvents, vidState]);

    // Update timer when tape selection changes or events update
    useEffect(() => {
        if (!tapeId) {
            setVidTimer(0);
            return;
        }
        
        const duration = calculateTapeDuration(tapeId);
        setVidTimer(duration);
    }, [tapeId, videoEvents, calculateTapeDuration, setVidTimer]);

    return { calculateTapeDuration };
}
