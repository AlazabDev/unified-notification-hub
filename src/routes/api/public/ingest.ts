import { createFileRoute } from "@tanstack/react-router";
import { ingestSchema, normalize } from "@/lib/notification-schema";
import { authorizeIngestRequest } from "@/lib/notification-auth.server";
import {
  createDeliveryJob,
  logNotificationEvent,
  persistNotification,
} from "@/lib/notification-persistence.server";
import { enqueueNotificationReceived } from "@/lib/notification-queue.server";
import type { UnifiedNotification } from "@/types/notification";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers":
    "authorization, content-type, x-request-id, x-api-key, x-azab-signature, x-azab-timestamp",
  "access-control-max-age": "86400",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const errorMessages: Record<string, { ar: string; en: string }> = {
  missing_token: {
    ar: "مفتاح الوصول غير موجود.",
    en: "Missing bearer token.",
  },
  invalid_token: {
    ar: "مفتاح الوصول غير صحيح أو غير مسجل.",
    en: "Invalid or unregistered bearer token.",
  },
  inactive_source: {
    ar: "مصدر الإشعارات غير مفعّل.",
    en: "Notification source is not active.",
  },
  missing_signature: {
    ar: "توقيع الطلب مطلوب لهذا المصدر.",
    en: "Request signature is required for this source.",
  },
  invalid_signature: {
    ar: "توقيع الطلب غير صحيح.",
    en: "Invalid request signature.",
  },
  stale_signature: {
    ar: "توقيع الطلب منتهي الصلاحية.",
    en: "Request signature timestamp is stale.",
  },
  server_misconfigured: {
    ar: "إعدادات الخادم غير مكتملة.",
    en: "Server ingestion configuration is incomplete.",
  },
  rate_limited: {
    ar: "تم تجاوز حد الطلبات المسموح لهذا المصدر.",
    en: "Source rate limit exceeded.",
  },
  invalid_json: {
    ar: "جسم الطلب ليس JSON صالحاً.",
    en: "Request body is not valid JSON.",
  },
  validation_failed: {
    ar: "بيانات الإشعار غير مطابقة للمخطط المطلوب.",
    en: "Notification payload failed schema validation.",
  },
};

function jsonError(code: string, status: number, extra?: Record<string, unknown>) {
  const message = errorMessages[code] ?? {
    ar: "حدث خطأ أثناء معالجة الطلب.",
    en: "An error occurred while processing the request.",
  };

  return withCors(Response.json(
    {
      ok: false,
      error: code,
      message_ar: message.ar,
      message_en: message.en,
      ...extra,
    },
    { status },
  ));
}

/**
 * Unified Ingestion endpoint.
 *
 *   POST /api/public/ingest
 *   Authorization: Bearer <SOURCE_TOKEN>
 *   Content-Type: application/json
 */
export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

        let rawBody = "";
        try {
          rawBody = await request.text();
        } catch {
          return jsonError("invalid_json", 400, { requestId });
        }

        const auth = await authorizeIngestRequest(request, rawBody);
        if (!auth.ok) {
          void logNotificationEvent({
            requestId,
            status: "rejected",
            statusCode: auth.status,
            errorCode: auth.code,
          });
          return jsonError(auth.code, auth.status, { requestId });
        }

        let body: unknown;
        try {
          body = JSON.parse(rawBody);
        } catch {
          void logNotificationEvent({
            tenantId: auth.source.tenantId,
            sourceId: auth.source.id,
            requestId,
            status: "rejected",
            statusCode: 400,
            errorCode: "invalid_json",
          });
          return jsonError("invalid_json", 400, { requestId });
        }

        const parsed = ingestSchema.safeParse(body);
        if (!parsed.success) {
          void logNotificationEvent({
            tenantId: auth.source.tenantId,
            sourceId: auth.source.id,
            requestId,
            status: "rejected",
            statusCode: 422,
            errorCode: "validation_failed",
            errorMessage: parsed.error.issues.map((issue) => issue.message).join("; "),
          });
          return jsonError("validation_failed", 422, {
            requestId,
            issues: parsed.error.issues,
          });
        }

        const notification = normalize({
          ...parsed.data,
          tenantId: parsed.data.tenantId ?? auth.source.tenantId,
          source: auth.source.sourceType ?? parsed.data.source,
        }) as UnifiedNotification & { sourceId?: string };
        notification.sourceId = auth.source.id;

        const [persistence, job, queue] = await Promise.all([
          persistNotification(notification),
          createDeliveryJob(notification),
          enqueueNotificationReceived(notification),
        ]);

        if (persistence.persisted === false && persistence.reason === "failed") {
          console.error("notification_persistence_failed", persistence.error);
        }
        if (job.persisted === false && job.reason === "failed") {
          console.error("notification_job_create_failed", job.error);
        }
        if (queue.queued === false && queue.reason === "failed") {
          console.error("notification_queue_failed", queue.error);
        }

        void logNotificationEvent({
          tenantId: notification.tenantId,
          sourceId: auth.source.id,
          requestId,
          dedupeKey: notification.dedupeKey,
          eventType: notification.eventType,
          status: persistence.persisted === false && persistence.reason === "failed" ? "failed" : "accepted",
          statusCode: 201,
          notificationId: notification.id,
        });

        return withCors(Response.json(
          {
            ok: true,
            requestId,
            id: notification.id,
            source: auth.source.sourceKey,
            persistence,
            job,
            queue,
          },
          { status: 201 },
        ));
      },
      GET: async () =>
        withCors(Response.json({
          name: "Az Notification Hub — Edge Ingestion API",
          method: "POST",
          auth: "Authorization: Bearer <SOURCE_TOKEN>",
          pipeline: [
            "source-token",
            "optional-hmac",
            "zod",
            "normalizer",
            "supabase-postgrest",
            "event-log",
            "notification-job",
            "inngest-event",
          ],
          schema: {
            tenantId: "string?",
            recipientUserId: "string?",
            source: "meta|uberfix|accounting|system|custom",
            eventType: "string?",
            dedupeKey: "string?",
            title: "string?",
            body: "string?",
            severity: "info|success|warning|critical",
            category: "all|projects|announcements|alerts",
            subject: "string?",
            avatarUrl: "url?",
            actions: "[{id,label,variant?,href?,actionKey?}]",
            payload: "record?",
          },
        })),
    },
  },
});
