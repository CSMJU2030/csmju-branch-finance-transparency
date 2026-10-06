import Link from "next/link";
import { PageHeader, cardClass, inputClass, primaryButtonClass, StatusBadge } from "@/csmju";
import Flash from "@/components/Flash";
import ReSignIn from "@/components/ReSignIn";
import { getYearSummary, isUnauthorized, listPending, listYearAccounts } from "@/lib/api";
import { gate } from "@/lib/gate";
import { formatBaht } from "@/lib/money";
import { advanceAcademicYear } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "ภาพรวม" };

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; archived?: string }>;
}) {
  const { ok, error, archived } = await searchParams;
  const session = await gate();
  if ("view" in session) return session.view;
  const { caps } = session;

  const years = await listYearAccounts(archived === "1");
  if (isUnauthorized(years)) return <ReSignIn />;

  const summaries = years.ok ? await Promise.all(years.data.map((year) => getYearSummary(year.id))) : [];
  const pending = caps.canDecide ? await listPending() : null;

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <PageHeader
        title="ภาพรวมการเงินของสาขา"
        description="ยอดคงเหลือของแต่ละรุ่น คำนวณจากรายการที่อนุมัติแล้วเท่านั้น — ทุกคนที่เข้าระบบได้ดูได้เหมือนกัน"
      />
      <Flash ok={ok} error={error} />

      {pending?.ok && pending.data.length > 0 && (
        <Link
          href="/approvals"
          className={`${cardClass} flex items-center justify-between gap-4 px-6 py-4 text-body-md hover:bg-surface-container-low`}
        >
          <span>มี {pending.data.length} รายการรอการตัดสิน</span>
          <StatusBadge tone="warning" label="ไปที่รออนุมัติ" />
        </Link>
      )}

      {!years.ok && <Flash error={`โหลดข้อมูลไม่สำเร็จ: ${years.message}`} />}

      <div className="grid gap-4 md:grid-cols-2">
        {summaries.map((summary) =>
          summary.ok ? (
            <section key={summary.data.yearAccountId} className={`${cardClass} flex flex-col gap-4 p-6`}>
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-headline-md text-on-surface">{summary.data.name}</h2>
                  <p className="text-caption text-on-surface-variant">ชั้นปี {summary.data.yearLevel}</p>
                </div>
                {!summary.data.active && <StatusBadge tone="neutral" label="จบการศึกษาแล้ว" />}
              </header>
              <p
                className={`font-display text-display-lg tabular-nums ${
                  summary.data.balanceSatang < 0 ? "text-error" : "text-on-surface"
                }`}
              >
                {formatBaht(summary.data.balanceSatang)}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body-md">
                <dt className="text-on-surface-variant">ยอดยกมา</dt>
                <dd className="text-right tabular-nums">{formatBaht(summary.data.openingBalanceSatang)}</dd>
                <dt className="text-on-surface-variant">รายรับที่อนุมัติ</dt>
                <dd className="text-right tabular-nums text-emerald-700">+{formatBaht(summary.data.approvedIncomeSatang)}</dd>
                <dt className="text-on-surface-variant">รายจ่ายที่อนุมัติ</dt>
                <dd className="text-right tabular-nums">−{formatBaht(summary.data.approvedExpenseSatang)}</dd>
                <dt className="text-on-surface-variant">รายจ่ายรอตรวจ (ยังไม่หักจากยอด)</dt>
                <dd className="text-right tabular-nums text-amber-800">{formatBaht(summary.data.pendingExpenseTotalSatang)}</dd>
              </dl>
              <Link
                href={`/transactions?yearAccountId=${summary.data.yearAccountId}`}
                className="text-label-md text-primary-container hover:underline"
              >
                ดูรายการของรุ่นนี้
              </Link>
            </section>
          ) : (
            <p key={summary.status + summary.message} className={`${cardClass} p-6 text-body-md text-on-surface-variant`}>
              โหลดยอดของรุ่นหนึ่งไม่สำเร็จ
            </p>
          ),
        )}
      </div>

      <p className="text-body-md text-on-surface-variant">
        {archived === "1" ? (
          <Link href="/" className="text-primary-container hover:underline">
            ซ่อนรุ่นที่จบการศึกษาแล้ว
          </Link>
        ) : (
          <Link href="/?archived=1" className="text-primary-container hover:underline">
            แสดงรุ่นที่จบการศึกษาแล้ว (ประวัติยังเปิดดูได้)
          </Link>
        )}
      </p>

      {caps.canDecide && (
        <details className={`${cardClass} p-6`}>
          <summary className="cursor-pointer text-label-md text-on-surface">ปิดปีการศึกษา (ทำปีละครั้ง)</summary>
          <form action={advanceAcademicYear} className="mt-4 flex flex-col gap-4">
            <p className="text-body-md text-on-surface-variant">
              ทุกรุ่นเลื่อนขึ้นหนึ่งชั้นปี รุ่นปี 4 จบการศึกษา (เก็บประวัติไว้) และสร้างรุ่นปี 1 ใหม่ ย้อนกลับไม่ได้
            </p>
            <label className="flex flex-col gap-1 text-label-md">
              ปีการศึกษาใหม่ (พ.ศ.)
              <input name="newAcademicYear" required pattern="\d{4}" placeholder="เช่น 2570" className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-body-md">
              <input type="checkbox" name="confirm" value="yes" />
              ฉันเข้าใจว่าการปิดปีการศึกษาย้อนกลับไม่ได้
            </label>
            <button type="submit" className={`${primaryButtonClass} w-fit`}>
              ปิดปีการศึกษา
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
