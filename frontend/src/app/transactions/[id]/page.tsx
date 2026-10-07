import { notFound } from "next/navigation";
import {
  PageHeader,
  StatusBadge,
  cardClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/csmju";
import Flash from "@/components/Flash";
import ReSignIn from "@/components/ReSignIn";
import { getAuditTrail, getTransaction, isUnauthorized, listEvidence, listYearAccounts } from "@/lib/api";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { gate } from "@/lib/gate";
import { AUDIT_ACTION_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/lib/labels";
import { formatBaht, formatSatang } from "@/lib/money";
import {
  approveTransaction,
  cancelTransaction,
  confirmIncome,
  rejectTransaction,
  updateTransaction,
  uploadBill,
  voidTransaction,
} from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายละเอียดรายการ" };

export default async function TransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const session = await gate();
  if ("view" in session) return session.view;
  const { me, caps } = session;
  const decider = caps.canDecide;

  const [transaction, evidence, years, trail] = await Promise.all([
    getTransaction(id),
    listEvidence(id),
    listYearAccounts(true),
    // the decision trail is for the deciders; the backend would answer 403 to others
    decider ? getAuditTrail(id) : Promise.resolve(null),
  ]);
  if (isUnauthorized(transaction, evidence, years) || (trail && isUnauthorized(trail))) return <ReSignIn />;
  if (!transaction.ok) {
    if (transaction.status === 404) notFound();
    return <Flash error={`โหลดรายการไม่สำเร็จ: ${transaction.message}`} />;
  }

  const row = transaction.data;
  const yearName = (years.ok ? years.data : []).find((year) => year.id === row.yearAccountId)?.name ?? "—";
  const status = STATUS_LABEL[row.status];
  const own = row.createdByCoreUserId === me.id;
  const pending = row.status === "PENDING" || row.status === "NEEDS_REVIEW";
  // Still undecided: PENDING for an expense, NEEDS_REVIEW for income.
  const undecided = row.status === (row.type === "INCOME" ? "NEEDS_REVIEW" : "PENDING");
  const bills = evidence.ok ? evidence.data : [];
  const current = bills.find((bill) => bill.isCurrent);
  // The treasurer of THIS cohort who filed it, while it is undecided (the backend checks the same).
  const treasurerMayChange =
    caps.treasurerYearAccountIds.includes(row.yearAccountId) &&
    own &&
    undecided &&
    (row.type === "EXPENSE" || row.type === "INCOME");

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <PageHeader title={row.description} description={`${TYPE_LABEL[row.type]} · ${yearName}`} />
      <Flash ok={ok} error={error} />

      <section className={`${cardClass} grid gap-4 p-6 md:grid-cols-2`}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body-md">
          <dt className="text-on-surface-variant">จำนวนเงิน</dt>
          <dd className="font-display text-headline-md tabular-nums">{formatBaht(row.amountSatang)}</dd>
          <dt className="text-on-surface-variant">วันที่</dt>
          <dd>{formatCalendarDate(row.transactionDate)}</dd>
          <dt className="text-on-surface-variant">หมวดหมู่</dt>
          <dd>{row.category ?? "—"}</dd>
          <dt className="text-on-surface-variant">สถานะ</dt>
          <dd>
            <StatusBadge tone={status.tone} label={status.label} />
          </dd>
        </dl>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body-md">
          <dt className="text-on-surface-variant">ยื่นโดย</dt>
          <dd>{row.createdByPersonCode ?? "เหรัญญิก"}</dd>
          <dt className="text-on-surface-variant">ยื่นเมื่อ</dt>
          <dd>{formatDateTime(row.createdAt)}</dd>
          {row.approvedAt && (
            <>
              <dt className="text-on-surface-variant">ตัดสินเมื่อ</dt>
              <dd>
                {formatDateTime(row.approvedAt)}
                {row.approvedByPersonCode ? ` · ${row.approvedByPersonCode}` : ""}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className={`${cardClass} flex flex-col gap-4 p-6`}>
        <h2 className="font-display text-headline-md text-on-surface">หลักฐาน</h2>
        {current ? (
          <figure className="flex flex-col gap-2">
            {current.kind === "PDF" ? (
              <>
                {/* A PDF is served by this subsystem behind the session cookie (same origin through the rewrite). */}
                <iframe
                  src={current.url}
                  title={`หลักฐานของรายการ ${row.description}`}
                  className="h-[36rem] w-full rounded-lg border border-outline-variant/40"
                />
                <a href={current.url} target="_blank" rel="noopener noreferrer" className="w-fit text-label-md text-primary-container hover:underline">
                  เปิด PDF ในแท็บใหม่ ({current.originalFilename})
                </a>
              </>
            ) : (
              <>
                {/* Core Hub's public image URL - not next/image: it would need Core Hub's origin in next.config */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.url}
                  alt={`หลักฐานของรายการ ${row.description}`}
                  loading="lazy"
                  className="max-h-[32rem] w-auto max-w-full rounded-lg border border-outline-variant/40 object-contain"
                />
              </>
            )}
            <figcaption className="text-caption text-on-surface-variant">
              เวอร์ชัน {current.version} · {current.kind === "PDF" ? "PDF" : "รูป"} · แนบเมื่อ {formatDateTime(current.uploadedAt)} ·{" "}
              {Math.max(1, Math.round(current.sizeBytes / 1024))} KB
            </figcaption>
          </figure>
        ) : (
          <p className="text-body-md text-on-surface-variant">
            {row.type === "INCOME"
              ? "ยังไม่มีหลักฐานแนบ — รายรับยืนยันได้โดยไม่ต้องแนบ แต่การแนบสลิปหรือใบเสร็จช่วยให้ตรวจสอบได้ง่ายขึ้น"
              : "ยังไม่มีหลักฐานแนบ — รายจ่ายที่ไม่มีบิลอนุมัติไม่ได้"}
          </p>
        )}
        {bills.length > 1 && (
          <p className="text-caption text-on-surface-variant">
            เคยแนบมาแล้ว {bills.length} เวอร์ชัน (เก็บประวัติไว้ทั้งหมด)
          </p>
        )}

        {treasurerMayChange && (
          <form action={uploadBill} encType="multipart/form-data" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={row.id} />
            <label className="flex flex-col gap-1 text-label-md">
              {current ? "แทนที่ด้วยหลักฐานใหม่" : "แนบหลักฐาน"} (PDF, JPEG, PNG หรือ WebP ไม่เกิน 10 MB)
              <input
                name="file"
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className={inputClass}
              />
            </label>
            <button type="submit" className={primaryButtonClass}>
              อัปโหลด
            </button>
            <p className="w-full text-caption text-on-surface-variant">
              รูปจะถูกย่อและแปลงเป็น WebP โดยบริการรูปของ Core Hub ส่วน PDF เก็บเป็นไฟล์ต้นฉบับ
            </p>
          </form>
        )}
      </section>

      {treasurerMayChange && (
        <section className={`${cardClass} flex flex-col gap-4 p-6`}>
          <h2 className="font-display text-headline-md text-on-surface">แก้ไขหรือถอนรายการ</h2>
          <form action={updateTransaction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={row.id} />
            <label className="flex flex-col gap-1 text-label-md">
              จำนวนเงิน (บาท)
              <input
                name="amount"
                defaultValue={formatSatang(row.amountSatang).replace(/,/g, "")}
                inputMode="decimal"
                pattern="[0-9,]+(\.[0-9]{1,2})?"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-label-md">
              วันที่
              <input name="transactionDate" type="date" defaultValue={row.transactionDate.slice(0, 10)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-label-md md:col-span-2">
              รายละเอียด
              <input name="description" defaultValue={row.description} maxLength={500} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-label-md">
              หมวดหมู่
              <input name="category" defaultValue={row.category ?? ""} maxLength={100} className={inputClass} />
            </label>
            <button type="submit" className={`${secondaryButtonClass} w-fit self-end`}>
              บันทึกการแก้ไข
            </button>
          </form>
          <form action={cancelTransaction} className="flex flex-wrap items-end gap-3 border-t border-outline-variant/40 pt-4">
            <input type="hidden" name="id" value={row.id} />
            <label className="flex flex-1 flex-col gap-1 text-label-md">
              เหตุผลที่ถอนรายการ
              <input name="reason" required maxLength={500} className={inputClass} />
            </label>
            <button type="submit" className={dangerButtonClass}>
              ถอนรายการ
            </button>
          </form>
        </section>
      )}

      {decider && (pending || row.status === "APPROVED") && (
        <section className={`${cardClass} flex flex-col gap-4 p-6`}>
          <h2 className="font-display text-headline-md text-on-surface">การตัดสิน</h2>
          {own ? (
            <p className="text-body-md text-on-surface-variant">รายการนี้ยื่นโดยบัญชีของคุณเอง — ตัดสินเองไม่ได้</p>
          ) : (
            <>
              {pending && (
                <div className="flex flex-wrap items-end gap-3">
                  <form action={row.type === "INCOME" ? confirmIncome : approveTransaction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className={primaryButtonClass}>
                      {row.type === "INCOME" ? "ยืนยันรายรับ" : "อนุมัติ"}
                    </button>
                  </form>
                  <form action={rejectTransaction} className="flex flex-1 flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={row.id} />
                    <label className="flex flex-1 flex-col gap-1 text-label-md">
                      เหตุผลที่ไม่อนุมัติ
                      <input name="reason" required maxLength={500} className={inputClass} />
                    </label>
                    <button type="submit" className={dangerButtonClass}>
                      ไม่อนุมัติ
                    </button>
                  </form>
                </div>
              )}
              {row.status === "APPROVED" && (
                <form action={voidTransaction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={row.id} />
                  <label className="flex flex-1 flex-col gap-1 text-label-md">
                    เหตุผลที่ยกเลิกรายการที่อนุมัติแล้ว
                    <input name="reason" required maxLength={500} className={inputClass} />
                  </label>
                  <button type="submit" className={dangerButtonClass}>
                    ยกเลิกรายการ
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      )}

      {trail?.ok && trail.data.length > 0 && (
        <section className={`${cardClass} flex flex-col gap-3 p-6`}>
          <h2 className="font-display text-headline-md text-on-surface">ประวัติการดำเนินการ</h2>
          <ol className="flex flex-col gap-2 text-body-md">
            {trail.data.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-3 border-b border-outline-variant/30 pb-2">
                <span className="whitespace-nowrap text-on-surface-variant">{formatDateTime(entry.createdAt)}</span>
                <span>{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</span>
                <span className="text-on-surface-variant">โดย {entry.actorPersonCode ?? "ระบบ"}</span>
                {entry.metadataJson?.reason && <span className="text-on-surface-variant">— {entry.metadataJson.reason}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
