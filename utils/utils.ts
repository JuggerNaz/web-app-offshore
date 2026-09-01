import { redirect } from "next/navigation";

/**
 * Redirects to a specified path with an encoded message as a query parameter.
 * @param {('error' | 'success')} type - The type of message, either 'error' or 'success'.
 * @param {string} path - The path to redirect to.
 * @param {string} message - The message to be encoded and added as a query parameter.
 * @returns {never} This function doesn't return as it triggers a redirect.
 */
export function encodedRedirect(type: "error" | "success", path: string, message: string) {
  return redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

type FetcherArgs = Parameters<typeof fetch>;

const parseResponse = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
};

export const fetcher = async (...args: FetcherArgs): Promise<any> => {
  let response = await fetch(...args);

  // The proxy no longer refreshes sessions on /api/* requests. If the access
  // token expired mid-session, refresh it client-side and retry once.
  if (response.status === 401) {
    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      await supabase.auth.getUser();
      response = await fetch(...args);
    } catch (e) {
      // Fall through to normal error handling with the original 401 response.
    }
  }

  if (!response.ok) {
    let errorMessage = `Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch (e) {
      try {
        const text = await response.text();
        if (text) errorMessage = text.substring(0, 100);
      } catch (e2) { }
    }
    throw new Error(errorMessage);
  }

  return parseResponse(response);
};
