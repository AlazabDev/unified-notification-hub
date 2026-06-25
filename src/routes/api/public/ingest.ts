import { createFileRoute } from "@tanstack/react-router";
import { ingestSchema, normalize } from "@/lib/notification-schema";
import { authorizeIngestRequest } from "@/lib/notification-auth.server";
import { persistNotification } from "@/lib/notification-persistence.server";
import { enqueueNotificationReceived } from "@/lib/notification-queue.server";

/**
 * Unified Ingestion endpoint.
 *
 *   POST /api/public/ingest
 *   Authorization: Bearer <INGEST_TOKEN>
 *   Content-Type: application/json
 *
 *   {
 *     "source": "meta" | "uberfix" | "accounting" | "system" | "custom",
 *     "eventType": "lead.new",                // optional
 *     "title": "...", "body": "...",          // optional, auto-derived if missing
 *     "severity": "info|success|warning|critical",
 *     "category": "all|projects|announcements|alerts",
 *     "subject": "user@x.com",
 *     "actions": [{ "id":"open", "label":"Open", "href":"https://..." }],
 *     "payload": { ... raw source payload ... }
 *   }
 *
 * Edge pipeline:
 *   1. Verify token.
 *   2. Validate with Zod.
 *   3. Normalize into UnifiedNotification.
 *   4. Persist to Supabase PostgREST when configured.
 *   5. Send event to Inngest when configured for retries/delays.
 *   6. Keep the temporary in-memory store updated for the current dashboard.
 */
export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = authorizeIngestRequest(request);
        if (!auth.ok) {
          return Response.json(
            { ok: false, error: auth.code },
            { status: auth.status },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        const parsed = ingestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: "validation_failed", issues: parsed.error.issues },
            { status: 422 },
          );
        }

        const notification = normalize(parsed.data);
        const { addNotification } = await import(
          "@/lib/notification-store.server"
        );

        // Transitional UI support. Supabase is the intended source of truth;
        // this keeps the existing prototype inbox useful until the UI subscribes
        // directly to Supabase Realtime.
        addNotification(notification);

        const [persistence, queue] = await Promise.all([
          persistNotification(notification),
          enqueueNotificationReceived(notification),
        ]);

        if (persistence.persisted === false && persistence.reason === "failed") {
          console.error("notification_persistence_failed", persistence.error);
        }
        if (queue.queued === false && queue.reason === "failed") {
          console.error("notification_queue_failed", queue.error);
        }

        return Response.json(
          {
            ok: true,
            id: notification.id,
            persistence,
            queue,
          },
          { status: 201 },
        );
      },
      GET: async () =>
        Response.json({
          name: "Az Notification Hub — Edge Ingestion API",
          method: "POST",
          auth: "Authorization: Bearer <INGEST_TOKEN>",
          pipeline: ["zod", "normalizer", "supabase-postgrest", "inngest-event"],
          schema: {
            source: "meta|uberfix|accounting|system|custom",
            eventType: "string?",
            title: "string?",
            body: "string?",
            severity: "info|success|warning|critical",
            category: "all|projects|announcements|alerts",
            subject: "string?",
            avatarUrl: "url?",
            actions: "[{id,label,variant?,href?,actionKey?}]",
            payload: "record?",
          },
        }),
    },
  },
});
