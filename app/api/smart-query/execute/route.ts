import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  QUERY_CATEGORIES,
  applyComputedOp,
  type ConditionRule,
  type SortRule,
  type ComputedField,
} from "@/utils/smart-query-schema";
import { withTenant } from "@/utils/tenant-auth";

const MAX_ROWS = 10000;

export const POST = withTenant(async (request, { companyId }) => {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      category,
      fields,
      computedFields,
      sorting,
      conditions,
    }: {
      category: string;
      fields: string[];
      computedFields?: ComputedField[];
      sorting?: SortRule[];
      conditions?: ConditionRule[];
    } = body;

    const catDef = QUERY_CATEGORIES.find(c => c.id === category);
    if (!catDef) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const validFieldKeys = new Set(catDef.fields.map(f => f.key));
    const selectFields = fields.filter(f => validFieldKeys.has(f));

    if (selectFields.length === 0) {
      return NextResponse.json({ error: "No valid fields selected" }, { status: 400 });
    }

    let query = (supabase as any)
      .from(catDef.table)
      .select(selectFields.join(","), { count: "exact" })
      .eq("company_id", companyId);

    if (category === "findings") {
      query = query.eq("record_category", "Finding");
    } else if (category === "anomalies") {
      query = query.or("record_category.eq.Anomaly,record_category.is.null");
    } else if (category === "incomplete") {
      query = query.eq("status", "INCOMPLETE");
    }

    if (conditions && conditions.length > 0) {
      for (const cond of conditions) {
        if (!validFieldKeys.has(cond.field)) continue;

        const fieldType = catDef.fields.find(f => f.key === cond.field)?.dataType;
        let finalField = cond.field;
        let finalValue = cond.value;
        let finalValue2 = cond.value2;
        let finalOperator = cond.operator;

        if (cond.transform === "year" && fieldType === "date" && cond.value) {
          const year = parseInt(cond.value);
          if (!isNaN(year)) {
            const start = `${year}-01-01`;
            const end = `${year}-12-31`;

            switch (cond.operator) {
              case "eq":
                query = query.gte(cond.field, start).lte(cond.field, end);
                continue;
              case "neq":
                query = query.or(`${cond.field}.lt.${start},${cond.field}.gt.${end}`);
                continue;
              case "gt":
                query = query.gt(cond.field, end);
                continue;
              case "lt":
                query = query.lt(cond.field, start);
                continue;
              case "gte":
                query = query.gte(cond.field, start);
                continue;
              case "lte":
                query = query.lte(cond.field, end);
                continue;
            }
          }
        }

        switch (finalOperator) {
          case "eq":
            if (fieldType === "text") {
              query = query.ilike(finalField, finalValue);
            } else {
              query = query.eq(finalField, finalValue);
            }
            break;
          case "neq":
            if (fieldType === "text") {
              query = query.not(finalField, "ilike", finalValue);
            } else {
              query = query.neq(finalField, finalValue);
            }
            break;
          case "gt":
            query = query.gt(finalField, finalValue);
            break;
          case "lt":
            query = query.lt(finalField, finalValue);
            break;
          case "gte":
            query = query.gte(finalField, finalValue);
            break;
          case "lte":
            query = query.lte(finalField, finalValue);
            break;
          case "contains":
            query = query.ilike(finalField, `%${finalValue}%`);
            break;
          case "starts_with":
            query = query.ilike(finalField, `${finalValue}%`);
            break;
          case "ends_with":
            query = query.ilike(finalField, `%${finalValue}`);
            break;
          case "is_empty":
            query = query.is(finalField, null);
            break;
          case "is_not_empty":
            query = query.not(finalField, "is", null);
            break;
          case "is_true":
            query = query.eq(finalField, true);
            break;
          case "is_false":
            query = query.eq(finalField, false);
            break;
          case "between":
            if (finalValue && finalValue2) {
              query = query.gte(finalField, finalValue).lte(finalField, finalValue2);
            }
            break;
        }
      }
    }

    if (sorting && sorting.length > 0) {
      for (const sort of sorting) {
        if (validFieldKeys.has(sort.field)) {
          query = query.order(sort.field, { ascending: sort.direction === "asc" });
        }
      }
    }

    query = query.limit(MAX_ROWS);

    const { data, error, count } = await query;

    if (error) {
      console.error("[SmartQuery] Execute error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let results = data || [];
    if (computedFields && computedFields.length > 0) {
      results = results.map((row: any) => {
        const enriched = { ...row };
        for (const cf of computedFields) {
          if (cf.sourceField && cf.operation && cf.name) {
            enriched[cf.name] = applyComputedOp(
              row[cf.sourceField],
              cf.operation,
              cf.params || {}
            );
          }
        }
        return enriched;
      });
    }

    return NextResponse.json({
      data: results,
      count: count || results.length,
      truncated: (count || 0) > MAX_ROWS,
    });
  } catch (error: any) {
    console.error("[SmartQuery] Critical error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
});
