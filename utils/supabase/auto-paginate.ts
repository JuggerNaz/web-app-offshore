/**
 * Auto-pagination wrapper for Supabase PostgREST clients.
 * PostgREST server has a hard default limit of max-rows = 1000.
 * Queries without explicit .limit(), .range(), .single(), or .maybeSingle()
 * are silently truncated at 1000 rows.
 * This wrapper intercepts .then() on query builders for designated tables
 * and transparently fetches all pages using range pagination so that
 * report wizards, API routes, and report generators receive the full dataset.
 */

const PAGINATED_TABLES = new Set([
  "insp_records",
  "structure_components",
  "insp_anomalies",
  "attachment",
  "insp_media",
  "insp_video_logs",
  "u_pipeline_events",
]);

export function autoPaginateClient<T extends { from: (...args: any[]) => any }>(client: T): T {
  if (!client || typeof client.from !== "function") return client;

  // Prevent double wrapping
  if ((client as any).__isAutoPaginated) return client;

  const origFrom = client.from.bind(client);

  client.from = function (table: string, ...fromArgs: any[]) {
    const qb = origFrom(table, ...fromArgs);
    if (!PAGINATED_TABLES.has(table) || !qb || typeof qb.select !== "function") {
      return qb;
    }

    const origSelect = qb.select.bind(qb);
    qb.select = function (...selectArgs: any[]) {
      const fb = origSelect(...selectArgs);
      if (!fb || typeof fb.then !== "function") return fb;

      const origThen = fb.then.bind(fb);
      let isExplicitLimitOrSingle = false;

      const origLimit = fb.limit ? fb.limit.bind(fb) : null;
      if (origLimit) {
        fb.limit = function (...args: any[]) {
          isExplicitLimitOrSingle = true;
          return origLimit(...args);
        };
      }

      const origRange = fb.range ? fb.range.bind(fb) : null;
      if (origRange) {
        fb.range = function (...args: any[]) {
          isExplicitLimitOrSingle = true;
          return origRange(...args);
        };
      }

      const origSingle = fb.single ? fb.single.bind(fb) : null;
      if (origSingle) {
        fb.single = function (...args: any[]) {
          isExplicitLimitOrSingle = true;
          return origSingle(...args);
        };
      }

      const origMaybeSingle = fb.maybeSingle ? fb.maybeSingle.bind(fb) : null;
      if (origMaybeSingle) {
        fb.maybeSingle = function (...args: any[]) {
          isExplicitLimitOrSingle = true;
          return origMaybeSingle(...args);
        };
      }

      const origCsv = fb.csv ? fb.csv.bind(fb) : null;
      if (origCsv) {
        fb.csv = function (...args: any[]) {
          isExplicitLimitOrSingle = true;
          return origCsv(...args);
        };
      }

      fb.then = async function (onfulfilled?: any, onrejected?: any) {
        try {
          if (isExplicitLimitOrSingle) {
            return await origThen(onfulfilled, onrejected);
          }

          const pageSize = 1000;
          let page = 0;
          const allData: any[] = [];
          let finalResponse: any = null;

          while (true) {
            const from = page * pageSize;
            const to = from + pageSize - 1;
            if (origRange) origRange(from, to);

            const pageRes = await origThen();
            if (pageRes?.error) {
              return onfulfilled ? onfulfilled(pageRes) : pageRes;
            }

            if (!pageRes?.data || pageRes.data.length === 0) {
              if (!finalResponse) finalResponse = pageRes;
              break;
            }

            allData.push(...pageRes.data);
            finalResponse = pageRes;

            if (pageRes.data.length < pageSize) {
              break;
            }

            page++;
            if (page >= 200) {
              console.warn(`[autoPaginateClient] Safety cap reached at ${page * pageSize} records for table "${table}".`);
              break;
            }
          }

          const res = {
            ...finalResponse,
            data: allData,
            count:
              finalResponse && finalResponse.count !== null && finalResponse.count !== undefined
                ? finalResponse.count
                : allData.length,
          };

          return onfulfilled ? onfulfilled(res) : res;
        } catch (err) {
          if (onrejected) return onrejected(err);
          throw err;
        }
      };

      return fb;
    };

    return qb;
  };

  (client as any).__isAutoPaginated = true;
  return client;
}
