import { redirect } from "next/navigation";
import { PageHeader, cardClass, inputClass, primaryButtonClass } from "@/csmju";
import Flash from "@/components/Flash";
import Pager from "@/components/Pager";
import ReSignIn from "@/components/ReSignIn";
import TransactionTable from "@/components/TransactionTable";
import { isUnauthorized, listTransactions, listYearAccounts } from "@/lib/api";
import { todayInBangkok } from "@/lib/format";
import { gate } from "@/lib/gate";
import { createExpense, createIncome } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "ยื่นรายการ" };

/**
 * The treasurer files expenses and income of their own cohort here (income replaces the
 * old LINE quick entry), then attaches the evidence on the entry's page. Everyone else is
 * sent home; the backend checks the treasurer office either way.
 */
export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; page?: string }>;
}) {
  const { ok, error, page } = await searchParams;
  const session = await gate();
  if ("view" in session) return session.view;
  const { caps } = session;
  if (!caps.canFile) redirect("/");

  const [years, mine] = await Promise.all([
    listYearAccounts(false),
    listTransactions({ mine: true, page: Number(page) > 0 ? Number(page) : 1 }),
  ]);
  if (isUnauthorized(years, mine)) return <ReSignIn />;

  const yearNames = Object.fromEntries((years.ok ? years.data : []).map((year) => [year.id, year.name]));
  const myYears = caps.treasurerYearAccountIds.filter((id) => yearNames[id]);

  /** The same fields for both kinds: only the action and the wording differ. */
  const entryForm = (kind: "expense" | "income") => (
    <form
      action={kind === "expense" ? createExpense : createIncome}
      className={`${cardClass} grid gap-4 p-6 md:grid-cols-2`}
    >
      <h2 className="font-display text-headline-md text-on-surface md:col-span-2">
        {kind === "expense" ? "ยื่นรายจ่าย" : "บันทึกรายรับ"}
      </h2>
      <label className="flex flex-col gap-1 text-label-md">
        รุ่น
        <select name="yearAccountId" required className={inputClass} defaultValue={myYears[0]}>
          {myYears.map((id) => (
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
      </label>
      <label className="flex flex-col gap-1 text-label-md">
        หมวดหมู่ (ไม่บังคับ)
        <input name="category" maxLength={100} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-label-md md:col-span-2">
        รายละเอียด
        <input name="description" required maxLength={500} className={inputClass} />
      </label>
      <button type="submit" className={`${primaryButtonClass} w-fit md:col-span-2`}>
        {kind === "expense" ? "ยื่นรายจ่าย" : "บันทึกรายรับ"}
      </button>
    </form>
  );

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <PageHeader
        title="ยื่นรายการ"
        description="กรอกรายรับหรือรายจ่ายของรุ่นที่คุณดูแล แล้วแนบหลักฐาน (PDF หรือรูป) ในหน้ารายการ — รายจ่ายต้องมีบิลจึงอนุมัติได้ ส่วนรายรับแนบหรือไม่แนบก็ได้"
      />
      <Flash ok={ok} error={error} />

      <div className="grid gap-6 xl:grid-cols-2">
        {entryForm("expense")}
        {entryForm("income")}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-headline-md text-on-surface">รายการที่ฉันยื่น</h2>
        {mine.ok ? (
          <>
            <TransactionTable rows={mine.data} yearNames={yearNames} empty="ยังไม่เคยยื่นรายการ" />
            <Pager meta={mine.meta} path="/entries" query={{}} />
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
