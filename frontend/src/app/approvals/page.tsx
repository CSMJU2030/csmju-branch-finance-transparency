import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PageHeader,
  StatusBadge,
  cardClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  tdClass,
  thClass,
} from "@/csmju";
import Flash from "@/components/Flash";
import ReSignIn from "@/components/ReSignIn";
import { isUnauthorized, listPending, listYearAccounts } from "@/lib/api";
import { formatCalendarDate } from "@/lib/format";
import { gate } from "@/lib/gate";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/labels";
import { formatBaht } from "@/lib/money";
import { approveTransaction, confirmIncome, rejectTransaction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "รออนุมัติ" };

/** The branch head and admins decide. Everyone else is sent home; the backend enforces it either way. */
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const session = await gate();
  if ("view" in session) return session.view;
  const { me } = session;
  if (!session.caps.canDecide) redirect("/");

  const years = await listYearAccounts(true);
  if (isUnauthorized(years)) return <ReSignIn />;
  const pending = await listPending();
  if (isUnauthorized(pending)) return <ReSignIn />;
  const yearNames = Object.fromEntries((years.ok ? years.data : []).map((year) => [year.id, `ชั้นปีที่ ${year.yearLevel}`]));

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <PageHeader
        title="รออนุมัติ"
        description="รายจ่ายรอตรวจและรายรับรอยืนยัน เรียงจากเก่าสุด — เปิดดูบิลก่อนตัดสินได้ที่หน้ารายการ"
      />
      <Flash ok={ok} error={error} />

      {!pending.ok ? (
        <p role="alert" className="text-body-md text-error">
          โหลดคิวไม่สำเร็จ: {pending.message}
        </p>
      ) : pending.data.length === 0 ? (
        <p className={`${cardClass} px-6 py-10 text-center text-body-md text-on-surface-variant`}>
          ไม่มีรายการที่รอการตัดสิน
        </p>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[52rem] text-left text-body-md">
            <thead className="bg-surface-container-low text-label-md text-on-surface-variant">
              <tr>
                <th className={thClass}>วันที่</th>
                <th className={thClass}>รายการ</th>
                <th className={thClass}>ชั้นปี</th>
                <th className={`${thClass} text-right`}>จำนวนเงิน</th>
                <th className={thClass}>ตัดสิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {pending.data.map((row) => {
                const own = row.createdByCoreUserId === me.id;
                const isIncome = row.type === "INCOME";
                const status = STATUS_LABEL[row.status];
                return (
                  <tr key={row.id} className="align-top">
                    <td className={`${tdClass} whitespace-nowrap`}>{formatCalendarDate(row.transactionDate)}</td>
                    <td className={tdClass}>
                      <Link href={`/transactions/${row.id}`} className="text-primary-container hover:underline">
                        {row.description}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-caption text-on-surface-variant">
                        {TYPE_LABEL[row.type]} <StatusBadge tone={status.tone} label={status.label} />
                      </div>
                      <div className="text-caption text-on-surface-variant">
                        ยื่นโดย {row.createdByPersonCode ?? "บัญชีเหรัญญิก"}
                      </div>
                    </td>
                    <td className={tdClass}>{yearNames[row.yearAccountId] ?? "—"}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>{formatBaht(row.amountSatang)}</td>
                    <td className={tdClass}>
                      {own ? (
                        <span className="text-caption text-on-surface-variant">รายการที่บัญชีคุณยื่นเอง — ตัดสินเองไม่ได้</span>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <form action={isIncome ? confirmIncome : approveTransaction}>
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="returnTo" value="/approvals" />
                            <button type="submit" className={primaryButtonClass}>
                              {isIncome ? "ยืนยันรายรับ" : "อนุมัติ"}
                            </button>
                          </form>
                          <form action={rejectTransaction} className="flex gap-2">
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="returnTo" value="/approvals" />
                            <input name="reason" required maxLength={500} placeholder="เหตุผลที่ไม่อนุมัติ" className={inputClass} />
                            <button type="submit" className={dangerButtonClass}>
                              ไม่อนุมัติ
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
