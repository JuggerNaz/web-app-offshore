
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

export default function Comments() {
    return <TabsContent value="comments" className="border rounded-lg p-4 mt-4">
        <div className="space-y-4">
            <div className="flex justify-between items-center">
            <h4 className="font-medium">Comments History</h4>
            <Button>
                Add Comment
            </Button>
            </div>
            
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="w-[50%]">Comment</TableHead>
                <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                <TableCell>2024-12-09</TableCell>
                <TableCell>John Doe</TableCell>
                <TableCell>Initial inspection completed</TableCell>
                <TableCell>
                    <Button variant="ghost" size="sm">
                    Edit
                    </Button>
                </TableCell>
                </TableRow>
                <TableRow>
                <TableCell>2024-12-08</TableCell>
                <TableCell>Jane Smith</TableCell>
                <TableCell>Maintenance check performed - all parameters within normal range</TableCell>
                <TableCell>
                    <Button variant="ghost" size="sm">
                    Edit
                    </Button>
                </TableCell>
                </TableRow>
                <TableRow>
                <TableCell>2024-12-07</TableCell>
                <TableCell>Mike Johnson</TableCell>
                <TableCell>Surface corrosion detected on north face - scheduled for treatment</TableCell>
                <TableCell>
                    <Button variant="ghost" size="sm">
                    Edit
                    </Button>
                </TableCell>
                </TableRow>
                <TableRow>
                <TableCell>2024-12-06</TableCell>
                <TableCell>Sarah Wilson</TableCell>
                <TableCell>Updated technical specifications after replacement</TableCell>
                <TableCell>
                    <Button variant="ghost" size="sm">
                    Edit
                    </Button>
                </TableCell>
                </TableRow>
            </TableBody>
            </Table>
        </div>
    </TabsContent>
}