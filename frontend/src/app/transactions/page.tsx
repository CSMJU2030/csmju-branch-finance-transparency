import { PageHeader, cardClass, inputClass, primaryButtonClass } from "@/csmju";
import Pager from "@/components/Pager";
import ReSignIn from "@/components/ReSignIn";
import TransactionTable from "@/components/TransactionTable";
import { getRecentAcademicYears, isUnauthorized, listTransactions, listYearAccounts } from "@/lib/api";
import { gate } from "@/lib/gate";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายการทั้งหมด" };

type Query = { page?: string; academicYear?: string; yearAccountId?: string; type?: string; status?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const session = await gate();
  if ("view" in session) return session.view;

  const [years, academicYears] = await Promise.all([
    listYearAccounts(true),
    getRecentAcademicYears(),
  ]);
  if (isUnauthorized(years, academicYears)) return <ReSignIn />;
  const selectedYear = academicYears.ok
    ? (academicYears.data.includes(Number(query.academicYear)) ? Number(query.academicYear) : academicYears.data[0])
    : undefined;
  const rows = await listTransactions({
      page: Number(query.page) > 0 ? Number(query.page) : 1,
      yearAccountId: query.yearAccountId,
      type: query.type,
      status: query.status,
      academicYear: selectedYear,
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
          ปีการศึกษา
          <select name="academicYear" defaultValue={selectedYear ?? ""} className={inputClass}>
            {(academicYears.ok ? academicYears.data : []).map((year) => <option key={year} value={year}>พ.ศ. {year}</option>)}
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
          <Pager meta={rows.meta} path="/transactions" query={{ ...query, academicYear: selectedYear ? String(selectedYear) : undefined }} />
        </div>
      ) : (
        <p role="alert" className="text-body-md text-error">
          โหลดรายการไม่สำเร็จ: {rows.message}
        </p>
      )}
    </div>
  );
}
