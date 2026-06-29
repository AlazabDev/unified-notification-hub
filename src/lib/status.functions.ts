import { createServerFn } from "@tanstack/react-start";

export const listDeliveryAttemptsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("notification_delivery_attempts")
      .select(
        "id, channel, status, provider, attempt_count, last_error, delivered_at, scheduled_at, created_at, notification_id",
      )
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const listDeliveryJobsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("notification_jobs")
      .select(
        "id, job_type, status, attempts, max_attempts, last_error, run_at, updated_at, notification_id",
      )
      .in("status", ["failed", "retry", "pending"])
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const listIngestionErrorEventsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("notification_events_log")
      .select("id, status, status_code, error_code, error_message, event_type, created_at")
      .in("status", ["rejected", "failed"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);