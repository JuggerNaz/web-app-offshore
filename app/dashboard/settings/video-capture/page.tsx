'use client';

import { ToastProvider } from '@/components/ui/toast';
import VideoRecorderSettings from '@/components/video-recorder-settings';

export default function VideoRecorderSettingsPage() {
    return (
        <ToastProvider>
            <VideoRecorderSettings />
        </ToastProvider>
    );
}
