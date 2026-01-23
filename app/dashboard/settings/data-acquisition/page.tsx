'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Wifi, Cable, Activity, Settings2, Play, Square, Trash2, Download, Upload, Building2, GitBranch } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ConnectionType = 'serial' | 'network';
type ParseMethod = 'position' | 'id';
type Protocol = 'tcp' | 'udp';
type StructureType = 'platform' | 'pipeline';
type DefaultDataOption = 'online' | 'system_date' | 'system_time';

interface FieldMapping {
    id: string;
    label: string;
    positionValue: string;  // For position-based parsing
    idValue: string;        // For ID-based parsing
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
            protocol: Protocol;
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

export default function DataAcquisitionPage() {
    // Structure Type
    const [structureType, setStructureType] = useState<StructureType>('platform');

    // Connection Settings
    const [connectionType, setConnectionType] = useState<ConnectionType>('serial');
    const [comPort, setComPort] = useState<string>('');
    const [availablePorts, setAvailablePorts] = useState<Array<{ id: string, name: string }>>([]);
    const [baudRate, setBaudRate] = useState(9600);
    const [dataBits, setDataBits] = useState<5 | 6 | 7 | 8>(8);
    const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
    const [stopBits, setStopBits] = useState<1 | 1.5 | 2>(1);

    const [protocol, setProtocol] = useState<Protocol>('tcp');
    const [ipAddress, setIpAddress] = useState('192.168.1.100');
    const [port, setPort] = useState(5000);

    // Parsing Settings
    const [parseMethod, setParseMethod] = useState<ParseMethod>('position');
    const [stringLength, setStringLength] = useState(100);
    const [startCharacter, setStartCharacter] = useState('$');

    // Field Mappings
    const [fields, setFields] = useState<FieldMapping[]>([]);

    // Connection Status
    const [isConnected, setIsConnected] = useState(false);
    const [liveData, setLiveData] = useState('');
    const [parsedData, setParsedData] = useState<Record<string, string>>({});

    // Web Serial API
    const [serialPort, setSerialPort] = useState<any>(null);
    const [reader, setReader] = useState<any>(null);
    const [isWebSerialSupported, setIsWebSerialSupported] = useState(false);

    // Check Web Serial API support and get available ports
    useEffect(() => {
        const checkSerialSupport = async () => {
            if ('serial' in navigator) {
                setIsWebSerialSupported(true);
                await refreshAvailablePorts();
            }
        };
        checkSerialSupport();
    }, []);

    // Function to refresh available ports
    const refreshAvailablePorts = async () => {
        if ('serial' in navigator) {
            try {
                const ports = await (navigator as any).serial.getPorts();
                const portList = ports.map((port: any, index: number) => {
                    const info = port.getInfo();
                    const vendorId = info.usbVendorId ? `VID:${info.usbVendorId.toString(16).toUpperCase().padStart(4, '0')}` : '';
                    const productId = info.usbProductId ? `PID:${info.usbProductId.toString(16).toUpperCase().padStart(4, '0')}` : '';

                    // Create a descriptive name with COM port number
                    let deviceInfo = [vendorId, productId].filter(Boolean).join(' ');
                    const portNumber = index + 1;
                    const name = deviceInfo
                        ? `COM${portNumber} - ${deviceInfo}`
                        : `COM${portNumber} - Serial Device`;

                    return {
                        id: `port-${index}`,
                        name: name
                    };
                });
                setAvailablePorts(portList);
                if (portList.length > 0 && !comPort) {
                    setComPort(portList[0].id);
                }
            } catch (error) {
                console.error('Error getting serial ports:', error);
            }
        }
    };

    // Get default settings based on structure type
    const getDefaultSettings = (type: StructureType): DataAcquisitionSettings => {
        const platformFields: FieldMapping[] = [
            {
                id: '1',
                label: 'N',
                positionValue: '0',
                idValue: 'N',
                length: 8,
                modify: 'none',
                modifyValue: 0,
                dataType: 'text',
                defaultDataOption: 'online',
                defaultDataValue: '',
                targetField: 'northing'
            },
            {
                id: '2',
                label: 'E',
                positionValue: '8',
                idValue: 'E',
                length: 8,
                modify: 'none',
                modifyValue: 0,
                dataType: 'text',
                defaultDataOption: 'online',
                defaultDataValue: '',
                targetField: 'easting'
            },
            {
                id: '3',
                label: 'D',
                positionValue: '16',
                idValue: 'D',
                length: 5,
                modify: 'divide',
                modifyValue: 10,
                dataType: 'number',
                defaultDataOption: 'online',
                defaultDataValue: '0',
                targetField: 'depth'
            },
            {
                id: '4',
                label: 'CP',
                positionValue: '21',
                idValue: 'CP',
                length: 7,
                modify: 'none',
                modifyValue: 0,
                dataType: 'number',
                defaultDataOption: 'online',
                defaultDataValue: '0',
                targetField: 'cp_reading'
            },
        ];

        const pipelineFields: FieldMapping[] = [
            {
                id: '1',
                label: 'KP',
                positionValue: '0',
                idValue: 'KP',
                length: 10,
                modify: 'none',
                modifyValue: 0,
                dataType: 'text',
                defaultDataOption: 'online',
                defaultDataValue: '',
                targetField: 'kilometer_post'
            },
            {
                id: '2',
                label: 'D',
                positionValue: '10',
                idValue: 'D',
                length: 5,
                modify: 'divide',
                modifyValue: 10,
                dataType: 'number',
                defaultDataOption: 'online',
                defaultDataValue: '0',
                targetField: 'depth'
            },
            {
                id: '3',
                label: 'CP',
                positionValue: '15',
                idValue: 'CP',
                length: 7,
                modify: 'none',
                modifyValue: 0,
                dataType: 'number',
                defaultDataOption: 'online',
                defaultDataValue: '0',
                targetField: 'cp_reading'
            },
        ];

        return {
            structureType: type,
            connection: {
                type: 'serial',
                serial: { comPort: 'COM1', baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1 },
                network: { protocol: 'tcp', ipAddress: '192.168.1.100', port: 5000 },
            },
            parsing: {
                method: 'position',
                stringLength: 100,
                startCharacter: '$',
            },
            fields: type === 'platform' ? platformFields : pipelineFields,
            lastModified: Date.now(),
        };
    };

    // Load settings when structure type changes
    useEffect(() => {
        loadSettings(structureType);
    }, [structureType]);

    // Auto-parse data when fields or liveData changes (Real-time updates - Requirement F)
    useEffect(() => {
        if (isConnected && liveData) {
            parseData(liveData);
        }
    }, [fields, parseMethod, liveData, isConnected]);

    // No longer need this useEffect - values are preserved in separate fields

    const loadSettings = (type: StructureType) => {
        const saved = localStorage.getItem(STORAGE_KEYS[type]);
        let settings: DataAcquisitionSettings;

        if (saved) {
            try {
                settings = JSON.parse(saved);
                console.log(`Loaded saved settings for ${type}:`, settings);

                // Migrate old format to new format if needed
                if (settings.fields && settings.fields.length > 0) {
                    settings.fields = settings.fields.map((field: any) => {
                        // Check if field has old format (startIdOrPosition) instead of new format
                        if ('startIdOrPosition' in field && !('positionValue' in field)) {
                            return {
                                ...field,
                                positionValue: /^\d+$/.test(field.startIdOrPosition) ? field.startIdOrPosition : '0',
                                idValue: /^\d+$/.test(field.startIdOrPosition) ? (field.label || '') : field.startIdOrPosition,
                            } as FieldMapping;
                        }
                        // Ensure both fields exist with default values
                        return {
                            ...field,
                            positionValue: field.positionValue || '0',
                            idValue: field.idValue || field.label || '',
                        } as FieldMapping;
                    });
                }
            } catch (error) {
                console.error('Failed to parse saved settings:', error);
                settings = getDefaultSettings(type);
            }
        } else {
            console.log(`No saved settings for ${type}, using defaults`);
            settings = getDefaultSettings(type);
        }

        // Update all state variables
        setConnectionType(settings.connection.type);
        setComPort(settings.connection.serial.comPort || 'COM1');
        setBaudRate(settings.connection.serial.baudRate);
        setDataBits(settings.connection.serial.dataBits);
        setParity(settings.connection.serial.parity);
        setStopBits(settings.connection.serial.stopBits);
        setProtocol(settings.connection.network.protocol);
        setIpAddress(settings.connection.network.ipAddress);
        setPort(settings.connection.network.port);
        setParseMethod(settings.parsing.method);
        setStringLength(settings.parsing.stringLength);
        setStartCharacter(settings.parsing.startCharacter);
        setFields(settings.fields);
    };

    const saveSettings = () => {
        const settings: DataAcquisitionSettings = {
            structureType,
            connection: {
                type: connectionType,
                serial: { comPort, baudRate, dataBits, parity, stopBits },
                network: { protocol, ipAddress, port },
            },
            parsing: {
                method: parseMethod,
                stringLength,
                startCharacter,
            },
            fields,
            lastModified: Date.now(),
        };

        localStorage.setItem(STORAGE_KEYS[structureType], JSON.stringify(settings));
        alert(`Settings saved for ${structureType}!`);
    };

    const exportSettings = () => {
        const settings = localStorage.getItem(STORAGE_KEYS[structureType]);
        if (settings) {
            const blob = new Blob([settings], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `data_acquisition_${structureType}_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const settings = JSON.parse(e.target?.result as string);
                    localStorage.setItem(STORAGE_KEYS[structureType], JSON.stringify(settings));
                    loadSettings(structureType);
                    alert('Settings imported successfully!');
                } catch (error) {
                    alert('Invalid settings file');
                }
            };
            reader.readAsText(file);
        }
    };

    const addField = () => {
        const newField: FieldMapping = {
            id: Date.now().toString(),
            label: '',
            positionValue: '0',
            idValue: '',
            length: 1,
            modify: 'none',
            modifyValue: 0,
            dataType: 'text',
            defaultDataOption: 'online',
            defaultDataValue: '',
            targetField: '',
        };
        setFields([...fields, newField]);
    };

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const updateField = (id: string, updates: Partial<FieldMapping>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const handleConnect = async () => {
        if (!isWebSerialSupported) {
            alert('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
            return;
        }

        try {
            // Request a port
            const port = await (navigator as any).serial.requestPort();

            // Open the port with the configured settings
            await port.open({
                baudRate: baudRate,
                dataBits: dataBits,
                parity: parity,
                stopBits: stopBits,
            });

            setSerialPort(port);
            setIsConnected(true);

            // Refresh available ports list
            await refreshAvailablePorts();

            // Start reading data
            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            const reader = textDecoder.readable.getReader();
            setReader(reader);

            // Read loop
            const readLoop = async () => {
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) {
                            break;
                        }
                        if (value) {
                            // Append new data
                            setLiveData(prev => {
                                const newData = prev + value;
                                // Keep only the last 1000 characters to prevent memory issues
                                return newData.slice(-1000);
                            });
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
    };

    const handleDisconnect = async () => {
        try {
            // Cancel the reader
            if (reader) {
                await reader.cancel();
                setReader(null);
            }

            // Close the port
            if (serialPort) {
                await serialPort.close();
                setSerialPort(null);
            }

            setIsConnected(false);
            setLiveData('');
            setParsedData({});
        } catch (error) {
            console.error('Error disconnecting from serial port:', error);
        }
    };

    const applyModification = (value: string, field: FieldMapping): string => {
        // Check if alphanumeric (Requirement B)
        if (/[a-zA-Z]/.test(value)) return value;

        // Skip if modify is none
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
        const parsed: Record<string, string> = {};

        fields.forEach(field => {
            let value: string;

            // Handle default data options (Requirement A)
            if (field.defaultDataOption === 'system_date') {
                value = new Date().toLocaleDateString();
            } else if (field.defaultDataOption === 'system_time') {
                value = new Date().toLocaleTimeString();
            } else {
                // Extract from data string
                if (parseMethod === 'position') {
                    // Position-based parsing
                    const start = parseInt(field.positionValue);
                    value = dataString.substring(start, start + field.length);

                    // Remove prefix character if it's a letter (e.g., "N1234567" → "1234567")
                    if (value.length > 0 && /[a-zA-Z]/.test(value[0])) {
                        value = value.substring(1);
                    }
                } else {
                    // ID-based parsing (Requirement C)
                    const idPrefix = field.idValue;
                    const regex = new RegExp(`${idPrefix}([^,]+)`);
                    const match = dataString.match(regex);
                    value = match ? match[1].substring(0, field.length) : field.defaultDataValue;

                    // Remove prefix character if it's a letter
                    if (value.length > 0 && /[a-zA-Z]/.test(value[0])) {
                        value = value.substring(1);
                    }
                }
            }

            // Apply modifications (Requirement B)
            value = applyModification(value, field);

            parsed[field.label] = value;
        });

        setParsedData(parsed);
    };

    return (
        <div className="flex-1 w-full p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/dashboard/settings"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Settings
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-600/10 rounded-lg">
                            <Activity className="w-6 h-6 text-purple-600" />
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-500 bg-clip-text text-transparent">
                            Data Acquisition
                        </h1>
                    </div>
                    <p className="text-muted-foreground ml-14">
                        Configure external data sources for real-time inspection data (Navigation, CP readings, etc.)
                    </p>
                </div>

                {/* Structure Type Selector (Requirement D) */}
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Structure Type</label>
                                <p className="text-xs text-muted-foreground">Settings are saved separately for each structure type</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStructureType('platform')}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-lg border-2 transition-all ${structureType === 'platform'
                                        ? 'border-blue-600 bg-blue-600 text-white shadow-lg'
                                        : 'border-border hover:border-blue-400'
                                        }`}
                                >
                                    <Building2 className="w-5 h-5" />
                                    <span className="font-semibold">Platform</span>
                                </button>
                                <button
                                    onClick={() => setStructureType('pipeline')}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-lg border-2 transition-all ${structureType === 'pipeline'
                                        ? 'border-green-600 bg-green-600 text-white shadow-lg'
                                        : 'border-border hover:border-green-400'
                                        }`}
                                >
                                    <GitBranch className="w-5 h-5" />
                                    <span className="font-semibold">Pipeline</span>
                                </button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Save/Export/Import Actions */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Settings Management</h3>
                                <p className="text-sm text-muted-foreground">Save, export, or import your configuration</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={saveSettings}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors font-semibold"
                                >
                                    💾 Save Settings
                                </button>
                                <button
                                    onClick={exportSettings}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Export
                                </button>
                                <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer">
                                    <Upload className="w-4 h-4" />
                                    Import
                                    <input type="file" accept=".json" onChange={importSettings} className="hidden" />
                                </label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Connection Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings2 className="w-5 h-5" />
                            Connection Settings
                            <span className={`ml-auto text-xs px-3 py-1 rounded-full font-semibold ${structureType === 'platform'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                }`}>
                                {structureType === 'platform' ? 'Platform' : 'Pipeline'} Settings
                            </span>
                        </CardTitle>
                        <CardDescription>
                            Choose your connection method and configure parameters
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Connection Type */}
                        <div>
                            <label className="block text-sm font-medium mb-3">Connection Type</label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setConnectionType('serial')}
                                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${connectionType === 'serial'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/50'
                                        }`}
                                >
                                    <Cable className="w-6 h-6 mx-auto mb-2" />
                                    <div className="font-semibold">Serial Port (RS232)</div>
                                    <div className="text-xs text-muted-foreground mt-1">Hardware connection</div>
                                </button>
                                <button
                                    onClick={() => setConnectionType('network')}
                                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${connectionType === 'network'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/50'
                                        }`}
                                >
                                    <Wifi className="w-6 h-6 mx-auto mb-2" />
                                    <div className="font-semibold">Network (TCP/UDP)</div>
                                    <div className="text-xs text-muted-foreground mt-1">Network connection</div>
                                </button>
                            </div>
                        </div>

                        {/* Serial Settings */}
                        {connectionType === 'serial' && (
                            <div className="space-y-4">
                                {/* COM Port Selection */}
                                <div className="p-4 bg-muted/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium">COM Port</label>
                                        {isWebSerialSupported ? (
                                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                                Web Serial API Supported
                                            </span>
                                        ) : (
                                            <span className="text-xs px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                                                Not Supported
                                            </span>
                                        )}
                                    </div>
                                    <select
                                        value={comPort}
                                        onChange={(e) => setComPort(e.target.value)}
                                        className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                        disabled={isConnected}
                                    >
                                        {availablePorts.length === 0 ? (
                                            <option value="">No ports available - Click "Connect & Test" to add</option>
                                        ) : (
                                            availablePorts.map(port => (
                                                <option key={port.id} value={port.id}>{port.name}</option>
                                            ))
                                        )}
                                    </select>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {isWebSerialSupported
                                            ? 'Click "Connect & Test" to select and connect to your serial device'
                                            : 'Web Serial API requires Chrome, Edge, or Opera browser'}
                                    </p>
                                </div>

                                {/* Serial Parameters */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Baud Rate</label>
                                        <select
                                            value={baudRate}
                                            onChange={(e) => setBaudRate(Number(e.target.value))}
                                            className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                        >
                                            <option value={110}>110</option>
                                            <option value={300}>300</option>
                                            <option value={600}>600</option>
                                            <option value={1200}>1200</option>
                                            <option value={2400}>2400</option>
                                            <option value={4800}>4800</option>
                                            <option value={9600}>9600</option>
                                            <option value={14400}>14400</option>
                                            <option value={19200}>19200</option>
                                            <option value={28800}>28800</option>
                                            <option value={38400}>38400</option>
                                            <option value={56000}>56000</option>
                                            <option value={57600}>57600</option>
                                            <option value={115200}>115200</option>
                                            <option value={128000}>128000</option>
                                            <option value={230400}>230400</option>
                                            <option value={256000}>256000</option>
                                            <option value={460800}>460800</option>
                                            <option value={921600}>921600</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Data Bits</label>
                                        <select
                                            value={dataBits}
                                            onChange={(e) => setDataBits(Number(e.target.value) as 5 | 6 | 7 | 8)}
                                            className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                            disabled={isConnected}
                                        >
                                            <option value={5}>5</option>
                                            <option value={6}>6</option>
                                            <option value={7}>7</option>
                                            <option value={8}>8</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Parity</label>
                                        <select
                                            value={parity}
                                            onChange={(e) => setParity(e.target.value as 'none' | 'even' | 'odd')}
                                            className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                            disabled={isConnected}
                                        >
                                            <option value="none">None</option>
                                            <option value="even">Even</option>
                                            <option value="odd">Odd</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Stop Bits</label>
                                        <select
                                            value={stopBits}
                                            onChange={(e) => setStopBits(Number(e.target.value) as 1 | 1.5 | 2)}
                                            className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                            disabled={isConnected}
                                        >
                                            <option value={1}>1</option>
                                            <option value={1.5}>1.5</option>
                                            <option value={2}>2</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Network Settings */}
                        {connectionType === 'network' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Protocol</label>
                                    <select
                                        value={protocol}
                                        onChange={(e) => setProtocol(e.target.value as Protocol)}
                                        className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                    >
                                        <option value="tcp">TCP</option>
                                        <option value="udp">UDP</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">IP Address</label>
                                    <input
                                        type="text"
                                        value={ipAddress}
                                        onChange={(e) => setIpAddress(e.target.value)}
                                        placeholder="192.168.1.100"
                                        className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Port</label>
                                    <input
                                        type="number"
                                        value={port}
                                        onChange={(e) => setPort(Number(e.target.value))}
                                        placeholder="5000"
                                        className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Parsing Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>Data Parsing Configuration</CardTitle>
                        <CardDescription>
                            Define how to parse incoming data strings
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Parse Method */}
                        <div>
                            <label className="block text-sm font-medium mb-3">Parse Method</label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setParseMethod('position')}
                                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${parseMethod === 'position'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/50'
                                        }`}
                                >
                                    <div className="font-semibold">Position-Based</div>
                                    <div className="text-xs text-muted-foreground mt-1">Fixed character positions</div>
                                </button>
                                <button
                                    onClick={() => setParseMethod('id')}
                                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${parseMethod === 'id'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/50'
                                        }`}
                                >
                                    <div className="font-semibold">ID-Based</div>
                                    <div className="text-xs text-muted-foreground mt-1">Field identifiers/prefixes</div>
                                </button>
                            </div>
                        </div>

                        {/* String Configuration */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">String Length</label>
                                <input
                                    type="number"
                                    value={stringLength}
                                    onChange={(e) => setStringLength(Number(e.target.value))}
                                    className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Start Character</label>
                                <input
                                    type="text"
                                    value={startCharacter}
                                    onChange={(e) => setStartCharacter(e.target.value)}
                                    maxLength={1}
                                    className="w-full bg-background border border-input rounded-lg px-3 py-2"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Field Mapping Table */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Field Mapping</CardTitle>
                                <CardDescription>
                                    Map data fields to inspection form fields
                                </CardDescription>
                            </div>
                            <button
                                onClick={addField}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
                            >
                                + Add Field
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left p-2 text-sm font-semibold">Field Label</th>
                                        <th className="text-left p-2 text-sm font-semibold">
                                            {parseMethod === 'position' ? 'Start Position' : 'Start ID'}
                                        </th>
                                        <th className="text-left p-2 text-sm font-semibold">Length</th>
                                        <th className="text-left p-2 text-sm font-semibold">Modify</th>
                                        <th className="text-left p-2 text-sm font-semibold">Modify Value</th>
                                        <th className="text-left p-2 text-sm font-semibold">Data Type</th>
                                        <th className="text-left p-2 text-sm font-semibold">Default Data</th>
                                        <th className="text-left p-2 text-sm font-semibold">Target Field</th>
                                        <th className="text-left p-2 text-sm font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fields.map((field) => (
                                        <tr key={field.id} className="border-b border-border hover:bg-muted/50">
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    value={field.label}
                                                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                    className="w-full bg-background border border-input rounded px-2 py-1 text-sm"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    value={parseMethod === 'position' ? (field.positionValue || '') : (field.idValue || '')}
                                                    onChange={(e) => {
                                                        if (parseMethod === 'position') {
                                                            updateField(field.id, { positionValue: e.target.value });
                                                        } else {
                                                            updateField(field.id, { idValue: e.target.value });
                                                        }
                                                    }}
                                                    placeholder={parseMethod === 'position' ? '0' : 'N'}
                                                    className="w-full bg-background border border-input rounded px-2 py-1 text-sm"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={field.length}
                                                    onChange={(e) => updateField(field.id, { length: Number(e.target.value) })}
                                                    className="w-20 bg-background border border-input rounded px-2 py-1 text-sm"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    value={field.modify}
                                                    onChange={(e) => updateField(field.id, { modify: e.target.value as any })}
                                                    className="w-full bg-background border border-input rounded px-2 py-1 text-sm"
                                                >
                                                    <option value="none">None</option>
                                                    <option value="add">Add</option>
                                                    <option value="subtract">Subtract</option>
                                                    <option value="multiply">Multiply</option>
                                                    <option value="divide">Divide</option>
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={field.modifyValue}
                                                    onChange={(e) => updateField(field.id, { modifyValue: Number(e.target.value) })}
                                                    disabled={field.modify === 'none'}
                                                    className="w-20 bg-background border border-input rounded px-2 py-1 text-sm disabled:opacity-50"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    value={field.dataType}
                                                    onChange={(e) => updateField(field.id, { dataType: e.target.value as any })}
                                                    className="w-full bg-background border border-input rounded px-2 py-1 text-sm"
                                                >
                                                    <option value="text">Text</option>
                                                    <option value="number">Number</option>
                                                    <option value="date">Date</option>
                                                    <option value="time">Time</option>
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    value={field.defaultDataOption}
                                                    onChange={(e) => updateField(field.id, { defaultDataOption: e.target.value as DefaultDataOption })}
                                                    className="w-full bg-background border border-input rounded px-2 py-1 text-sm"
                                                >
                                                    <option value="online">Online</option>
                                                    <option value="system_date">System Date</option>
                                                    <option value="system_time">System Time</option>
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    value={field.targetField}
                                                    onChange={(e) => updateField(field.id, { targetField: e.target.value })}
                                                    className="w-full bg-background border border-input rounded px-2 py-1 text-sm"
                                                    placeholder="e.g., northing"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <button
                                                    onClick={() => removeField(field.id)}
                                                    className="text-destructive hover:text-destructive/80 p-1"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Live Testing Panel */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="w-5 h-5" />
                                    Live Testing
                                </CardTitle>
                                <CardDescription>
                                    Test your configuration with live or sample data
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${isConnected
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-muted text-muted-foreground'
                                    }`}>
                                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Control Buttons */}
                        <div className="flex gap-2">
                            {!isConnected ? (
                                <button
                                    onClick={handleConnect}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Play className="w-4 h-4" />
                                    Connect & Test
                                </button>
                            ) : (
                                <button
                                    onClick={handleDisconnect}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Square className="w-4 h-4" />
                                    Disconnect
                                </button>
                            )}
                        </div>

                        {/* Live Data Display */}
                        {isConnected && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Raw Data String</label>
                                    <div className="bg-muted border border-border rounded-lg p-3 font-mono text-sm">
                                        {liveData || 'Waiting for data...'}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Parsed Data (Real-time)</label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {Object.entries(parsedData).map(([key, value]) => (
                                            <div key={key} className="bg-muted border border-border rounded-lg p-3">
                                                <div className="text-xs text-muted-foreground mb-1">{key}</div>
                                                <div className="font-semibold">{value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
