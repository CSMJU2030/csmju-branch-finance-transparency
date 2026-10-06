import { redirect } from "next/navigation";
import { PageHeader, cardClass, dangerButtonClass, inputClass, primaryButtonClass, tdClass, thClass } from "@/csmju";
import Flash from "@/components/Flash";
import ReSignIn from "@/components/ReSignIn";
import { isUnauthorized, listOfficers, listYearAccounts } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { gate } from "@/lib/gate";
import { OFFICER_LABEL } from "@/lib/labels";
import { grantOfficer, revokeOfficer } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตำแหน่งในระบบ" };

/**
 * Who holds which office. Treasurer and branch head are students who hold a role only this
 * system knows about (the Core Hub token says "student" and nothing more). An admin appoints
 * both; the branch head appoints and releases treasurers.
 */
export default async function OfficersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const session = await gate();
  if ("view" in session) return session.view;
  const { caps } = session;
  if (!caps.canManageOffices) redirect("/");

  const [assignments, years] = await Promise.all([listOfficers(), listYearAccounts(false)]);
  if (isUnauthorized(assignments, years)) return <ReSignIn />;
  const yearNames = Object.fromEntries((years.ok ? years.data : []).map((year) => [year.id, year.name]));

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <PageHeader
        title="ตำแหน่งในระบบ"
        description="เหรัญญิกประจำรุ่น (ยื่นรายรับ-รายจ่าย) และหัวหน้าสาขา (ตัดสินรายการ) — คนเดียวถือได้ตำแหน่งเดียว และแต่งตั้งตัวเองไม่ได้"
      />
      <Flash ok={ok} error={error} />

      <form action={grantOfficer} className={`${cardClass} grid gap-4 p-6 md:grid-cols-2`}>
        <label className="flex flex-col gap-1 text-label-md">
          ตำแหน่ง
          <select name="officerRole" required className={inputClass} defaultValue="TREASURER">
            <option value="TREASURER">{OFFICER_LABEL.TREASURER} (ประจำรุ่น)</option>
            {/* only an admin appoints a branch head; the backend refuses it for anyone else */}
            {caps.isAdmin && <option value="BRANCH_HEAD">{OFFICER_LABEL.BRANCH_HEAD}</option>}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label-md">
          รุ่น (เฉพาะเหรัญญิก)
          <select name="yearAccountId" className={inputClass}>
            {(years.ok ? years.data : []).map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label-md">
          รหัสบัญชี Core Hub (core_user_id)
          <input name="coreUserId" required maxLength={64} pattern="\S+" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-label-md">
          รหัสนักศึกษา (ไม่บังคับ)
          <input name="personCode" maxLength={50} pattern="[A-Za-z0-9-]+" className={inputClass} />
        </label>
        <button type="submit" className={`${primaryButtonClass} w-fit md:col-span-2`}>
          แต่งตั้ง
        </button>
      </form>

      {!assignments.ok ? (
        <p role="alert" className="text-body-md text-error">
          โหลดรายชื่อไม่สำเร็จ: {assignments.message}
        </p>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[44rem] text-left text-body-md">
            <thead className="bg-surface-container-low text-label-md text-on-surface-variant">
              <tr>
                <th className={thClass}>ตำแหน่ง</th>
                <th className={thClass}>รุ่น</th>
                <th className={thClass}>บัญชี</th>
                <th className={thClass}>รหัสนักศึกษา</th>
                <th className={thClass}>ตั้งแต่</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {assignments.data.map((assignment) => (
                <tr key={assignment.id}>
                  <td className={tdClass}>{OFFICER_LABEL[assignment.officerRole]}</td>
                  <td className={tdClass}>{assignment.yearAccountId ? (yearNames[assignment.yearAccountId] ?? "—") : "ทั้งสาขา"}</td>
                  <td className={`${tdClass} font-mono text-caption`}>{assignment.coreUserId}</td>
                  <td className={tdClass}>{assignment.personCode ?? "—"}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(assignment.activeFrom)}</td>
                  <td className={tdClass}>
                    {/* the branch head can release treasurers only; the backend enforces it too */}
                    {(caps.isAdmin || assignment.officerRole === "TREASURER") && (
                      <form action={revokeOfficer}>
                        <input type="hidden" name="id" value={assignment.id} />
                        <button type="submit" className={dangerButtonClass}>
                          ปลด
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignments.data.length === 0 && (
            <p className="px-6 py-10 text-center text-body-md text-on-surface-variant">ยังไม่มีผู้ได้รับแต่งตั้ง</p>
          )}
        </div>
      )}
    </div>
  );
}
