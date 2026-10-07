# REPORT — csmju-branch-finance-transparency

## ผลรัน

### Static compliance

```text
All 20 checks passed.
```

`./standards/scripts/run-all-checks.sh .` ผ่านครบ 20 checks:
- Convention: branch / commit / CI untouched
- Standards version: 1.8.1 และ submodule ตรงกัน
- Security: secret, localStorage, JWT/SSO, DB isolation
- Architecture: dependencies, NestJS, deployment readiness
- API conventions
- Data dictionary
- UI tokens
- Code quality: lint, typecheck, unit tests, build
- Exception validation

### Unit / build verification

```text
Backend tests: 10 suites passed, 139 tests passed
Frontend tests: 3 files passed, 18 tests passed
Backend typecheck: passed
Frontend typecheck: passed (next typegen && tsc --noEmit)
Backend lint: passed
Frontend lint: passed
Backend build: passed
Frontend build: passed
```

### Docker verification

```text
docker compose up -d --build: passed
DB: healthy
API: healthy
Web: healthy
GET /api/health through web: HTTP 200
```

### Runtime conformance

ยังไม่สามารถประกาศ `CONFORMANT` ได้ในเครื่องนี้ เพราะ Core Hub สำหรับ conformance ยังไม่พร้อมใช้งาน/ไม่มีบัญชีทดสอบนอก repo

การรันครั้งล่าสุด:
```text
node standards/conformance/run.js
ERROR: could not obtain any Core Hub token for a role from http://localhost:3000.
```

หลังปรับ `subsystem.yaml` ให้ชี้ไปยัง Core Hub จริงแล้ว การรัน L3 ต้องใช้:
`CONFORMANCE_ACCOUNTS_FILE=~/.csmju/conformance-accounts.json`
และต้องมีระบบลงทะเบียนเป็น `APPROVED` + `ACTIVE` พร้อมบัญชี `owner` และ role ที่ใช้ทดสอบ
ตาม `standards/docs/conformance.md`.

## ไฟล์ที่สร้าง/แก้ไข

- `backend/src/approvals/*` — ปรับ approval API/service ตาม scope และมาตรฐาน
- `backend/src/audit/*` — ปรับ audit log API/query/service
- `backend/src/auth/*` — ปรับ permission/role mapping และ tests
- `backend/src/config/configuration.ts` — รองรับ Core Hub web URL/config ตามมาตรฐาน
- `backend/src/core-hub/*` — ปรับ reference-data/people access และเพิ่ม `core-hub-reference.controller.ts`
- `backend/src/officers/*` — ปรับ officer scope/API/service
- `backend/src/transactions/*` — ปรับ DTO/query/controller/service
- `backend/src/year-accounts/*` — ปรับ academic-year/account scope และ API
- `frontend/src/app/*` — ปรับหน้าหลัก, entries, transactions, approvals, audit logs, officers และ actions
- `frontend/src/components/TransactionTable.tsx` — ปรับตารางธุรกรรม
- `frontend/src/components/AcademicYearFilter.tsx` — เพิ่มตัวกรองปีการศึกษา
- `frontend/src/components/StudentPicker.tsx` — เพิ่มตัวเลือกนักศึกษา
- `frontend/src/lib/api.ts` — ปรับ API client/error handling
- `frontend/src/lib/caps.ts` — ปรับ capability/permission helpers
- `docker-compose.yml` — ปรับ deployment configuration
- `.env.example` — ปรับตัวอย่าง environment
- `subsystem.yaml` — ปรับ base URL และ Core Hub URL สำหรับ conformance จริง
- `REPORT.md` — รายงานผลตรวจสอบงานรอบนี้

## ชั้น auth ที่คัดลอกมา

- อ้างอิงชั้น auth ของ `demo-student-subsystem` ตามมาตรฐาน
- แก้ไขเฉพาะ role mapping และ permission values ของโดเมนนี้
- ไม่มีการแก้ตรรกะ verification ของ JWKS/SSO ที่มาตรฐานบังคับให้เหมือน reference implementation

## Role mapping ที่ประกาศ

ดูค่าจริงใน `backend/src/auth/role-mapping.ts` ซึ่งถูกตรวจด้วย `role-mapping.spec.ts` และ static compliance แล้ว

## ข้อสมมติที่ตั้งเอง

1. Docker frontend ใช้ `http://localhost:3203` ตาม callback port ใน `docker-compose.yml`.
2. Core Hub สำหรับ deployment/conformance จริงใช้ `https://csmju2030.jowave.com`.
3. Runtime conformance ต้องรอ credentials และสถานะ registration จาก Core Hub จึงจะสามารถยืนยัน L3 ได้.

## สิ่งที่ยังทำไม่ได้ / เคสที่ยังไม่ผ่าน

- Runtime conformance L3 ยังไม่ได้ยืนยัน เพราะไม่มี Core Hub test accounts ในไฟล์นอก repo และ Core Hub local เดิม (`localhost:3000`) ไม่ได้รัน
- `subsystem.yaml` ยังมี probe placeholders (`<resources>`) ที่ต้องกำหนด resource จริงก่อนประกาศ L3 conformant
- **ยังไม่ได้ commit** ตามคำสั่งงาน — การ commit จะเป็นขั้นตอนสุดท้ายหลัง runtime conformance และ final review ผ่าน
