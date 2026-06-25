

## القرار المعتمد

الدومين الإنتاجي:

```text
notify.alazab.com
```

والأنظمة التي سيتم تسجيلها كمصادر أولية في `notification_sources`:

```text
alazab.com
uberfix.alazab.com
erp.alazab.com
ai.alazab.com
photos.alazab.com
agent.alazab.com
proudcte.alazab.com
```

---

# الترتيب النهائي للتنفيذ

الترتيب الذي كتبته صحيح تقريبًا، وسأعتمده بهذا الشكل:

```text
1 → 2 → 6 → 3 → 4 → 5 → 7
```

يعني:

1. **Persistence**
2. **Ingestion Security**
3. **Auth & Roles**
4. **Dashboard**
5. **Realtime**
6. **Channel Gateways**
7. **Production Quality**

هذا ترتيب سليم؛ لأن الواجهة بدون بيانات وأمان ستكون مجرد شكل.

---

# تعديلات مهمة على الخطة

## 1) `notification_sources` أهم من مجرد جدول تعريف

هذا الجدول سيكون هو قلب الأمان لكل نظام متصل.

الشكل المقترح:

```sql
notification_sources
- id
- tenant_id
- name
- domain
- source_key
- bearer_token_hash
- hmac_secret_hash
- hmac_enabled
- rate_limit_per_minute
- active
- last_seen_at
- created_at
- updated_at
```

لا نخزن Bearer Token أو HMAC Secret نص صريح داخل قاعدة البيانات. نخزن hash فقط.

---

## 2) `notification_events_log` ضروري حتى لو فشل الإشعار

هذا الجدول لازم يسجل كل request ونتيجته:

```sql
notification_events_log
- id
- source_id
- tenant_id
- request_id
- dedupe_key
- event_type
- status
- status_code
- error_code
- error_message
- ip_hash
- user_agent
- raw_payload
- normalized_notification_id
- created_at
```

هذا سيكشف مشاكل الربط مع Meta / UberFix / ERP بسرعة.

---

## 3) `notification_jobs` ممكن، لكن ليس كبديل كامل لـ Inngest

اقتراحك صحيح أن BullMQ لا يناسب Cloudflare Workers. لكن `notification_jobs + retry logic` داخل server functions وحده ناقص؛ لأن server functions لا تعمل كعامل دائم.

الأفضل:

```text
المرحلة الحالية:
notification_jobs table + تسجيل الحالة

المرحلة الإنتاجية:
Inngest يتولى retries/delays
أو Supabase pgmq/pg_cron إذا أردنا كل شيء داخل Postgres
```

أنا أفضل **Inngest** في هذا المشروع لأنه أوضح وأسهل في المراقبة وإعادة المحاولة.

---

## 4) HMAC اختياري نعم، لكن لبعض الأنظمة إجباري

التطبيقات الداخلية الصغيرة ممكن تبدأ بـ Bearer Token فقط.

لكن الأنظمة المهمة مثل:

```text
erp.alazab.com
uberfix.alazab.com
agent.alazab.com
```

الأفضل يكون عليها:

```text
Bearer Token + HMAC Signature + Timestamp
```

حتى لا يتم replay لنفس request.

---

# المخطط العملي للمرحلة 1

## Phase 1 — Persistence

### الملفات المطلوب تعديلها

```text
drizzle/0001_notification_hub.sql
src/lib/notification-store.server.ts
src/lib/notification-persistence.server.ts
src/types/notification.ts
src/lib/notification-schema.ts
```

### الجداول المطلوبة

```text
notifications
notification_preferences
notification_sources
notification_events_log
notification_delivery_attempts
notification_jobs
user_roles
```

حتى لو `user_roles` تابع للمرحلة 6، الأفضل نضعه مبكرًا في migration حتى لا نعيد هيكلة RLS لاحقًا.

---

# المخطط العملي للمرحلة 2

## Phase 2 — Ingestion Layer

### المطلوب

```text
/api/public/ingest
```

يعمل بهذا التسلسل:

```text
1. قراءة Authorization Bearer
2. البحث عن source في notification_sources
3. التأكد أن source active
4. التحقق من HMAC إذا مفعّل
5. تطبيق rate limit
6. Zod validation
7. idempotency check
8. normalize payload
9. insert notifications
10. insert notification_events_log
11. create notification_jobs / send Inngest event
12. response 201
```

### استجابة الأخطاء بالعربي والإنجليزي

مثال:

```json
{
  "ok": false,
  "error": "invalid_signature",
  "message_ar": "توقيع الطلب غير صحيح",
  "message_en": "Invalid request signature"
}
```

---

# المخطط العملي للمرحلة 6

## Auth & Roles

الأدوار:

```text
admin
operator
viewer
```

الصلاحيات:

| الدور    | الصلاحيات                                           |
| -------- | --------------------------------------------------- |
| admin    | إدارة المصادر، المفاتيح، الإعدادات، المشاهدة، الحذف |
| operator | قراءة الإشعارات، تغيير الحالة، تنفيذ actions        |
| viewer   | قراءة فقط                                           |

المسارات:

```text
/auth
/_authenticated/inbox
/_authenticated/sources
/_authenticated/preferences
/_authenticated/analytics
/_authenticated/logs
```

---

# المخطط العملي للواجهة

## Dashboard Layout

```text
Sidebar
Topbar
Content Area
Right Details Drawer
Floating Bell
```

## الصفحات

```text
Inbox
Notification Details
Sources
Preferences
Analytics
Logs
Settings
```

## تصميم العزب

لا نعمل واجهة Generic. الهوية تكون:

```text
Dark glass panels
Gold accent
Neon edge lines
Arabic-first RTL
Enterprise control panel
```

لكن بدون مبالغة تضيع قابلية الاستخدام.

---

# قرار تقني نهائي

| البند        | القرار                                 |
| ------------ | -------------------------------------- |
| Runtime      | Edge / Cloudflare Workers              |
| Framework    | TanStack Start                         |
| DB           | Supabase Postgres                      |
| ORM          | Drizzle لاحقًا، والآن SQL + PostgREST  |
| Realtime     | Supabase Realtime                      |
| Queue        | Inngest                                |
| Validation   | Zod                                    |
| Realtime UI  | Supabase channel                       |
| Auth         | Supabase Auth أو TanStack auth wrapper |
| Email        | Resend                                 |
| WhatsApp/SMS | Stub ثم Provider حقيقي لاحقًا          |
| Redis/BullMQ | مرفوض لهذا المشروع                     |

---

# الخطوة التالية التي أنفذها

المرحلة القادمة يجب أن تكون:

```text
Phase 1 — Persistence Upgrade
```

وتحديدًا:

1. تحديث migration ليشمل:

   * `notification_sources`
   * `notification_events_log`
   * `notification_jobs`
   * `user_roles`
   * RLS/GRANTs
   * `REPLICA IDENTITY FULL`

2. تعديل `notification-persistence.server.ts` ليستخدم الجداول الجديدة.

3. إضافة seed أولي للمصادر:

```text
alazab.com
uberfix.alazab.com
erp.alazab.com
ai.alazab.com
photos.alazab.com
agent.alazab.com
proudcte.alazab.com
```

