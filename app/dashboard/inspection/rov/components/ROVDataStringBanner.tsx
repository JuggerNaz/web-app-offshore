import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Activity, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useROVConnection } from '@/components/rov-connection-provider';

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
    const { isConnected, isConnecting, connect, disconnect, fields: globalFields } = useROVConnection();
    const [settings, setSettings] = useState<DataAcquisitionSettings | null>(null);
    const [localFields, setLocalFields] = useState<FieldMapping[]>([]);

    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Construct return URL
    const returnPath = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
    const settingsUrl = `/dashboard/settings/data-acquisition?returnTo=${encodeURIComponent(returnPath)}`;

    // Load settings from localStorage when structureType changes
    useEffect(() => {
        const loadSettings = () => {
            const saved = localStorage.getItem(STORAGE_KEYS[structureType]);
            if (saved) {
                try {
                    const parsedSettings = JSON.parse(saved) as DataAcquisitionSettings;
                    setSettings(parsedSettings);
                    setLocalFields(parsedSettings.fields || []);
                } catch (error) {
                    console.error('Failed to parse saved settings:', error);
                }
            } else {
                setSettings(null);
                setLocalFields([]);
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

    // Explicitly disconnect when navigating away from this component (if connected)
    useEffect(() => {
        return () => {
            console.log("[ROV Banner] Unmounting, terminating ROV connection...");
            disconnect(true); 
        };
    }, [disconnect]);

    const handleConnectToggle = async () => {
        if (isConnected) {
            await disconnect(true);
        } else {
            await connect(structureType);
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
                                disabled={isConnecting}
                                className={`h-6 text-[10px] px-2 gap-1 rounded ${isConnected ? "bg-green-600 hover:bg-green-700 text-white" : "text-slate-600 dark:text-slate-400"}`}
                                onClick={handleConnectToggle}
                            >
                                {isConnecting ? "Connecting..." : isConnected ? (
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
                    {localFields.length > 0 ? localFields.map(field => {
                        const globalField = globalFields.find(gf => gf.targetField === field.targetField || gf.label === field.label);
                        return (
                            <div key={field.id} className="flex flex-col items-center min-w-[60px]">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">{field.label}</span>
                                <span className="font-bold font-mono text-base text-slate-800 dark:text-slate-200">
                                    {globalField ? globalField.value : '-'}
                                </span>
                            </div>
                        );
                    }) : (
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

