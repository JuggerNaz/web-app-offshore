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
    const heartbeatFailed = useRef(false);
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

                // Add ourselves immediately to prevent flickering
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
                    // Initial track and heartbeat
                    await channel.track({
                        online_at: new Date().toISOString(),
                        userId,
                        userEmail,
                        status: 'ONLINE'
                    });

                    if (!heartbeatFailed.current) {
                        supabase.rpc('update_user_heartbeat').then(({ error }) => {
                            if (error) {
                                if (error.code === 'PGRST202') {
                                    heartbeatFailed.current = true;
                                    console.warn("Presence heartbeat function missing. Disabling DB heartbeat tracking.");
                                } else {
                                    console.error("Initial heartbeat error:", error.message || error);
                                }
                            }
                        });
                    }
                }
            });
        };

        connectPresence();

        // Refresh connection and heartbeat every 60 seconds
        const refreshInterval = setInterval(() => {
            if (channelRef.current && isSubscribed) {
                channelRef.current.track({
                    online_at: new Date().toISOString(),
                    userId,
                    userEmail,
                    ping_at: Date.now()
                });

                // Database Heartbeat for persistent "last active" tracking
                if (!heartbeatFailed.current) {
                    supabase.rpc('update_user_heartbeat').then(({ error }) => {
                        if (error) {
                            if (error.code === 'PGRST202') {
                                heartbeatFailed.current = true;
                                console.warn("Presence heartbeat function missing. Disabling DB heartbeat tracking.");
                            } else {
                                // Only log if it's a real error and we have details
                                if (error.message || error.code) {
                                    console.error("Heartbeat interval error:", error.message || error.code);
                                }
                            }
                        }
                    });
                }
            }
        }, 60000);

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
