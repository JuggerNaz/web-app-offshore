"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface FieldMapping {
    id: string;
    label: string;
    positionValue: string;
    idValue: string;
    length: number;
    modify: 'none' | 'add' | 'subtract' | 'multiply' | 'divide';
    modifyValue: number;
    dataType: 'text' | 'number' | 'date' | 'time';
    defaultDataOption: 'online' | 'system_date' | 'system_time';
    defaultDataValue: string;
    targetField: string;
}

interface DataAcquisitionSettings {
    structureType: 'platform' | 'pipeline';
    connection: {
        type: 'serial' | 'network';
        serial: {
            comPort: string;
            baudRate: number;
            dataBits: 5 | 6 | 7 | 8;
            parity: 'none' | 'even' | 'odd';
            stopBits: 1 | 1.5 | 2;
            usbVendorId?: number;
            usbProductId?: number;
        };
        network: {
            protocol: 'tcp' | 'udp';
            ipAddress: string;
            port: number;
        };
    };
    parsing: {
        method: 'position' | 'id';
        stringLength: number;
        startCharacter: string;
    };
    fields: FieldMapping[];
}

interface ROVConnectionContextType {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    fields: Array<{ label: string, targetField: string, value: string }>;
    rawBuffer: string;
    connect: (structureType: 'platform' | 'pipeline', customSettings?: any) => Promise<void>;
    disconnect: () => Promise<void>;
}

const ROVConnectionContext = createContext<ROVConnectionContextType | undefined>(undefined);

const STORAGE_KEYS = {
    platform: 'data_acquisition_platform_v1',
    pipeline: 'data_acquisition_pipeline_v1',
};

export function ROVConnectionProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fields, setFields] = useState<Array<{ label: string, targetField: string, value: string }>>([]);
    const [rawBuffer, setRawBuffer] = useState('');

    const serialPortRef = useRef<any>(null);
    const readerRef = useRef<any>(null);
    const streamClosedRef = useRef<any>(null);
    const dataBufferRef = useRef<string>('');
    const parseIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const rawBufferIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const disconnectionInProgressRef = useRef<boolean>(false);

    const disconnect = useCallback(async (silent = false) => {
        if (disconnectionInProgressRef.current) return;
        disconnectionInProgressRef.current = true;

        try {
            if (parseIntervalRef.current) {
                clearInterval(parseIntervalRef.current);
                parseIntervalRef.current = null;
            }
            if (rawBufferIntervalRef.current) {
                clearInterval(rawBufferIntervalRef.current);
                rawBufferIntervalRef.current = null;
            }
            if (readerRef.current) {
                try {
                    await readerRef.current.cancel();
                } catch (e) {
                    console.warn("[ROV Connection] Reader cancel error:", e);
                }
                readerRef.current = null;
            }
            if (streamClosedRef.current) {
                try {
                    await streamClosedRef.current.catch(() => { });
                } catch (e) { /* ignore */ }
                streamClosedRef.current = null;
            }
            if (serialPortRef.current) {
                try {
                    await serialPortRef.current.close();
                } catch (e) {
                    console.warn("[ROV Connection] Port close error:", e);
                }
                serialPortRef.current = null;
            }
            setIsConnected(false);
            setRawBuffer('');
            setFields(prev => prev.map(f => ({ ...f, value: '--' })));
            if (!silent) toast.success('ROV Data disconnected.');
        } catch (e: any) {
            console.error('Error disconnecting ROV serial:', e);
            if (!silent) toast.error('Error disconnecting: ' + (e?.message || 'Unknown error'));
        } finally {
            disconnectionInProgressRef.current = false;
        }
    }, []);

    const connect = useCallback(async (structureType: 'platform' | 'pipeline', customSettings?: any) => {
        setError(null);
        setIsConnecting(true);

        // Check for Web Serial support
        if (typeof window === 'undefined' || !('serial' in navigator)) {
            const msg = 'Web Serial API not supported in this browser.';
            setError(msg);
            setIsConnecting(false);
            toast.error(msg);
            return;
        }

        // Close existing connection if any
        if (serialPortRef.current) {
            console.log("[ROV Connection] Closing existing connection before re-connecting...");
            await disconnect(true);
        }

        let settings: DataAcquisitionSettings | null = null;
        if (customSettings) {
            settings = customSettings as DataAcquisitionSettings;
        } else {
            const saved = localStorage.getItem(STORAGE_KEYS[structureType]);
            if (saved) {
                try { settings = JSON.parse(saved); } catch (e) { /* ignore */ }
            }
        }

        if (!settings) {
            const msg = 'No settings configured for ' + structureType + '. Please configure in Settings.';
            setError(msg);
            setIsConnecting(false);
            toast.error(msg);
            return;
        }

        if (settings.connection.type !== 'serial') {
            const msg = 'Only Serial connection is supported in browser.';
            setError(msg);
            setIsConnecting(false);
            toast.error(msg);
            return;
        }

        try {
            let port: any = null;

            // 1. Try to find an ALREADY AUTHORIZED port first (to avoid the browser picker)
            const authorizedPorts = await (navigator as any).serial.getPorts();
            if (authorizedPorts.length > 0) {
                const serialSettings = settings.connection.serial || {};
                
                // If we have saved port info (like VID/PID), we could match specifically.
                // For now, if there's only one authorized port, we use it.
                // If there are multiple, we pick the first one, or the one matching VID/PID.
                if (authorizedPorts.length === 1) {
                    port = authorizedPorts[0];
                    console.log("[ROV Connection] Using single authorized port:", port);
                } else {
                    // Try to match by VID/PID if saved in settings
                    const targetVid = serialSettings.usbVendorId;
                    const targetPid = serialSettings.usbProductId;
                    
                    if (targetVid && targetPid) {
                        port = authorizedPorts.find((p: any) => {
                            const info = p.getInfo();
                            return info.usbVendorId === targetVid && info.usbProductId === targetPid;
                        });
                        if (port) console.log("[ROV Connection] Found matching authorized port:", port);
                    }
                }
            }

            // 2. Fallback to manual picker if no authorized port found or it failed to match
            if (!port) {
                console.log("[ROV Connection] No matching authorized port, requesting manual selection...");
                port = await (navigator as any).serial.requestPort();
            }

            const serialSettings = settings.connection.serial || {};
            await port.open({
                baudRate: Number(serialSettings.baudRate) || 9600,
                dataBits: Number(serialSettings.dataBits) || 8,
                parity: (serialSettings.parity as any) || 'none',
                stopBits: Number(serialSettings.stopBits) || 1,
            });

            // Save VID/PID to settings for future auto-connect (persistent)
            const info = port.getInfo();
            if (info.usbVendorId && !serialSettings.usbVendorId) {
                // We update the local storage with the fingerprinted info
                const saved = localStorage.getItem(STORAGE_KEYS[structureType]);
                if (saved) {
                    try {
                        const fullSettings = JSON.parse(saved);
                        fullSettings.connection.serial.usbVendorId = info.usbVendorId;
                        fullSettings.connection.serial.usbProductId = info.usbProductId;
                        localStorage.setItem(STORAGE_KEYS[structureType], JSON.stringify(fullSettings));
                    } catch (e) { /* ignore */ }
                }
            }

            serialPortRef.current = port;
            dataBufferRef.current = '';
            setRawBuffer('');

            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            streamClosedRef.current = readableStreamClosed;
            const reader = textDecoder.readable.getReader();
            readerRef.current = reader;

            setIsConnected(true);
            setIsConnecting(false);
            toast.success('ROV Data connected!');

            // Setup field tracking
            if (settings.fields && settings.fields.length > 0) {
                setFields(settings.fields.map(f => ({
                    label: f.label || '?',
                    targetField: f.targetField || f.label || 'field',
                    value: '--'
                })));
            }

            // Read loop - only updates the ref buffer (fast, no re-renders)
            const readLoop = async () => {
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        if (value) {
                            dataBufferRef.current += value;
                            if (dataBufferRef.current.length > 10000) {
                                dataBufferRef.current = dataBufferRef.current.slice(-5000);
                            }
                        }
                    }
                } catch (e) { /* reader cancelled */ }
            };
            readLoop();

            // UI Throttled raw buffer update (every 100ms)
            // This prevents "Maximum update depth exceeded" when data arrives rapidly
            rawBufferIntervalRef.current = setInterval(() => {
                setRawBuffer(dataBufferRef.current);
            }, 100);

            // Parse interval
            const parseMethod = settings.parsing?.method || 'position';
            const startChar = settings.parsing?.startCharacter || '$';
            const strLen = settings.parsing?.stringLength || 100;
            const fieldsDef = settings.fields || [];

            parseIntervalRef.current = setInterval(() => {
                if (!dataBufferRef.current) return;
                const data = dataBufferRef.current;
                let processedData = data;

                if (startChar && strLen > 0) {
                    let startIndex = data.lastIndexOf(startChar);
                    if (startIndex !== -1 && (startIndex + strLen > data.length)) {
                        startIndex = data.lastIndexOf(startChar, startIndex - 1);
                    }
                    if (startIndex !== -1 && (startIndex + strLen <= data.length)) {
                        processedData = data.substring(startIndex, startIndex + strLen);
                    } else {
                        return;
                    }
                }

                setFields(prev => prev.map(f => {
                    const fieldDef = fieldsDef.find((fd: any) => (fd.targetField || fd.label) === f.targetField);
                    if (!fieldDef) return f;

                    let val = '';
                    if (fieldDef.defaultDataOption === 'system_date') {
                        val = new Date().toISOString().split('T')[0];
                    } else if (fieldDef.defaultDataOption === 'system_time') {
                        val = new Date().toTimeString().split(' ')[0];
                    } else if (parseMethod === 'position') {
                        const start = parseInt(fieldDef.positionValue || '0');
                        if (!isNaN(start) && start < processedData.length) {
                            val = processedData.substring(start, Math.min(start + (fieldDef.length || 1), processedData.length));
                            if (val.length > 0 && /[a-zA-Z]/.test(val[0])) val = val.substring(1);
                        }
                    } else {
                        const idPrefix = fieldDef.idValue || fieldDef.label;
                        const escapedPrefix = idPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`${escapedPrefix}([^,]+)`);
                        const match = processedData.match(regex);
                        val = match ? match[1].substring(0, fieldDef.length || 10) : '';
                        if (val.length > 0 && /[a-zA-Z]/.test(val[0])) val = val.substring(1);
                    }

                    // Apply modification
                    if (fieldDef.modify && fieldDef.modify !== 'none' && val && !/[a-zA-Z]/.test(val)) {
                        const numVal = parseFloat(val);
                        if (!isNaN(numVal)) {
                            switch (fieldDef.modify) {
                                case 'add': val = (numVal + (fieldDef.modifyValue || 0)).toString(); break;
                                case 'subtract': val = (numVal - (fieldDef.modifyValue || 0)).toString(); break;
                                case 'multiply': val = (numVal * (fieldDef.modifyValue || 1)).toString(); break;
                                case 'divide': val = (fieldDef.modifyValue ? (numVal / fieldDef.modifyValue) : numVal).toString(); break;
                            }
                        }
                    }

                    return { ...f, value: val || '--' };
                }));
            }, 200);

        } catch (error: any) {
            const msg = error?.message || 'Failed to connect to serial port.';
            setError(msg);
            setIsConnecting(false);
            toast.error(`Connection failed: ${msg}`);
        }
    }, [disconnect]);

    // Cleanup on unmount (global cleanup)
    useEffect(() => {
        return () => {
            if (serialPortRef.current) {
                console.log("[ROV Connection] Global cleanup on provider unmount");
                disconnect(true);
            }
        };
    }, [disconnect]);

    return (
        <ROVConnectionContext.Provider value={{
            isConnected,
            isConnecting,
            error,
            fields,
            rawBuffer,
            connect,
            disconnect
        }}>
            {children}
        </ROVConnectionContext.Provider>
    );
}

export function useROVConnection() {
    const context = useContext(ROVConnectionContext);
    if (context === undefined) {
        throw new Error('useROVConnection must be used within a ROVConnectionProvider');
    }
    return context;
}
