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

export default function Attachments() {
    return <TabsContent value="attachments" className="border rounded-lg p-4 mt-4">
        <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h4 className="font-medium">Attached Files</h4>
            <Button>
            Add Attachment
            </Button>
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
            <TableRow>
                <TableCell>technical-drawing-rev2.pdf</TableCell>
                <TableCell>2024-12-09</TableCell>
                <TableCell>2.5 MB</TableCell>
                <TableCell>
                <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                    View
                    </Button>
                    <Button variant="ghost" size="sm">
                    Download
                    </Button>
                </div>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell>inspection-report-2024.docx</TableCell>
                <TableCell>2024-12-08</TableCell>
                <TableCell>1.8 MB</TableCell>
                <TableCell>
                <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                    View
                    </Button>
                    <Button variant="ghost" size="sm">
                    Download
                    </Button>
                </div>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell>maintenance-photos-dec.zip</TableCell>
                <TableCell>2024-12-07</TableCell>
                <TableCell>15.2 MB</TableCell>
                <TableCell>
                <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                    View
                    </Button>
                    <Button variant="ghost" size="sm">
                    Download
                    </Button>
                </div>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell>component-specs-original.pdf</TableCell>
                <TableCell>2024-12-06</TableCell>
                <TableCell>3.7 MB</TableCell>
                <TableCell>
                <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                    View
                    </Button>
                    <Button variant="ghost" size="sm">
                    Download
                    </Button>
                </div>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell>safety-assessment.pdf</TableCell>
                <TableCell>2024-12-05</TableCell>
                <TableCell>1.2 MB</TableCell>
                <TableCell>
                <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                    View
                    </Button>
                    <Button variant="ghost" size="sm">
                    Download
                    </Button>
                </div>
                </TableCell>
            </TableRow>
            </TableBody>
        </Table>
        </div>
    </TabsContent>
}