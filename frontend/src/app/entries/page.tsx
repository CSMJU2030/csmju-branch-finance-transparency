import { redirect } from "next/navigation";
import { PageHeader, cardClass, inputClass, primaryButtonClass } from "@/csmju";
import Flash from "@/components/Flash";
import Pager from "@/components/Pager";
import ReSignIn from "@/components/ReSignIn";
import TransactionTable from "@/components/TransactionTable";
import { getRecentAcademicYears, getYearSummary, isUnauthorized, listTransactions, listYearAccounts } from "@/lib/api";
import { todayInBangkok } from "@/lib/format";
import { gate } from "@/lib/gate";
import { createExpense, createIncome } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "ยื่นรายการ" };

/**
 * The treasurer files expenses and income of their own cohort here and attaches the
 * required evidence in the same form. Everyone else is sent home; the backend checks
 * the treasurer office either way.
 */
export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; page?: string; academicYear?: string }>;
}) {
  const { ok, error, page, academicYear } = await searchParams;
  const session = await gate();
  if ("view" in session) return session.view;
  const { caps } = session;
  if (!caps.canFile) redirect("/");

  const [years, academicYears] = await Promise.all([listYearAccounts(false), getRecentAcademicYears()]);
  if (isUnauthorized(years, academicYears)) return <ReSignIn />;

  const myYears = caps.treasurerYearAccountIds.filter((id) => years.ok && years.data.some((year) => year.id === id));
  const cohortSummaries = await Promise.all(myYears.map((id) => getYearSummary(id)));
  if (isUnauthorized(...cohortSummaries)) return <ReSignIn />;
  const availableYears = academicYears.ok
    ? academicYears.data.filter((year) => cohortSummaries.some((summary) => summary.ok && summary.data.periods.some((period) => period.academicYear === String(year))))
    : [];
  const selectedYear = availableYears.includes(Number(academicYear)) ? Number(academicYear) : availableYears[0];
  const yearNames = Object.fromEntries((years.ok ? years.data : []).map((year) => {
    const summary = cohortSummaries.find((item) => item.ok && item.data.yearAccountId === year.id);
    const period = summary?.ok ? summary.data.periods.find((item) => item.academicYear === String(selectedYear)) : undefined;
    return [year.id, period ? `ชั้นปีที่ ${period.yearLevel}` : `ชั้นปีที่ ${year.yearLevel}`];
  }));
  const eligibleMyYears = cohortSummaries.flatMap((summary) =>
    summary.ok && summary.data.periods.some((period) => period.academicYear === String(selectedYear))
      ? [summary.data.yearAccountId]
      : [],
  );
  const mine = await listTransactions({ mine: true, page: Number(page) > 0 ? Number(page) : 1, academicYear: selectedYear });
  if (isUnauthorized(mine)) return <ReSignIn />;

  /** The same fields for both kinds: only the action and the wording differ. */
  const entryForm = (kind: "expense" | "income") => (
    <form
      action={kind === "expense" ? createExpense : createIncome}
      encType="multipart/form-data"
      className={`${cardClass} grid gap-4 p-6 md:grid-cols-2`}
    >
      <h2 className="font-display text-headline-md text-on-surface md:col-span-2">
        {kind === "expense" ? "ยื่นรายจ่าย" : "บันทึกรายรับ"} · พ.ศ. {selectedYear ?? "—"}
      </h2>
      <input type="hidden" name="academicYear" value={selectedYear ?? ""} />
      <label className="flex flex-col gap-1 text-label-md">
        ชั้นปี
        <select name="yearAccountId" required className={inputClass} defaultValue={eligibleMyYears[0]}>
          {eligibleMyYears.map((id) => (
            <option key={id} value={id}>
              {yearNames[id]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-label-md">
        จำนวนเงิน (บาท)
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="เช่น 1,250.50"
          pattern="[0-9,]+(\.[0-9]{1,2})?"
          title="ตัวเลขเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-label-md">
        {kind === "expense" ? "วันที่ใช้จ่าย" : "วันที่ได้รับเงิน"}
        <input name="transactionDate" type="date" required defaultValue={todayInBangkok()} className={inputClass} />
        <span className="text-caption text-on-surface-variant">วันที่ต้องอยู่ในปีการศึกษาที่เลือก</span>
      </label>
      <label className="flex flex-col gap-1 text-label-md">
        หมวดหมู่ (ไม่บังคับ)
        <input name="category" maxLength={100} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-label-md md:col-span-2">
        รายละเอียด
        <input name="description" required maxLength={500} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-label-md md:col-span-2">
        หลักฐาน (บังคับ · PDF, JPEG, PNG หรือ WebP ไม่เกิน 10 MB)
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={!eligibleMyYears.length || !selectedYear} className={`${primaryButtonClass} w-fit md:col-span-2`}>
        {kind === "expense" ? "ยื่นรายจ่าย" : "บันทึกรายรับ"}
      </button>
    </form>
  );

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <PageHeader
        title="ยื่นรายการ"
        description="กรอกรายรับหรือรายจ่ายของชั้นปีที่คุณดูแล พร้อมแนบหลักฐานก่อนส่ง (PDF หรือรูป) — ทุกรายการต้องมีไฟล์หลักฐาน"
      />
      <Flash ok={ok} error={error} />

      {!availableYears.length && <p className="text-body-sm text-error">ไม่พบปีการศึกษาที่บัญชีชั้นปีของคุณมีช่วงข้อมูล</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        {entryForm("expense")}
        {entryForm("income")}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-headline-md text-on-surface">รายการที่ฉันยื่น</h2>
        {mine.ok ? (
          <>
            <TransactionTable rows={mine.data} yearNames={yearNames} empty="ยังไม่เคยยื่นรายการ" />
            <Pager meta={mine.meta} path="/entries" query={selectedYear ? { academicYear: String(selectedYear) } : {}} />
          </>
        ) : (
          <p role="alert" className="text-body-md text-error">
            โหลดรายการไม่สำเร็จ: {mine.message}
          </p>
        )}
      </section>
    </div>
  );
}
