import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Activity, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ConnectionType = 'serial' | 'network';
type ParseMethod = 'position' | 'id';
type StructureType = 'platform' | 'pipeline';
type DefaultDataOption = 'online' | 'system_date' | 'system_time';

interface FieldMapping {
    id: string;
    label: string;
    positionValue: string;
    idValue: string;
    length: number;
    modify: 'none' | 'add' | 'subtract' | 'multiply' | 'divide';
    modifyValue: number;
    dataType: 'text' | 'number' | 'date' | 'time';
    defaultDataOption: DefaultDataOption;
    defaultDataValue: string;
    targetField: string;
}

interface DataAcquisitionSettings {
    structureType: StructureType;
    connection: {
        type: ConnectionType;
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
        method: ParseMethod;
        stringLength: number;
        startCharacter: string;
    };
    fields: FieldMapping[];
    lastModified: number;
}

const STORAGE_KEYS = {
    platform: 'data_acquisition_platform_v1',
    pipeline: 'data_acquisition_pipeline_v1',
};

interface ROVDataStringBannerProps {
    structureType: StructureType;
}

export function ROVDataStringBanner({ structureType }: ROVDataStringBannerProps) {
    const [settings, setSettings] = useState<DataAcquisitionSettings | null>(null);
    const [fields, setFields] = useState<FieldMapping[]>([]);

    // Connection Status
    const [isConnected, setIsConnected] = useState(false);
    const [liveData, setLiveData] = useState('');
    const [parsedData, setParsedData] = useState<Record<string, string>>({});

    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Construct return URL
    const returnPath = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
    const settingsUrl = `/dashboard/settings/data-acquisition?returnTo=${encodeURIComponent(returnPath)}`;

    // Web Serial API
    const [serialPort, setSerialPort] = useState<any>(null);
    const [reader, setReader] = useState<any>(null);
    const [isWebSerialSupported, setIsWebSerialSupported] = useState(false);
    const dataBufferRef = useRef<string>('');
    const readableStreamClosedRef = useRef<any>(null);

    // Initial check for Web Serial support
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serial' in navigator) {
            setIsWebSerialSupported(true);
        }
    }, []);

    // Load settings from localStorage when structureType changes
    useEffect(() => {
        const loadSettings = () => {
            const saved = localStorage.getItem(STORAGE_KEYS[structureType]);
            if (saved) {
                try {
                    const parsedSettings = JSON.parse(saved) as DataAcquisitionSettings;
                    setSettings(parsedSettings);
                    setFields(parsedSettings.fields || []);
                } catch (error) {
                    console.error('Failed to parse saved settings:', error);
                }
            } else {
                setSettings(null);
                setFields([]);
            }
        };

        loadSettings();

        // Listen to storage events just in case they're updated in another tab
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEYS[structureType]) {
                loadSettings();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);

    }, [structureType]);

    const applyModification = (value: string, field: FieldMapping): string => {
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
    };

    const parseData = (dataString: string) => {
        if (!settings) return;
        const parsed: Record<string, string> = {};

        const { method: parseMethod, stringLength, startCharacter } = settings.parsing;
        let processedData = dataString;

        if ((parseMethod === 'position' || parseMethod === 'id') && startCharacter) {
            let startIndex = dataString.lastIndexOf(startCharacter);

            if (startIndex !== -1 && (startIndex + stringLength > dataString.length)) {
                startIndex = dataString.lastIndexOf(startCharacter, startIndex - 1);
            }

            if (startIndex !== -1 && (startIndex + stringLength <= dataString.length)) {
                processedData = dataString.substring(startIndex, startIndex + stringLength);
            } else {
                return;
            }
        }

        fields.forEach(field => {
            let value: string = '';

            if (field.defaultDataOption === 'system_date') {
                value = new Date().toLocaleDateString();
            } else if (field.defaultDataOption === 'system_time') {
                value = new Date().toLocaleTimeString();
            } else {
                if (parseMethod === 'position') {
                    const start = parseInt(field.positionValue);
                    if (!isNaN(start) && start < processedData.length) {
                        value = processedData.substring(start, Math.min(start + field.length, processedData.length));
                    }
                    if (value.length > 0 && /[a-zA-Z]/.test(value[0])) {
                        value = value.substring(1);
                    }
                } else {
                    const idPrefix = field.idValue;
                    const escapedPrefix = idPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${escapedPrefix}([^,]+)`);
                    const match = processedData.match(regex);
                    value = match ? match[1].substring(0, field.length) : field.defaultDataValue;

                    if (value.length > 0 && /[a-zA-Z]/.test(value[0])) {
                        value = value.substring(1);
                    }
                }
            }

            value = applyModification(value, field);
            parsed[field.label] = value;
        });

        setParsedData(parsed);
    };

    // UI Update Loop for Parsed Data
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isConnected) {
            interval = setInterval(() => {
                if (dataBufferRef.current && settings) {
                    const snapshot = dataBufferRef.current;
                    let validEndIndex = snapshot.length;

                    if ((settings.parsing.method === 'position' || settings.parsing.method === 'id') && settings.parsing.startCharacter && settings.parsing.stringLength > 0) {
                        const lastStartIndex = snapshot.lastIndexOf(settings.parsing.startCharacter);
                        if (lastStartIndex !== -1 && (snapshot.length - lastStartIndex) < settings.parsing.stringLength) {
                            validEndIndex = lastStartIndex;
                        }
                    }

                    const validContent = snapshot.substring(0, validEndIndex);
                    // Pass only the most recent complete frame block or enough context to parseData
                    parseData(validContent.slice(-2000));
                }
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isConnected, settings, fields]);

    const handleConnectToggle = async () => {
        if (isConnected) {
            handleDisconnect();
            return;
        }

        if (!settings) {
            alert('Settings not found. Please click Settings to configure Data Acquisition.');
            return;
        }

        if (settings.connection.type === 'network') {
            alert('Network connection is not implemented in this version.');
            return;
        }

        if (!isWebSerialSupported) {
            alert('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
            return;
        }

        try {
            const port = await (navigator as any).serial.requestPort();
            await port.open({
                baudRate: settings.connection.serial.baudRate,
                dataBits: settings.connection.serial.dataBits,
                parity: settings.connection.serial.parity,
                stopBits: settings.connection.serial.stopBits,
            });

            setSerialPort(port);
            setIsConnected(true);
            dataBufferRef.current = '';

            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            readableStreamClosedRef.current = readableStreamClosed;
            const reader = textDecoder.readable.getReader();
            setReader(reader);

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
                } catch (error) {
                    console.error('Error reading from serial port:', error);
                }
            };

            readLoop();

        } catch (error) {
            console.error('Failed to connect to serial port:', error);
            alert('Failed to connect to serial port. Cannot establish connection.');
        }
    };

    const handleDisconnect = async () => {
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
            setIsConnected(false);
            setParsedData({});
        } catch (error) {
            console.error('Error disconnecting from serial port:', error);
        }
    };

    const comDisplay = settings?.connection.type === 'serial' ? (settings.connection.serial.comPort || 'Serial') : (settings?.connection.network.ipAddress || 'Network');

    return (
        <Card className="shrink-0 mb-3 overflow-hidden shadow-sm border border-cyan-200 dark:border-cyan-900 bg-cyan-50/50 dark:bg-cyan-950/10">
            <div className="flex flex-col md:flex-row items-center justify-between">

                {/* Title & Status */}
                <div className="flex items-center gap-4 px-4 py-3 border-b md:border-b-0 md:border-r border-cyan-200 dark:border-cyan-800 bg-cyan-100/30 dark:bg-cyan-900/20 shrink-0 min-w-[200px]">
                    <Activity className="h-5 w-5 text-cyan-600" />
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-cyan-100 uppercase tracking-wider">ROV Data String</h3>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 mt-1 relative">
                            <Button
                                variant={isConnected ? "default" : "outline"}
                                className={`h-6 text-[10px] px-2 gap-1 rounded ${isConnected ? "bg-green-600 hover:bg-green-700 text-white" : "text-slate-600 dark:text-slate-400"}`}
                                onClick={handleConnectToggle}
                            >
                                {isConnected ? (
                                    <>
                                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
                                        Connected
                                    </>
                                ) : "Connect"}
                            </Button>
                            {isConnected && (
                                <span className="font-mono bg-white/60 dark:bg-slate-800/60 px-1 rounded border border-cyan-100 dark:border-cyan-800 ml-1">
                                    {comDisplay}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Data Values Horizontal List */}
                <div className="flex-1 flex items-center justify-start md:justify-around px-2 py-3 gap-6 overflow-x-auto min-w-0">
                    {fields.length > 0 ? fields.map(field => (
                        <div key={field.id} className="flex flex-col items-center min-w-[60px]">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">{field.label}</span>
                            <span className="font-bold font-mono text-base text-slate-800 dark:text-slate-200">
                                {parsedData[field.label] !== undefined ? parsedData[field.label] : '-'}
                            </span>
                        </div>
                    )) : (
                        <span className="text-xs text-muted-foreground italic">No fields configured. Setup data acquisition settings.</span>
                    )}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-t md:border-t-0 md:border-l border-cyan-200 dark:border-cyan-800 shrink-0">
                    <Link href={settingsUrl}>
                        <Button variant="outline" size="sm" className="gap-2 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700 hover:bg-cyan-100 dark:hover:bg-cyan-800/50">
                            <Settings className="h-4 w-4" />
                            Settings
                        </Button>
                    </Link>
                </div>
            </div>
        </Card>
    );
}
