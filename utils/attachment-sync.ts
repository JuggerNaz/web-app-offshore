import { mutate } from "swr";

/**
 * Revalidate every SWR cache entry that belongs to the attachment module
 * (list, per-platform inspection list, per-source lists, ...).
 */
export function refreshAttachmentCaches() {
  return mutate(
    (key: any) => typeof key === "string" && key.startsWith("/api/attachment"),
    undefined,
    { revalidate: true }
  );
}
