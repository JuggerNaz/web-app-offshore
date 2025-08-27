import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, FileTextIcon } from "lucide-react";
import { getChangelogEntries } from "@/utils/changelog-server";
import { type ChangelogEntry } from "@/utils/changelog";
import { ChangelogCard } from "./changelog-card";

export default async function SystemUpdatesPage() {
  const changelogEntries = await getChangelogEntries();

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FileTextIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">System Updates</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Stay informed about the latest system updates, new features, and improvements to the Web App Offshore platform.
        </p>
      </div>

      <div className="space-y-6">
        {changelogEntries.map((entry) => (
          <ChangelogCard key={entry.id} entry={entry} />
        ))}
      </div>

      {changelogEntries.length === 0 && (
        <div className="text-center py-12">
          <FileTextIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Updates Available</h3>
          <p className="text-muted-foreground">
            No system updates found. Please check back later.
          </p>
        </div>
      )}

      <div className="mt-12 p-6 bg-muted/30 rounded-lg">
        <h3 className="font-semibold mb-2">Stay Updated</h3>
        <p className="text-sm text-muted-foreground">
          System updates are released regularly to improve functionality, security, and user experience. 
          Check this page periodically for the latest information about platform changes and new features.
        </p>
      </div>
    </div>
  );
}
