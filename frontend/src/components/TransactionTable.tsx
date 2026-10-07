import Link from "next/link";
import { StatusBadge, cardClass, tdClass, thClass } from "@/csmju";
import type { Transaction } from "@/lib/api";
import { formatCalendarDate } from "@/lib/format";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/labels";
import { formatBaht } from "@/lib/money";

/** The list every page shows: date, what, which cohort, how much, and its state. */
export default function TransactionTable({
  rows,
  yearNames,
  empty = "ยังไม่มีรายการ",
}: {
  rows: Transaction[];
  yearNames: Record<string, string>;
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-6 py-10 text-center text-body-md text-on-surface-variant">{empty}</p>;
  }

  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className="w-full min-w-[44rem] text-left text-body-md">
        <thead className="bg-surface-container-low text-label-md text-on-surface-variant">
          <tr>
            <th className={thClass}>วันที่</th>
            <th className={thClass}>รายการ</th>
            <th className={thClass}>ชั้นปี</th>
            <th className={`${thClass} text-right`}>จำนวนเงิน</th>
            <th className={thClass}>สถานะ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/40">
          {rows.map((row) => {
            const status = STATUS_LABEL[row.status];
            return (
              <tr key={row.id} className="hover:bg-surface-container-low/60">
                <td className={`${tdClass} whitespace-nowrap`}>{formatCalendarDate(row.transactionDate)}</td>
                <td className={tdClass}>
                  <Link href={`/transactions/${row.id}`} className="text-primary-container hover:underline">
                    {row.description}
                  </Link>
                  <div className="text-caption text-on-surface-variant">
                    {TYPE_LABEL[row.type]}
                    {row.category ? ` · ${row.category}` : ""}
                  </div>
                </td>
                <td className={tdClass}>{yearNames[row.yearAccountId] ?? "—"}</td>
                <td
                  className={`${tdClass} whitespace-nowrap text-right tabular-nums ${
                    row.type === "INCOME" ? "text-emerald-700" : ""
                  }`}
                >
                  {row.type === "INCOME" ? "+" : row.type === "EXPENSE" ? "−" : ""}
                  {formatBaht(row.amountSatang)}
                </td>
                <td className={tdClass}>
                  <StatusBadge tone={status.tone} label={status.label} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
