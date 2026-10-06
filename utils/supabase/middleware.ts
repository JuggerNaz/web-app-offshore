import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "./fetch-with-timeout";

// Fail-fast guards: when Supabase is slow/unreachable, return a retryable 503
// instead of hanging until the hosting platform kills the request (observed in
// production as Netlify edge functions dying at ~36s with "the edge function
// timed out" / HTTP 500 on /dashboard routes).
const AUTH_GUARD_MS = 8000;

const SERVICE_BUSY_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="5"><title>Service busy</title></head><body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;height:100vh;display:flex;align-items:center;justify-content:center"><div style="text-align:center;padding:2rem"><h1 style="font-size:1.15rem;margin:0 0 .5rem">Service is busy &mdash; retrying&hellip;</h1><p style="opacity:.7;margin:0">The connection to the server took too long. This page will refresh automatically in a few seconds.</p></div></body></html>`;

const serviceBusyResponse = () =>
  new Response(SERVICE_BUSY_HTML, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "Retry-After": "3",
      "Cache-Control": "no-store",
    },
  });

export const updateSession = async (request: NextRequest) => {
  // This `try/catch` block is only here for the interactive tutorial.
  // Feel free to remove once you have Supabase connected.
  try {
    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { fetch: fetchWithTimeout },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // This will refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    // Guarded with a timeout so a stalled Supabase Auth server produces a
    // retryable 503 page instead of hanging until the edge function crashes.
    const authPromise = supabase.auth.getUser();
    // Attach a no-op catch so the losing side of the race below can never
    // surface an unhandled rejection when the guard wins.
    authPromise.catch(() => {});
    const user = await Promise.race([
      authPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_GUARD_MS)),
    ]);

    if (!user) {
      console.warn("[Middleware] Supabase auth did not respond in time; returning 503 retry page.");
      return serviceBusyResponse();
    }

    // protected routes - update to go to landing page as there will be the sign in page
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      if (user.error || !user.data?.user) {
        return NextResponse.redirect(new URL("/", request.url));
      }

      // Fetch user profile to check active state and login schedule constraints.
      // Bounded by the client's fetchWithTimeout (10s); on failure/timeout this
      // resolves null and the route proceeds without profile-based restrictions.
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active, must_change_password, login_restriction_type, allowed_start_time, allowed_end_time, allowed_days, timezone, device_restriction_type")
        .eq("id", user.data.user.id)
        .single();

      if (profile) {
        if (!profile.is_active) {
          await supabase.auth.signOut();
          const redirectRes = NextResponse.redirect(new URL("/?error=inactive", request.url));
          // Clear session cookies by copying the updated headers/cookies from the client
          return redirectRes;
        }

        // Compulsory password change enforcement
        if (profile.must_change_password || user.data.user.user_metadata?.must_change_password === true) {
          return NextResponse.redirect(new URL("/force-change-password", request.url));
        }

        // 1. Device restriction token validation check
        if (profile.device_restriction_type === "enforced") {
          const deviceToken = request.cookies.get("device_token")?.value;
          let isValidDevice = false;

          if (deviceToken) {
            // Check if token matches an active registered device
            const { data: deviceRecord } = await supabase
              .from("registered_devices")
              .select("id, company_id")
              .eq("device_token", deviceToken)
              .eq("is_active", true)
              .maybeSingle();

            if (deviceRecord) {
              // Confirm the user holds an active membership in the device's company
              const { data: membership } = await supabase
                .from("company_memberships")
                .select("id")
                .eq("user_id", user.data.user.id)
                .eq("company_id", deviceRecord.company_id)
                .eq("is_active", true)
                .maybeSingle();

              if (membership) {
                isValidDevice = true;
              }
            }
          }

          if (!isValidDevice) {
            await supabase.auth.signOut();
            const errorParam = encodeURIComponent("Access restricted: Unregistered or unauthorized device.");
            return NextResponse.redirect(new URL(`/?error=${errorParam}`, request.url));
          }
        }

        // 2. Scheduled hours validation check
        if (profile.login_restriction_type === "scheduled") {
          try {
            const tz = profile.timezone || "Asia/Kuala_Lumpur";
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: tz,
              hour12: false,
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            const parts = formatter.formatToParts(new Date());
            const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

            const dayMap: Record<string, number> = {
              'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7
            };
            const isoWeekday = dayMap[partMap.weekday] || 1;

            const allowedDays = profile.allowed_days || [1, 2, 3, 4, 5];
            const currentTime = `${partMap.hour}:${partMap.minute}:${partMap.second}`;
            const startTime = profile.allowed_start_time || "08:00:00";
            const endTime = profile.allowed_end_time || "17:00:00";

            if (!allowedDays.includes(isoWeekday) || currentTime < startTime || currentTime > endTime) {
              await supabase.auth.signOut();
              const errorParam = encodeURIComponent(`Access restricted outside allowed hours: ${startTime} - ${endTime} (${tz})`);
              return NextResponse.redirect(new URL(`/?error=${errorParam}`, request.url));
            }
          } catch (err) {
            console.error("[Middleware] Time scheduling check failed:", err);
          }
        }
      }
    }

    if (request.nextUrl.pathname === "/" && !user.error && user.data?.user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
  } catch (e) {
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    // Check out http://localhost:3000 for Next Steps.
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
