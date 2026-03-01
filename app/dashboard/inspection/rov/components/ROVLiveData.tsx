"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Signal, SignalHigh, SignalLow, SignalZero, Play, Square, Settings, ExternalLink } from "lucide-react";
import Link from "next/link";

interface ROVLiveDataProps {
    rovJob: any;
    autoCapture?: boolean;
}

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
    lastModified: number;
}

export default function ROVLiveData({ rovJob, autoCapture }: ROVLiveDataProps) {
    const [settings, setSettings] = useState<DataAcquisitionSettings | null>(null);
    const [parsedData, setParsedData] = useState<Record<string, string>>({});
    const [connected, setConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [liveDataString, setLiveDataString] = useState("");
    const [serialPort, setSerialPort] = useState<any>(null);
    const [reader, setReader] = useState<any>(null);
    const [isWebSerialSupported, setIsWebSerialSupported] = useState(false);
    const dataBufferRef = useRef<string>('');
    const readableStreamClosedRef = useRef<any>(null);

    useEffect(() => {
        // Check Web Serial API support
        if ('serial' in navigator) {
            setIsWebSerialSupported(true);
        }

        // Load settings from localStorage
        loadDataAcquisitionSettings();
    }, []);

    // Auto-parse data when buffer updates
    useEffect(() => {
        if (connected && liveDataString && settings) {
            parseData(liveDataString);
        }
    }, [liveDataString, connected, settings]);

    // UI Update Loop - throttles updates to prevent flickering
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (connected) {
            interval = setInterval(() => {
                if (dataBufferRef.current) {
                    const snapshot = dataBufferRef.current;
                    setLiveDataString(snapshot.slice(-2000));
                }
            }, 100);
        }
        return () => clearInterval(interval);
    }, [connected]);

    function loadDataAcquisitionSettings() {
        // Try to load platform settings first, then pipeline
        const platformSettings = localStorage.getItem('data_acquisition_platform_v1');
        const pipelineSettings = localStorage.getItem('data_acquisition_pipeline_v1');

        let settingsData = null;
        if (platformSettings) {
            settingsData = JSON.parse(platformSettings);
        } else if (pipelineSettings) {
            settingsData = JSON.parse(pipelineSettings);
        }

        if (settingsData) {
            setSettings(settingsData);
        }
    }

    async function handleStart() {
        if (!settings) {
            alert('No Data Acquisition settings found. Please configure in Settings page.');
            return;
        }

        if (settings.connection.type === 'serial') {
            await connectSerial();
        } else {
            alert('Network connection not yet implemented. Please use Serial connection.');
        }
    }

    async function connectSerial() {
        if (!settings || !isWebSerialSupported) {
            alert('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
            return;
        }

        try {
            // Request a port
            const port = await (navigator as any).serial.requestPort();

            // Open the port with the configured settings
            await port.open({
                baudRate: settings.connection.serial.baudRate,
                dataBits: settings.connection.serial.dataBits,
                parity: settings.connection.serial.parity,
                stopBits: settings.connection.serial.stopBits,
            });

            setSerialPort(port);
            setConnected(true);
            dataBufferRef.current = '';

            // Start reading data
            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            readableStreamClosedRef.current = readableStreamClosed;
            const reader = textDecoder.readable.getReader();
            setReader(reader);

            // Read loop
            const readLoop = async () => {
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        if (value) {
                            dataBufferRef.current += value;

                            // Prevent infinite memory growth
                            if (dataBufferRef.current.length > 10000) {
                                dataBufferRef.current = dataBufferRef.current.slice(-5000);
                            }

                            setLastUpdate(new Date());
                        }
                    }
                } catch (error) {
                    console.error('Error reading from serial port:', error);
                }
            };

            readLoop();
        } catch (error) {
            console.error('Failed to connect to serial port:', error);
            alert('Failed to connect to serial port. Please check your device and try again.');
        }
    }

    async function handleStop() {
        try {
            if (reader) {
                await reader.cancel();
                setReader(null);
            }

            if (readableStreamClosedRef.current) {
                await readableStreamClosedRef.current.catch(() => { });
            }

            if (serialPort) {
                await serialPort.close();
                setSerialPort(null);
            }

            setConnected(false);
            setLiveDataString('');
            setParsedData({});
            dataBufferRef.current = '';
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    }

    function applyModification(value: string, field: FieldMapping): string {
        // Check if alphanumeric
        if (/[a-zA-Z]/.test(value)) return value;

        if (field.modify === 'none') return value;

        const numValue = parseFloat(value);
        if (isNaN(numValue)) return value;

        let result = numValue;
        switch (field.modify) {
            case 'add': result = numValue + field.modifyValue; break;
            case 'subtract': result = numValue - field.modifyValue; break;
            case 'multiply': result = numValue * field.modifyValue; break;
            case 'divide':
                result = field.modifyValue !== 0 ? numValue / field.modifyValue : numValue;
                break;
        }

        return result.toString();
    }

    function parseData(dataString: string) {
        if (!settings) return;

        const parsed: Record<string, string> = {};
        let processedData = dataString;

        // Pre-process data based on parsing method
        if ((settings.parsing.method === 'position' || settings.parsing.method === 'id') && settings.parsing.startCharacter) {
            let startIndex = dataString.lastIndexOf(settings.parsing.startCharacter);

            // Check if we have a full frame
            if (startIndex !== -1 && (startIndex + settings.parsing.stringLength > dataString.length)) {
                startIndex = dataString.lastIndexOf(settings.parsing.startCharacter, startIndex - 1);
            }

            if (startIndex !== -1 && (startIndex + settings.parsing.stringLength <= dataString.length)) {
                processedData = dataString.substring(startIndex, startIndex + settings.parsing.stringLength);
            } else {
                return; // No complete frame found
            }
        }

        settings.fields.forEach(field => {
            let value: string = '';

            // Handle default data options
            if (field.defaultDataOption === 'system_date') {
                value = new Date().toLocaleDateString();
            } else if (field.defaultDataOption === 'system_time') {
                value = new Date().toLocaleTimeString();
            } else {
                // Extract from data string
                if (settings.parsing.method === 'position') {
                    const start = parseInt(field.positionValue);
                    if (!isNaN(start) && start < processedData.length) {
                        value = processedData.substring(start, Math.min(start + field.length, processedData.length));
                    } else {
                        value = '';
                    }

                    // Remove prefix character if it's a letter
                    if (value.length > 0 && /[a-zA-Z]/.test(value[0])) {
                        value = value.substring(1);
                    }
                } else {
                    // ID-based parsing
                    const idPrefix = field.idValue;
                    const escapedPrefix = idPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${escapedPrefix}([^,]+)`);
                    const match = processedData.match(regex);
                    value = match ? match[1].substring(0, field.length) : field.defaultDataValue;

                    // Remove prefix character if it's a letter
                    if (value.length > 0 && /[a-zA-Z]/.test(value[0])) {
                        value = value.substring(1);
                    }
                }
            }

            // Apply modifications
            value = applyModification(value, field);
            parsed[field.label] = value;
        });

        setParsedData(parsed);
    }

    function getSignalIcon() {
        if (!connected) return <SignalZero className="h-4 w-4" />;

        const now = new Date();
        const timeSinceUpdate = lastUpdate
            ? (now.getTime() - lastUpdate.getTime()) / 1000
            : 999;

        if (timeSinceUpdate < 3) return <SignalHigh className="h-4 w-4 text-green-600" />;
        if (timeSinceUpdate < 10) return <SignalLow className="h-4 w-4 text-yellow-600" />;
        return <SignalZero className="h-4 w-4 text-red-600" />;
    }

    if (!settings) {
        return (
            <Card className="p-4 shadow-lg border-slate-200 dark:border-slate-800">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                            Live ROV Data
                        </h3>
                    </div>
                    <div className="py-8 text-center">
                        <Settings className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                            No Data Acquisition Settings Found
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                            Please configure Data Acquisition settings first
                        </p>
                        <Link href="/dashboard/settings/data-acquisition">
                            <Button variant="outline" size="sm" className="gap-2">
                                <Settings className="h-4 w-4" />
                                Open Settings
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4 shadow-lg border-slate-200 dark:border-slate-800">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                        Live ROV Data
                    </h3>
                    <div className="flex items-center gap-2">
                        {getSignalIcon()}
                        <Badge
                            variant={connected ? "default" : "secondary"}
                            className={connected ? "bg-green-600" : ""}
                        >
                            {connected ? "Connected" : "Disconnected"}
                        </Badge>
                    </div>
                </div>

                {/* Control Button */}
                {!connected ? (
                    <Button
                        onClick={handleStart}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="sm"
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Start Data Capture
                    </Button>
                ) : (
                    <Button
                        onClick={handleStop}
                        variant="destructive"
                        className="w-full"
                        size="sm"
                    >
                        <Square className="h-4 w-4 mr-2" />
                        Stop Data Capture
                    </Button>
                )}

                {/* Data Display - Dynamic based on configured fields */}
                {connected && Object.keys(parsedData).length > 0 ? (
                    <div className="space-y-2">
                        {settings.fields.map((field) => (
                            <DataRow
                                key={field.id}
                                label={field.label}
                                value={parsedData[field.label] || '-'}
                                dataType={field.dataType}
                            />
                        ))}
                    </div>
                ) : connected ? (
                    <div className="py-4 text-center">
                        <Signal className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700 animate-pulse" />
                        <p className="text-xs text-muted-foreground">
                            Waiting for data stream...
                        </p>
                    </div>
                ) : (
                    <div className="py-4 text-center">
                        <Signal className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                        <p className="text-xs text-muted-foreground">
                            Click Start to begin capturing data
                        </p>
                    </div>
                )}

                {/* Settings Info */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-900 dark:text-white mb-1">
                        Configuration
                    </p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>Connection: {settings.connection.type === 'serial' ? 'Serial (RS232)' : 'Network'}</div>
                        {settings.connection.type === 'serial' && (
                            <div>Baud Rate: {settings.connection.serial.baudRate}</div>
                        )}
                        <div>Parsing: {settings.parsing.method === 'position' ? 'Position-based' : 'ID-based'}</div>
                        <div>Fields: {settings.fields.length}</div>
                    </div>
                </div>

                {/* Last Update */}
                {lastUpdate && (
                    <div className="text-xs text-muted-foreground text-center">
                        Last update: {lastUpdate.toLocaleTimeString()}
                    </div>
                )}
            </div>
        </Card>
    );
}

function DataRow({
    label,
    value,
    dataType,
}: {
    label: string;
    value: string;
    dataType: 'text' | 'number' | 'date' | 'time';
}) {
    // Color coding based on data type
    let valueClass = "text-slate-900 dark:text-white";
    if (dataType === 'number') {
        valueClass = "text-blue-600 dark:text-blue-400";
    }

    return (
        <div className="flex justify-between items-center text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span className="text-muted-foreground font-medium">{label}:</span>
            <span className={`font-mono ${valueClass}`}>{value}</span>
        </div>
    );
}
