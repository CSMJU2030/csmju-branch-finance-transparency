import { PageHeader, cardClass, inputClass, primaryButtonClass } from "@/csmju";
import Pager from "@/components/Pager";
import ReSignIn from "@/components/ReSignIn";
import TransactionTable from "@/components/TransactionTable";
import { isUnauthorized, listTransactions, listYearAccounts } from "@/lib/api";
import { gate } from "@/lib/gate";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายการทั้งหมด" };

type Query = { page?: string; entryYear?: string; yearAccountId?: string; type?: string; status?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const session = await gate();
  if ("view" in session) return session.view;

  const years = await listYearAccounts(true);
  if (isUnauthorized(years)) return <ReSignIn />;
  const selectedEntryYear = Number(query.entryYear);
  const selectedYearAccount = years.ok
    ? years.data.find((year) => year.entryAcademicYearLabel === String(selectedEntryYear))
    : undefined;
  const rows = await listTransactions({
      page: Number(query.page) > 0 ? Number(query.page) : 1,
      yearAccountId: selectedYearAccount?.id ?? query.yearAccountId,
      type: query.type,
      status: query.status,
    });
  if (isUnauthorized(rows)) return <ReSignIn />;

  const yearNames = Object.fromEntries((years.ok ? years.data : []).map((year) => [year.id, `ชั้นปีที่ ${year.yearLevel}`]));

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <PageHeader
        title="รายการทั้งหมด"
        description="รายรับ-รายจ่ายของทุกชั้นปี เปิดดูบิลและสถานะการอนุมัติของแต่ละรายการได้"
      />

      <form method="get" className={`${cardClass} flex flex-wrap items-end gap-4 p-4`}>
        <label className="flex flex-col gap-1 text-label-md">
          รุ่นปีแรกเข้า
          <select name="entryYear" defaultValue={selectedYearAccount?.entryAcademicYearLabel ?? ""} className={inputClass}>
            <option value="">ทุกชั้นปี</option>
            {(years.ok ? years.data : []).map((year) => (
              <option key={year.id} value={year.entryAcademicYearLabel ?? ""}>พ.ศ. {year.entryAcademicYearLabel ?? "—"} · ชั้นปีที่ {year.yearLevel}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label-md">
          ประเภท
          <select name="type" defaultValue={query.type ?? ""} className={inputClass}>
            <option value="">ทุกประเภท</option>
            {(["INCOME", "EXPENSE"] as const).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label-md">
          สถานะ
          <select name="status" defaultValue={query.status ?? ""} className={inputClass}>
            <option value="">ทุกสถานะ</option>
            {Object.entries(STATUS_LABEL).map(([status, info]) => (
              <option key={status} value={status}>
                {info.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={primaryButtonClass}>
          กรอง
        </button>
      </form>

      {rows.ok ? (
        <div className="flex flex-col">
          <TransactionTable rows={rows.data} yearNames={yearNames} empty="ไม่พบรายการตามเงื่อนไขที่เลือก" />
          <Pager meta={rows.meta} path="/transactions" query={{ ...query, entryYear: selectedYearAccount?.entryAcademicYearLabel ?? undefined }} />
        </div>
      ) : (
        <p role="alert" className="text-body-md text-error">
          โหลดรายการไม่สำเร็จ: {rows.message}
        </p>
      )}
    </div>
  );
}
