import { createFileRoute } from "@tanstack/react-router";
import { ingestSchema, normalize } from "@/lib/notification-schema";

/**
 * Unified Ingestion endpoint.
 *
 *   POST /api/public/ingest
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
 * The endpoint validates with Zod, normalizes into UnifiedNotification,
 * and writes to the store. UI polls via TanStack Query.
 *
 * SECURITY: this lives under /api/public which bypasses app auth on the
 * published site. Add an `Authorization: Bearer <INGEST_TOKEN>` check below
 * (or HMAC signature) before going to production.
 */
export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // --- Optional shared-secret auth (uncomment after setting INGEST_TOKEN) ---
        // const token = process.env.INGEST_TOKEN;
        // const auth = request.headers.get("authorization") ?? "";
        // if (!token || auth !== `Bearer ${token}`) {
        //   return new Response("Unauthorized", { status: 401 });
        // }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const parsed = ingestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "validation_failed", issues: parsed.error.issues },
            { status: 422 },
          );
        }

        const notification = normalize(parsed.data);
        const { addNotification } = await import(
          "@/lib/notification-store.server"
        );
        addNotification(notification);

        // TODO(queue): enqueue downstream channel delivery (email/sms/whatsapp)
        // once you wire BullMQ replacement (Inngest / pgmq / external worker).

        return Response.json({ ok: true, id: notification.id }, { status: 201 });
      },
      GET: async () =>
        Response.json({
          name: "Az Notification Hub — Ingestion API",
          method: "POST",
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
