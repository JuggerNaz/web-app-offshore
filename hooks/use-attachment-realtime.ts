"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

/**
 * Subscribes to live changes of the `attachment` and `insp_media` tables
 * (any user / machine) and invokes `onChange` (debounced) when something changes.
 *
 * Requires both tables to be part of the `supabase_realtime` publication
 * (see sql/enable_attachment_realtime.sql).
 */
export function useAttachmentRealtime(onChange: () => void, enabled: boolean = true) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current(), 400);
    };

    const channel = supabase
      .channel(`attachments-live-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attachment" }, handler)
      .on("postgres_changes", { event: "*", schema: "public", table: "insp_media" }, handler)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
