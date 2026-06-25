# Az Notification Hub

مركز إشعارات موحد لكل أنظمة Alazab، مبني بواجهة React/TanStack Start ويستهدف Edge Runtime مثل Cloudflare Workers.

## الهدف

أي نظام داخل الشركة أو خارجها يرسل حدثًا إلى نقطة دخول واحدة، ثم يقوم النظام بـ:

1. التحقق من الطلب.
2. توحيد شكل الإشعار.
3. تخزينه في Supabase/Postgres.
4. إرسال event إلى Inngest لمعالجة القنوات والـ retries.
5. عرضه في واجهة React عبر Supabase Realtime.

## التشغيل المحلي

```bash
bun install
bun run dev
```

## فحص المشروع

```bash
bun run lint
bun run typecheck
bun run build
```

أو:

```bash
bun run check
```

## المتغيرات

انسخ الملف:

```bash
cp .env.example .env.local
```

أهم المتغيرات:

```env
INGEST_TOKEN=change-me-long-random-token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key
INNGEST_EVENT_KEY=replace-when-ready
```

## Ingestion API

```http
POST /api/public/ingest
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json
```

مثال:

```json
{
  "tenantId": "alazab",
  "recipientUserId": "operations-manager",
  "source": "uberfix",
  "eventType": "ticket.assigned",
  "dedupeKey": "uberfix-ticket-4821-assigned-v1",
  "title": "تذكرة صيانة جديدة #4821",
  "body": "تم تعيين تذكرة صيانة جديدة لفريق التكييف — الأولوية عالية.",
  "severity": "warning",
  "category": "projects",
  "subject": "ticket-4821",
  "payload": {
    "ticketId": "4821",
    "priority": "high"
  }
}
```

## Database

المخطط الأولي موجود في:

```text
drizzle/0001_notification_hub.sql
```

طبقه على Supabase قبل تفعيل `REQUIRE_SUPABASE=true`.

## Architecture

راجع:

```text
docs/EDGE_ARCHITECTURE.md
```

## الحالة الحالية

المشروع الآن في مرحلة انتقالية:

- الواجهة القديمة ما زالت تستخدم in-memory store حتى لا تنكسر.
- Ingestion API أصبح محميًا افتراضيًا.
- عند توفر Supabase env، يتم التخزين عبر PostgREST.
- عند توفر Inngest env، يتم إرسال event إلى Inngest.
- المرحلة التالية هي استبدال polling داخل الواجهة باشتراك Supabase Realtime.
