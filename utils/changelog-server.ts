import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { ChangelogEntry } from "./changelog";

/**
 * Reads all markdown files from the docs/changes directory (including version subdirectories)
 * and parses them into structured changelog entries
 * SERVER-SIDE ONLY
 */
export async function getChangelogEntries(): Promise<ChangelogEntry[]> {
  const changesDir = path.join(process.cwd(), "docs", "changes");

  try {
    const entries: ChangelogEntry[] = [];

    // Helper function to process files in a directory
    const processDirectory = async (dirPath: string, versionFolder?: string) => {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // Recursively process version subdirectories
          await processDirectory(filePath, file);
        } else if (file.endsWith(".md") && file !== "README.md") {
          const fileContent = fs.readFileSync(filePath, "utf8");

          // Parse frontmatter and content
          const { data: frontmatter, content } = matter(fileContent);

          // Extract title from the first heading
          const titleMatch = content.match(/^#\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1] : file.replace(".md", "");

          // Start with frontmatter metadata
          const metadata: ChangelogEntry["metadata"] = { ...frontmatter };

          // If version is not in frontmatter but we have a version folder, use it
          if (!metadata.version && versionFolder) {
            metadata.version = versionFolder;
          }

          // Parse metadata from content if not in frontmatter (backward compatibility)
          const metadataRegex = /\*\*(\w+):\*\*\s*([^\n]+)/g;
          let match;
          while ((match = metadataRegex.exec(content)) !== null) {
            const key = match[1].toLowerCase();
            const value = match[2].trim();

            // Only use inline metadata if not already in frontmatter
            if (!metadata[key as keyof typeof metadata]) {
              switch (key) {
                case "date":
                  metadata.date = value;
                  break;
                case "type":
                  metadata.type = value;
                  break;
                case "status":
                  metadata.status = value;
                  break;
                case "version":
                  metadata.version = value;
                  break;
              }
            }
          }

          // Extract order from filename (assuming format like "01-title.md")
          const orderMatch = file.match(/^(\d+)-/);
          const order = orderMatch ? parseInt(orderMatch[1], 10) : 999;

          // Generate ID from filename (include version folder if present)
          const id = versionFolder
            ? `${versionFolder}/${file.replace(".md", "")}`
            : file.replace(".md", "");

          entries.push({
            id,
            title,
            content,
            metadata,
            filename: file,
            order,
          });
        }
      }
    };

    // Start processing from the changes directory
    await processDirectory(changesDir);

    // Sort by date (newest first), then by order
    return entries.sort((a, b) => {
      // First sort by date if available
      const dateA = a.metadata.date ? new Date(a.metadata.date).getTime() : 0;
      const dateB = b.metadata.date ? new Date(b.metadata.date).getTime() : 0;

      if (dateA !== dateB) {
        return dateB - dateA; // Newest first
      }

      // If dates are same or missing, sort by order
      return b.order - a.order;
    });
  } catch (error) {
    console.error("Error reading changelog entries:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      changesDir,
    });
    return [];
  }
}

/**
 * Get a single changelog entry by ID
 * SERVER-SIDE ONLY
 */
export async function getChangelogEntry(id: string): Promise<ChangelogEntry | null> {
  const entries = await getChangelogEntries();
  return entries.find((entry) => entry.id === id) || null;
}
