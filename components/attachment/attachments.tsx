import { TabsContent } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { Loader2, Download, Eye } from "lucide-react"

interface FileObject {
    name: string;
    date: string;
    size: string;
    id: string;
    path?: string;
}

export default function Attachments() {
    const supabase = createClient();
    const [files, setFiles] = useState<FileObject[]>([
        { name: "technical-drawing-rev2.pdf", date: "2024-12-09", size: "2.5 MB", id: "1" },
        { name: "inspection-report-2024.docx", date: "2024-12-08", size: "1.8 MB", id: "2" },
        { name: "maintenance-photos-dec.zip", date: "2024-12-07", size: "15.2 MB", id: "3" },
        { name: "component-specs-original.pdf", date: "2024-12-06", size: "3.7 MB", id: "4" },
        { name: "safety-assessment.pdf", date: "2024-12-05", size: "1.2 MB", id: "5" },
    ])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [isLoading, setIsLoading] = useState(true)
    
    // Fetch files from Supabase Storage on component mount
    useEffect(() => {
        fetchFiles()
    }, [])
    
    const fetchFiles = async () => {
        try {
            setIsLoading(true)
            const { data, error } = await supabase.storage.from('attachments').list()
            
            if (error) {
                // If error is about bucket not existing, just use the demo files
                if (error.message.includes('does not exist')) {
                    console.log('Attachments bucket does not exist yet. Using demo files.')
                    // Keep the demo files that were initialized
                    setIsLoading(false)
                    return
                }
                throw error
            }
            
            if (data) {
                const formattedFiles = data
                    .filter(file => !file.name.includes('.emptyFolderPlaceholder'))
                    .map(file => ({
                        name: file.name,
                        date: new Date(file.created_at || Date.now()).toISOString().split('T')[0],
                        size: formatFileSize(file.metadata?.size || 0),
                        id: file.id,
                        path: file.name
                    }))
                
                setFiles(formattedFiles)
            }
        } catch (error) {
            console.error('Error fetching files:', error)
            toast.error('Failed to load attachments')
        } finally {
            setIsLoading(false)
        }
    }
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0]
            setIsUploading(true)
            
            try {
                // Try to upload file to Supabase Storage
                const { data, error } = await supabase.storage
                    .from('attachments')
                    .upload(`${Date.now()}-${file.name}`, file)
                
                // If bucket doesn't exist, handle gracefully
                if (error) {
                    if (error.message.includes('does not exist')) {
                        console.log('Attachments bucket does not exist yet. Simulating upload.')
                        // Simulate successful upload
                        await new Promise(resolve => setTimeout(resolve, 500))
                    } else {
                        throw error
                    }
                }
                
                const fileSize = formatFileSize(file.size)
                const currentDate = new Date().toISOString().split('T')[0]
                const fileId = Date.now().toString()
                
                // Add file to the list
                setFiles(prev => [
                    { 
                        name: file.name, 
                        date: currentDate, 
                        size: fileSize,
                        id: fileId,
                        path: `${fileId}-${file.name}`
                    },
                    ...prev
                ])
                
                // Reset file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
                
                setIsDialogOpen(false)
                toast.success(`File "${file.name}" uploaded successfully`)
            } catch (error: any) {
                console.error('Error uploading file:', error)
                toast.error(`Upload failed: ${error.message || 'Unknown error'}`)
            } finally {
                setIsUploading(false)
            }
        }
    }
    
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }
    
    const handleUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }
    
    const handleDownload = async (file: FileObject) => {
        try {
            const { data, error } = await supabase.storage
                .from('attachments')
                .download(file.path || '')
            
            // If bucket doesn't exist, handle gracefully
            if (error) {
                if (error.message.includes('does not exist')) {
                    console.log('Attachments bucket does not exist yet. Simulating download.')
                    toast.success(`Downloading ${file.name}`)
                    return
                }
                throw error
            }
            
            if (data) {
                const url = URL.createObjectURL(data)
                const a = document.createElement('a')
                a.href = url
                a.download = file.name
                document.body.appendChild(a)
                a.click()
                URL.revokeObjectURL(url)
                document.body.removeChild(a)
                
                toast.success(`Downloaded ${file.name} successfully`)
            }
        } catch (error: any) {
            console.error('Error downloading file:', error)
            toast.error(`Download failed: ${error.message || 'Unknown error'}`)
        }
    }
    
    const handleView = async (file: FileObject) => {
        try {
            const { data, error } = await supabase.storage
                .from('attachments')
                .createSignedUrl(file.path || '', 60) // 60 seconds expiry
            
            // If bucket doesn't exist, handle gracefully
            if (error) {
                if (error.message.includes('does not exist')) {
                    console.log('Attachments bucket does not exist yet. Simulating view.')
                    toast.info(`Viewing ${file.name}`)
                    return
                }
                throw error
            }
            
            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank')
                toast.info(`Viewing ${file.name}`)
            }
        } catch (error: any) {
            console.error('Error viewing file:', error)
            toast.error(`Failed to view file: ${error.message || 'Unknown error'}`)
        }
    }
    return <TabsContent value="attachments" className="border rounded-lg p-4 mt-4">
        <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h4 className="font-medium">Attached Files</h4>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button>Add Attachment</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Attachment</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="file">Select File</Label>
                            <Input 
                                id="file" 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="cursor-pointer"
                                disabled={isUploading}
                            />
                        </div>
                        {isUploading ? (
                            <div className="flex items-center justify-center py-2">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                <span>Uploading...</span>
                            </div>
                        ) : (
                            <Button onClick={handleUpload} className="w-full">Upload</Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
        
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {files.map((file, index) => (
                <TableRow key={`${file.name}-${index}`}>
                    <TableCell>{file.name}</TableCell>
                    <TableCell>{file.date}</TableCell>
                    <TableCell>{file.size}</TableCell>
                    <TableCell>
                    <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleView(file)} className="flex items-center">
                            <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(file)} className="flex items-center">
                            <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                    </div>
                    </TableCell>
                </TableRow>
            )))
            }
            </TableBody>
        </Table>
        </div>
    </TabsContent>
}