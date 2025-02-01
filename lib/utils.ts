import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type FetcherArgs = Parameters<typeof fetch>;

export const fetcher = (...args: FetcherArgs): Promise<any> => fetch(...args).then(res => res.json());
