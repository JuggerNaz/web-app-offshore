import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/supabase/schema";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { autoPaginateClient } from "./auto-paginate";

export const createClient = () => {

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Fail fast instead of hanging when Supabase is slow/unreachable
      // (prevents Netlify edge function timeout crashes on SSR routes).
      global: { fetch: fetchWithTimeout },
      cookies: {
        async getAll() {
          const cookieStore = await cookies(); // Resolve the promise
          return cookieStore.getAll(); // Access the getAll method
        },
        async setAll(cookiesToSet) {
          try {
            const cookieStore = await cookies();
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  return autoPaginateClient(client);
};
export const isServiceRoleConfigured = (): boolean => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return false;
  }
  try {
    const parts = key.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
      return payload.role === "service_role";
    }
  } catch (_) { }
  return true;
};

export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || !isServiceRoleConfigured()) {
    throw new Error(
      "[Supabase] Valid SUPABASE_SERVICE_ROLE_KEY (role: 'service_role') is required for createAdminClient."
    );
  }

  const client = createServerClient<Database>(url, key, {
    global: { fetch: fetchWithTimeout },
    cookies: {
      getAll() {
        return [];
      },
      setAll() { },
    },
  });

  return autoPaginateClient(client);
};

