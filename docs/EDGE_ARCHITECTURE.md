# Az Notification Hub — Edge Architecture

## الهدف

`Az Notification Hub` هو مركز إشعارات موحد لكل أنظمة الشركة. أي نظام داخلي أو خارجي مثل Meta, UberFix, Accounting يرسل حدثًا واحدًا إلى Ingestion API، ثم يتحول الحدث إلى نموذج موحد يتم تخزينه وإظهاره لحظيًا داخل واجهة React.

## Runtime

المشروع يعمل على TanStack Start مع Edge Runtime / Cloudflare Workers. لذلك لا نعتمد على Redis دائم أو Node.js worker طويل العمر داخل نفس التطبيق.

## الطبقات

```text
External Systems
  └─ POST /api/public/ingest
       ├─ Authorization Bearer token
       ├─ Zod validation
       ├─ Normalizer
       ├─ Supabase PostgREST persistence
       ├─ Inngest event bridge
       └─ Supabase Realtime subscription in UI
```

## 1. Ingestion Layer

المسار الرئيسي:

```http
POST /api/public/ingest
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json
```

المسؤوليات:

- استقبال webhook/request من أي نظام.
- منع الطلبات غير الموقعة.
- التحقق من الجسم باستخدام Zod.
- تحويل payload إلى `UnifiedNotification`.
- إرسال النتيجة إلى التخزين والـ queue.

## 2. Processing Layer

الخيار الأساسي هو Inngest بدلاً من BullMQ/Redis لأن المشروع Edge-first.

المطلوب من Inngest لاحقًا:

- retries.
- delayed jobs.
- fan-out لقنوات التسليم.
- تسجيل delivery attempts.
- إعادة محاولة القنوات الفاشلة.

## 3. Persistence Layer

Supabase/Postgres هو مصدر الحقيقة.

الجداول الأساسية:

- `notifications`
- `notification_preferences`
- `notification_delivery_attempts`
- `notification_api_keys`

المخطط الأولي موجود في:

```text
drizzle/0001_notification_hub.sql
```

## 4. Delivery/UI Layer

المرحلة الحالية تحتفظ بالـ in-memory store لدعم الواجهة الموجودة. الهدف التالي هو جعل الواجهة تشترك مباشرة في جدول `notifications` عبر Supabase Realtime.

المسار الصحيح للواجهة:

```text
React Inbox
  └─ subscribe notifications table
       └─ filter by tenant_id / recipient_user_id
```

## Unified Notification Model

الحقول المهمة:

- `tenantId`: فصل بيانات الشركات/البيئات.
- `recipientUserId`: مستقبل الإشعار.
- `source`: النظام المصدر.
- `eventType`: نوع الحدث.
- `dedupeKey`: منع تكرار نفس webhook.
- `category`: تصنيف العرض.
- `severity`: درجة الخطورة.
- `channels`: قنوات التسليم.
- `raw`: نسخة audit من payload الأصلي.

## قرارات تنفيذية

### لماذا لا Redis؟

لأن Redis/BullMQ يحتاج عملية Node دائمة، وهذا عكس Edge Runtime. Inngest أو pgmq أنسب لهذا النوع من النشر.

### لماذا Supabase Realtime؟

لأنه يربط Postgres بالواجهة مباشرة بدون إدارة Socket.io داخل التطبيق. بمجرد إدخال صف في `notifications`، يمكن للواجهة استقبال التغيير.

### لماذا PostgREST Adapter مؤقتًا؟

حتى لا نضيف اعتماديات جديدة ونكسر `bun.lock` قبل تشغيل install داخل البيئة الفعلية. الكود الحالي يستخدم `fetch` فقط، وهو مناسب لـ Cloudflare Workers.

## مراحل الإكمال

### Phase 1 — Edge hardening

- حماية ingestion token.
- إضافة `.env.example`.
- إضافة migration.
- إضافة Supabase persistence bridge.
- إضافة Inngest event bridge.

### Phase 2 — Realtime UI

- إضافة Supabase client.
- استبدال polling باشتراك realtime.
- إضافة optimistic read/unread updates.

### Phase 3 — Delivery workflows

- بناء Inngest functions.
- email/push/chat/sms gateways.
- delivery attempts table.
- retry policy.

### Phase 4 — Enterprise controls

- API key management UI.
- tenant/user auth.
- RLS policies حسب نموذج المستخدم النهائي.
- audit dashboard.
- CI/CD.
