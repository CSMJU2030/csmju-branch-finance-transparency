import { redirect } from "next/navigation";
import { PageHeader, cardClass, inputClass, primaryButtonClass, tdClass, thClass } from "@/csmju";
import Pager from "@/components/Pager";
import ReSignIn from "@/components/ReSignIn";
import { isUnauthorized, listAuditLogs } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { gate } from "@/lib/gate";
import { AUDIT_ACTION_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "ประวัติการตรวจสอบ" };

type Query = { page?: string; action?: string; targetType?: string };

/** Append-only log of everything that changed: the database refuses to update or delete it. */
export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const session = await gate();
  if ("view" in session) return session.view;
  if (!session.caps.canDecide) redirect("/");

  const logs = await listAuditLogs({
    page: Number(query.page) > 0 ? Number(query.page) : 1,
    action: query.action,
    targetType: query.targetType,
  });
  if (isUnauthorized(logs)) return <ReSignIn />;

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <PageHeader
        title="ประวัติการตรวจสอบ"
        description="บันทึกทุกการเปลี่ยนแปลง ใครทำ ทำอะไร เมื่อไร — แก้หรือลบไม่ได้"
      />

      <form method="get" className={`${cardClass} flex flex-wrap items-end gap-4 p-4`}>
        <label className="flex flex-col gap-1 text-label-md">
          การกระทำ
          <select name="action" defaultValue={query.action ?? ""} className={inputClass}>
            <option value="">ทั้งหมด</option>
            {Object.entries(AUDIT_ACTION_LABEL).map(([action, label]) => (
              <option key={action} value={action}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={primaryButtonClass}>
          กรอง
        </button>
      </form>

      {!logs.ok ? (
        <p role="alert" className="text-body-md text-error">
          โหลดประวัติไม่สำเร็จ: {logs.message}
        </p>
      ) : (
        <div className="flex flex-col">
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full min-w-[44rem] text-left text-body-md">
              <thead className="bg-surface-container-low text-label-md text-on-surface-variant">
                <tr>
                  <th className={thClass}>เวลา</th>
                  <th className={thClass}>การกระทำ</th>
                  <th className={thClass}>โดย</th>
                  <th className={thClass}>รุ่น</th>
                  <th className={thClass}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {logs.data.map((log) => (
                  <tr key={log.id}>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(log.createdAt)}</td>
                    <td className={tdClass}>{AUDIT_ACTION_LABEL[log.action] ?? log.action}</td>
                    <td className={tdClass}>{log.actorPersonCode ?? log.actorCoreUserId ?? "ระบบ"}</td>
                    <td className={tdClass}>{log.yearAccount?.name ?? "—"}</td>
                    <td className={tdClass}>{log.metadataJson?.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.data.length === 0 && (
              <p className="px-6 py-10 text-center text-body-md text-on-surface-variant">ไม่พบบันทึก</p>
            )}
          </div>
          <Pager meta={logs.meta} path="/audit-logs" query={{ action: query.action, targetType: query.targetType }} />
        </div>
      )}
    </div>
  );
}
