import { createBrowserClient } from "@supabase/ssr";

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  if (typeof window !== "undefined" && clientInstance) {
    return clientInstance;
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Wrap auth.getSession to prevent unhandled AuthRetryableFetchError
  const originalGetSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = async (): Promise<any> => {
    try {
      return await originalGetSession();
    } catch (e: any) {
      console.warn("Supabase auth.getSession failed (network/offline error):", e?.message || e);
      return {
        data: { session: null },
        error: e instanceof Error ? e : new Error(String(e))
      };
    }
  };

  // Wrap auth.getUser to be robust against navigator lock timeout errors and network fetch errors
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (jwt?: string): Promise<any> => {
    try {
      // 1. Try to resolve via session first (instant local storage cache)
      const { data, error: sessionError } = await client.auth.getSession();
      if (data?.session?.user && !sessionError) {
        return { data: { user: data.session.user }, error: null };
      }
    } catch (e) {
      console.warn("Session resolution failed in custom getUser wrapper:", e);
    }

    // 2. Fallback to original getUser, wrapped in safety try/catch
    try {
      return await originalGetUser(jwt);
    } catch (e: any) {
      console.warn("Supabase auth.getUser failed (lock timeout or network error):", e?.message || e);
      // Return structured data to prevent client destructuring crashes (e.g. data: { user: null })
      return {
        data: { user: null },
        error: e instanceof Error ? e : new Error(String(e))
      };
    }
  };

  if (typeof window !== "undefined") {
    clientInstance = client;
  }

  return client;
};
