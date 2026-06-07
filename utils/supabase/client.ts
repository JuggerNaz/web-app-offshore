import { createBrowserClient } from "@supabase/ssr";

export const createClient = () => {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Wrap auth.getUser to be robust against navigator lock timeout errors
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (jwt?: string): Promise<any> => {
    try {
      // 1. Try to resolve via session first (instant local storage cache)
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (session?.user && !sessionError) {
        return { data: { user: session.user }, error: null };
      }
    } catch (e) {
      console.warn("Session resolution failed in custom getUser wrapper:", e);
    }

    // 2. Fallback to original getUser, wrapped in safety try/catch
    try {
      return await originalGetUser(jwt);
    } catch (e: any) {
      console.error("Supabase auth.getUser failed (lock timeout or network error):", e);
      // Return structured data to prevent client destructuring crashes (e.g. data: { user: null })
      return {
        data: { user: null },
        error: e instanceof Error ? e : new Error(String(e))
      };
    }
  };

  return client;
};
