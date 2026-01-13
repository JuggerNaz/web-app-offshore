# Local Drive Mapping for Attachments

## Overview

This guide explains how to configure local or network drive storage for attachments as an alternative to cloud storage.

## Configuration Options

### Option 1: Local Drive Storage
Store attachments on the local computer's hard drive.

**Example Paths:**
- Windows: `C:\OffshoreData\Attachments`
- Windows (User folder): `C:\Users\YourName\Documents\OffshoreAttachments`

### Option 2: Network Drive Storage
Store attachments on a shared network location accessible to all users.

**Example Paths:**
- UNC Path: `\\server\share\OffshoreAttachments`
- Mapped Drive: `Z:\OffshoreAttachments`

## Setup Instructions

### Step 1: Create the Folder Structure

```
Attachments/
├── structures/
│   ├── platforms/
│   └── pipelines/
├── jobpacks/
├── inspections/
│   ├── visual/
│   ├── ultrasonic/
│   ├── magnetic/
│   └── radiographic/
├── reports/
└── temp/
```

### Step 2: Set Permissions

**For Local Drive:**
- Ensure the application has read/write access
- Set folder permissions for the user running the application

**For Network Drive:**
- Grant read/write permissions to all users who need access
- Ensure the network path is accessible from all client machines
- Consider using a service account for consistent access

### Step 3: Configure in Settings

1. Go to **Settings** → **Cloud Storage**
2. Click **Configure** on the "Local Drive" option
3. Enter the folder path:
   - Local: `C:\OffshoreData\Attachments`
   - Network: `\\server\share\OffshoreAttachments`
4. Click **Browse** to select the folder
5. Click **Test Connection** to verify access
6. Click **Save Settings**

## Environment Variable Configuration

Add to your `.env.local` file:

```env
# Local Storage Configuration
LOCAL_STORAGE_ENABLED=true
LOCAL_STORAGE_PATH=C:\OffshoreData\Attachments

# Or for network storage
LOCAL_STORAGE_PATH=\\\\server\\share\\OffshoreAttachments

# Storage mode: 'cloud' or 'local'
STORAGE_MODE=local
```

## Implementation Code

### Storage Utility Function

Create `utils/local-storage.ts`:

```typescript
import fs from 'fs';
import path from 'path';

export interface LocalStorageConfig {
  basePath: string;
  enabled: boolean;
}

export const getLocalStorageConfig = (): LocalStorageConfig => {
  return {
    basePath: process.env.LOCAL_STORAGE_PATH || 'C:\\OffshoreData\\Attachments',
    enabled: process.env.LOCAL_STORAGE_ENABLED === 'true',
  };
};

export const saveFileToLocal = async (
  file: File,
  category: string,
  filename: string
): Promise<string> => {
  const config = getLocalStorageConfig();
  
  if (!config.enabled) {
    throw new Error('Local storage is not enabled');
  }

  const categoryPath = path.join(config.basePath, category);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(categoryPath)) {
    fs.mkdirSync(categoryPath, { recursive: true });
  }

  const filePath = path.join(categoryPath, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  
  fs.writeFileSync(filePath, buffer);
  
  return filePath;
};

export const getFileFromLocal = (
  category: string,
  filename: string
): Buffer => {
  const config = getLocalStorageConfig();
  const filePath = path.join(config.basePath, category, filename);
  
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found');
  }
  
  return fs.readFileSync(filePath);
};

export const deleteFileFromLocal = (
  category: string,
  filename: string
): void => {
  const config = getLocalStorageConfig();
  const filePath = path.join(config.basePath, category, filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

export const testLocalStorageAccess = (): {
  success: boolean;
  message: string;
} => {
  const config = getLocalStorageConfig();
  
  try {
    // Test write access
    const testPath = path.join(config.basePath, 'test.txt');
    fs.writeFileSync(testPath, 'test');
    fs.unlinkSync(testPath);
    
    return {
      success: true,
      message: 'Local storage is accessible',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Cannot access local storage: ${error.message}`,
    };
  }
};
```

### API Route for File Upload

Create `app/api/attachments/upload/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { saveFileToLocal } from '@/utils/local-storage';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const storageMode = process.env.STORAGE_MODE || 'cloud';
    
    if (storageMode === 'local') {
      // Save to local drive
      const filename = `${Date.now()}_${file.name}`;
      const filePath = await saveFileToLocal(file, category, filename);
      
      return NextResponse.json({
        success: true,
        filePath,
        storageMode: 'local',
      });
    } else {
      // Save to Supabase (cloud)
      const supabase = createClient();
      const filename = `${category}/${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(filename, file);
      
      if (error) {
        throw error;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filename);
      
      return NextResponse.json({
        success: true,
        url: publicUrlData.publicUrl,
        storageMode: 'cloud',
      });
    }
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error.message },
      { status: 500 }
    );
  }
}
```

## UI Component for Settings

Add to `app/dashboard/settings/page.tsx`:

```tsx
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
        placeholder="C:\Attachments or \\server\share\attachments"
        className="font-mono text-sm"
        defaultValue={process.env.LOCAL_STORAGE_PATH || ""}
      />
      <Button variant="outline" className="gap-2 shrink-0">
        <FolderOpen className="w-4 h-4" />
        Browse
      </Button>
      <Button variant="outline" className="gap-2 shrink-0">
        <CheckCircle className="w-4 h-4" />
        Test
      </Button>
    </div>
    
    <Alert className="bg-amber-50 border-amber-200">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800">
        <div className="space-y-2">
          <p className="font-semibold">Local Drive Storage Notes:</p>
          <ul className="text-xs space-y-1 ml-4 list-disc">
            <li>Ensure the folder has read/write permissions</li>
            <li>Network drives must be accessible to all users</li>
            <li>Use UNC paths for network locations (\\server\share)</li>
            <li>Local storage is not synchronized across devices</li>
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  </div>
</div>
```

## Advantages of Local Storage

### ✅ Benefits:
- **No Cloud Costs**: No storage fees
- **Faster Access**: Direct file system access
- **Full Control**: Complete data ownership
- **Offline Access**: Works without internet
- **Network Sharing**: Easy team collaboration via network drives

### ⚠️ Considerations:
- **No Auto-Backup**: Must implement own backup strategy
- **Access Control**: Managed via file system permissions
- **Scalability**: Limited by local disk space
- **Synchronization**: Not automatically synced across devices

## Hybrid Approach

You can use both cloud and local storage:

```env
# Use cloud for critical files, local for temporary/large files
STORAGE_MODE=hybrid
CLOUD_STORAGE_CATEGORIES=reports,inspections
LOCAL_STORAGE_CATEGORIES=temp,drafts
```

## Backup Strategy

### For Local Storage:
1. **Scheduled Backups**: Use Windows Task Scheduler or cron jobs
2. **Network Backup**: Copy to network drive nightly
3. **Cloud Sync**: Sync to cloud storage periodically
4. **Version Control**: Keep file versions for recovery

### Backup Script Example (PowerShell):

```powershell
# backup-attachments.ps1
$source = "C:\OffshoreData\Attachments"
$destination = "\\backup-server\OffshoreBackup\Attachments"
$date = Get-Date -Format "yyyy-MM-dd"

# Create dated backup folder
$backupPath = "$destination\$date"
New-Item -ItemType Directory -Path $backupPath -Force

# Copy files
Copy-Item -Path $source\* -Destination $backupPath -Recurse -Force

Write-Host "Backup completed: $backupPath"
```

## Security Considerations

1. **Encryption**: Encrypt sensitive files
2. **Access Control**: Use NTFS permissions
3. **Audit Logging**: Track file access
4. **Antivirus**: Scan uploaded files
5. **Quotas**: Set disk space limits

## Troubleshooting

### Common Issues:

**Issue**: "Access Denied"
- **Solution**: Check folder permissions, run as administrator

**Issue**: "Network path not found"
- **Solution**: Verify UNC path, check network connectivity

**Issue**: "Disk full"
- **Solution**: Clear temp files, increase disk space

**Issue**: "File in use"
- **Solution**: Close applications using the file

## Migration

### From Cloud to Local:

```typescript
async function migrateToLocal() {
  const supabase = createClient();
  const { data: files } = await supabase.storage
    .from('attachments')
    .list();
  
  for (const file of files) {
    const { data } = await supabase.storage
      .from('attachments')
      .download(file.name);
    
    if (data) {
      await saveFileToLocal(
        new File([data], file.name),
        'migrated',
        file.name
      );
    }
  }
}
```

### From Local to Cloud:

```typescript
async function migrateToCloud() {
  const localPath = 'C:\\OffshoreData\\Attachments';
  const files = fs.readdirSync(localPath, { recursive: true });
  
  const supabase = createClient();
  
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(localPath, file));
    await supabase.storage
      .from('attachments')
      .upload(file, buffer);
  }
}
```

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-06  
**Status**: Ready for Implementation
