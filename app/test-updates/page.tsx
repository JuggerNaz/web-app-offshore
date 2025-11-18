import { getChangelogEntries } from "@/utils/changelog-server";

export default async function TestUpdatesPage() {
  console.log("Starting test page render...");

  try {
    const entries = await getChangelogEntries();
    console.log(`Successfully loaded ${entries.length} entries`);

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Test Updates Page</h1>
        <p className="mb-4">Total entries found: {entries.length}</p>

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div key={entry.id} className="border p-4 rounded">
              <h2 className="text-lg font-semibold">{entry.title}</h2>
              <p className="text-sm text-gray-600">
                Date: {entry.metadata.date || "No date"} | Type: {entry.metadata.type || "No type"}{" "}
                | Version: {entry.metadata.version || "No version"}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                File: {entry.filename} | Order: {entry.order}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error in test page:", error);
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Error in Test Updates Page</h1>
        <p className="text-red-500">Error: {String(error)}</p>
        <pre className="bg-gray-100 p-4 mt-4 text-sm overflow-auto">
          {error instanceof Error ? error.stack : "No stack trace available"}
        </pre>
      </div>
    );
  }
}
