"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

type PresenceContextType = {
    onlineUserIds: Set<string>;
};

const PresenceContext = createContext<PresenceContextType>({ onlineUserIds: new Set() });

export function PresenceProvider({
    userId,
    userEmail,
    children
}: {
    userId: string;
    userEmail?: string;
    children: React.ReactNode;
}) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!userId) return;

        const supabase = createClient();
        let isSubscribed = false;

        const connectPresence = async () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }

            const channel = supabase.channel('online-users', {
                config: {
                    presence: {
                        key: userId,
                    },
                },
            });

            channelRef.current = channel;

            channel.on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState();
                const onlineIds = new Set<string>();

                // Add ourselves immediately to ensure we see our own status 
                // instantly to prevent flickering
                onlineIds.add(userId);

                Object.keys(presenceState).forEach(key => {
                    const presences = presenceState[key] as any[];
                    if (presences && presences.length > 0) {
                        onlineIds.add(presences[0].userId || key);
                    }
                });
                setOnlineUserIds(onlineIds);
            });

            // Also listen to join/leave for instant updates without full sync parsing
            channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
                setOnlineUserIds(prev => {
                    const next = new Set<string>();
                    prev.forEach(id => next.add(id));
                    next.add(key);
                    if (newPresences && newPresences.length > 0 && newPresences[0].userId) {
                        next.add(newPresences[0].userId);
                    }
                    return next;
                });
            });

            channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                setOnlineUserIds(prev => {
                    const next = new Set<string>();
                    prev.forEach(id => next.add(id));
                    next.delete(key);
                    if (leftPresences && leftPresences.length > 0 && leftPresences[0].userId) {
                        next.delete(leftPresences[0].userId);
                    }
                    return next;
                });
            });

            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && !isSubscribed) {
                    isSubscribed = true;
                    // Force an immediate track
                    await channel.track({
                        online_at: new Date().toISOString(),
                        userId,
                        userEmail,
                        status: 'ONLINE'
                    });
                }
            });
        };

        connectPresence();

        // Refresh connection every 2 minutes as a safety ping
        const refreshInterval = setInterval(() => {
            if (channelRef.current && isSubscribed) {
                channelRef.current.track({
                    online_at: new Date().toISOString(),
                    userId,
                    userEmail,
                    ping_at: Date.now()
                });
            }
        }, 120000);

        return () => {
            clearInterval(refreshInterval);
            isSubscribed = false;
            if (channelRef.current) {
                channelRef.current.untrack().then(() => {
                    if (channelRef.current) {
                        supabase.removeChannel(channelRef.current);
                        channelRef.current = null;
                    }
                });
            }
        };
    }, [userId, userEmail]);

    return (
        <PresenceContext.Provider value={{ onlineUserIds }}>
            {children}
        </PresenceContext.Provider>
    );
}

export const usePresence = () => useContext(PresenceContext);
