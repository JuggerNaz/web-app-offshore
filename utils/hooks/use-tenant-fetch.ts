"use client";

import { useCallback } from "react";
import { useUserProfile } from "@/components/user-profile-provider";

export function useTenantFetch() {
  const { activeCompanyId } = useUserProfile();

  const tenantFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      if (activeCompanyId) {
        headers.set("x-company-id", activeCompanyId);
      }
      return fetch(url, { ...options, headers });
    },
    [activeCompanyId]
  );

  return { tenantFetch, companyId: activeCompanyId };
}
