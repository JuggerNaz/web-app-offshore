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
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }

      // Fetch user profile to check active state and login schedule constraints.
      // Bounded by the client's fetchWithTimeout (10s); on failure/timeout this
      // resolves null and the route proceeds without profile-based restrictions.
      let profileRes = await supabase
        .from("profiles")
        .select("is_active, must_change_password, login_restriction_type, allowed_start_time, allowed_end_time, allowed_days, timezone, device_restriction_type, allowed_start_date, allowed_end_date")
        .eq("id", user.data.user.id)
        .single();

      if (profileRes.error && (profileRes.error.message?.includes("allowed_start_date") || profileRes.error.message?.includes("allowed_end_date"))) {
        profileRes = await supabase
          .from("profiles")
          .select("is_active, must_change_password, login_restriction_type, allowed_start_time, allowed_end_time, allowed_days, timezone, device_restriction_type")
          .eq("id", user.data.user.id)
          .single();
      }
      const profile = profileRes.data;

      if (profile) {
        if (profile.is_active === false) {
          // Check if user holds an active company membership before signing out
          const { data: activeMem } = await supabase
            .from("company_memberships")
            .select("id")
            .eq("user_id", user.data.user.id)
            .eq("is_active", true)
            .maybeSingle();

          if (!activeMem) {
            const redirectRes = NextResponse.redirect(new URL("/sign-in?error=" + encodeURIComponent("Your account has been deactivated. Please contact your administrator."), request.url));
            return redirectRes;
          }
        }

        // Compulsory password change enforcement
        if (profile.must_change_password || user.data.user.user_metadata?.must_change_password === true) {
          return NextResponse.redirect(new URL("/force-change-password", request.url));
        }

        // 1. Device restriction token validation check
        if (profile.device_restriction_type === "enforced") {
          const deviceToken = request.cookies.get("device_token")?.value;
          let isValidDevice = false;

          // Check if registered devices are configured in the system
          try {
            const { data: companyDevices, error: devicesErr } = await supabase
              .from("registered_devices")
              .select("id")
              .eq("is_active", true)
              .limit(1);

            // If registered_devices table doesn't exist, has an error, or has no devices registered at all,
            // don't lock out users with an unfulfillable device gate.
            if (devicesErr || !companyDevices || companyDevices.length === 0) {
              isValidDevice = true;
            } else if (deviceToken) {
              const { data: deviceRecord } = await supabase
                .from("registered_devices")
                .select("id, company_id")
                .eq("device_token", deviceToken)
                .eq("is_active", true)
                .maybeSingle();

              if (deviceRecord) {
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
          } catch (_) {
            isValidDevice = true;
          }

          if (!isValidDevice) {
            const errorParam = encodeURIComponent("Access restricted: Unregistered or unauthorized device. Please use an authorized registered device.");
            return NextResponse.redirect(new URL(`/select-tenant?error=${errorParam}`, request.url));
          }
        }

        // 2. Scheduled hours and date range validation check
        if (profile.login_restriction_type === "scheduled") {
          try {
            const tz = profile.timezone || "Asia/Kuala_Lumpur";
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: tz,
              hour12: false,
              weekday: "short",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            const parts = formatter.formatToParts(new Date());
            const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

            // Current date in target timezone as YYYY-MM-DD
            const currentDate = `${partMap.year}-${partMap.month}-${partMap.day}`;

            // Check date range boundary if configured
            if (profile.allowed_start_date && currentDate < profile.allowed_start_date) {
              const errorParam = encodeURIComponent(`Access not yet active. Your access period begins on ${profile.allowed_start_date} (${tz}).`);
              return NextResponse.redirect(new URL(`/sign-in?error=${errorParam}`, request.url));
            }

            if (profile.allowed_end_date && currentDate > profile.allowed_end_date) {
              const errorParam = encodeURIComponent(`Access expired. Your scheduled access ended on ${profile.allowed_end_date} (${tz}).`);
              return NextResponse.redirect(new URL(`/sign-in?error=${errorParam}`, request.url));
            }

            const dayMap: Record<string, number> = {
              'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7
            };
            const isoWeekday = dayMap[partMap.weekday] || 1;

            const allowedDays = profile.allowed_days || [1, 2, 3, 4, 5];
            const currentTime = `${partMap.hour}:${partMap.minute}:${partMap.second}`;
            const startTime = profile.allowed_start_time || "08:00:00";
            const endTime = profile.allowed_end_time || "17:00:00";

            if (!allowedDays.includes(isoWeekday) || currentTime < startTime || currentTime > endTime) {
              const errorParam = encodeURIComponent(`Access restricted outside allowed hours: ${startTime} - ${endTime} (${tz})`);
              return NextResponse.redirect(new URL(`/sign-in?error=${errorParam}`, request.url));
            }
          } catch (err) {
            console.error("[Middleware] Time scheduling check failed:", err);
          }
        }
      }
    }

    if (request.nextUrl.pathname === "/") {
      if (!user.error && user.data?.user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.redirect(new URL("/sign-in", request.url));
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
