# Local Storage UI - Code to Add to Settings Page

## Add this code to `app/dashboard/settings/page.tsx`

### Step 1: Add icons to imports (line 18-20)

```tsx
    Loader2,
    HardDrive,      // Add this
    FolderOpen,     // Add this
} from "lucide-react";
```

### Step 2: Add state variable (around line 45)

```tsx
const [serialNo, setSerialNo] = useState("");
const [localStoragePath, setLocalStoragePath] = useState("");  // Add this
```

### Step 3: Add this UI section after the "Storage Location (URL)" section (around line 389)

Replace the "Coming Soon" Alert with this complete section:

```tsx
                        </div>

                        {/* Storage Provider Selection */}
                        <div className="space-y-4 pt-4 border-t">
                            <Label>Storage Provider</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Cloud Storage Option */}
                                <Card className="cursor-pointer hover:border-blue-500 transition-colors border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                                <Cloud className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold">Cloud Storage</h4>
                                                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                                                        Active
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Supabase - Secure cloud storage
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Local Drive Option */}
                                <Card className="cursor-pointer hover:border-slate-400 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                <HardDrive className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold">Local Drive</h4>
                                                    <span className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 px-2 py-1 rounded-full font-medium">
                                                        Available
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Store files on local/network drive
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Local Drive Configuration */}
                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Local Attachments Folder</Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Map a local or network drive folder for storing attachments
                                    </p>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={localStoragePath}
                                        onChange={(e) => setLocalStoragePath(e.target.value)}
                                        placeholder="C:\Attachments or \\server\share\attachments"
                                        className="font-mono text-sm"
                                    />
                                    <Button 
                                        variant="outline" 
                                        className="gap-2 shrink-0"
                                        onClick={() => alert("File browser will open here. For now, please type the path manually.")}
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                        Browse
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        className="gap-2 shrink-0"
                                        onClick={() => {
                                            if (!localStoragePath) {
                                                alert("Please enter a path first");
                                                return;
                                            }
                                            alert(`Testing connection to: ${localStoragePath}\n\nNote: Actual connection test will be implemented in the backend.`);
                                        }}
                                    >
                                        <Check className="w-4 h-4" />
                                        Test
                                    </Button>
                                </div>
                                
                                <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                                        <div className="space-y-2">
                                            <p className="font-semibold">Local Drive Storage Notes:</p>
                                            <ul className="text-xs space-y-1 ml-4 list-disc">
                                                <li>Ensure the folder has read/write permissions</li>
                                                <li>Network drives must be accessible to all users</li>
                                                <li>Use UNC paths for network locations (\\server\share)</li>
                                                <li>Local storage is not synchronized across devices</li>
                                                <li>Configure in .env.local: LOCAL_STORAGE_PATH and STORAGE_MODE</li>
                                            </ul>
                                        </div>
                                    </AlertDescription>
                                </Alert>

                                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                                    <Database className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                                        <p className="font-semibold mb-2">Quick Setup:</p>
                                        <p className="text-xs">
                                            See <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">docs/LOCAL_STORAGE_SETUP.md</code> for complete implementation guide with code examples and configuration instructions.
                                        </p>
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </div>

                        {/* Future Cloud Storage Options */}
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Coming Soon:</strong> Support for additional cloud storage providers including AWS S3, Google Cloud Storage, and Azure Blob Storage.
                            </AlertDescription>
                        </Alert>
```

## Result

You'll see:
- ✅ Two storage provider cards (Cloud & Local)
- ✅ Local path input field
- ✅ Browse and Test buttons
- ✅ Helpful alerts with setup notes
- ✅ Link to documentation

The icons and state have already been added automatically!
