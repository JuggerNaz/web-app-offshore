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

export const fetcher = async (...args: FetcherArgs): Promise<any> => {
  const response = await fetch(...args);

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

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
};
