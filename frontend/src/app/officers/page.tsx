import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, cardClass, dangerButtonClass, inputClass, primaryButtonClass, tdClass, thClass } from "@/csmju";
import Flash from "@/components/Flash";
import ReSignIn from "@/components/ReSignIn";
import { isUnauthorized, listAssignableStudents, listAssignableYearAccounts, listOfficers } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { gate } from "@/lib/gate";
import { OFFICER_LABEL } from "@/lib/labels";
import StudentPicker from "@/components/StudentPicker";
import AcademicYearFilter from "@/components/AcademicYearFilter";
import { grantOfficer, revokeOfficer } from "../actions";

const SUPPORTED_ENTRY_YEARS = [2569, 2568, 2567, 2566];

export const dynamic = "force-dynamic";
export const metadata = { title: "แต่งตั้งเจ้าหน้าที่" };

/**
 * Who holds which office. Treasurer and branch head are students who hold a role only this
 * system knows about (the Core Hub token says "student" and nothing more). An admin appoints
 * both; the branch head appoints and releases treasurers.
 */
export default async function OfficersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; page?: string; entryYear?: string }>;
}) {
  const { ok, error, q = "", page: pageValue, entryYear } = await searchParams;
  const page = Number(pageValue) > 0 ? Number(pageValue) : 1;
  const session = await gate();
  if ("view" in session) return session.view;
  const { caps } = session;
  if (!caps.canManageOffices) redirect("/");

  const [assignments, years] = await Promise.all([
    listOfficers(),
    listAssignableYearAccounts(),
  ]);
  if (isUnauthorized(assignments, years)) return <ReSignIn />;
  const requestedEntryYear = Number(entryYear);
  const selectedEntryYear = SUPPORTED_ENTRY_YEARS.includes(requestedEntryYear)
    ? requestedEntryYear
    : SUPPORTED_ENTRY_YEARS[0];
  const students = await listAssignableStudents({ q, page, entryYear: selectedEntryYear });
  if (isUnauthorized(students)) return <ReSignIn />;
  const yearNames = Object.fromEntries((years.ok ? years.data : []).map((year) => [year.id, `ชั้นปีที่ ${year.yearLevel}`]));
  // Entry year is only the Core Hub student-directory filter. A treasurer is
  // appointed to the active cohort/account, so do not couple the two values.
  const assignableYearAccounts = years.ok ? years.data : [];

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <PageHeader
        title="แต่งตั้งเจ้าหน้าที่"
        description="เลือกนักศึกษาจากรายชื่อปัจจุบันของ Core Hub เพื่อแต่งตั้งเหรัญญิกประจำชั้นปีหรือหัวหน้าสาขา"
      />
      <Flash ok={ok} error={error} />

      <section className={`${cardClass} flex flex-col gap-3 p-4`}>
        <div>
          <h2 className="text-label-md text-on-surface">เลือกปีแรกเข้า</h2>
          <p className="text-caption text-on-surface-variant">
            คัดรายชื่อตามปีการศึกษาแรกเข้าของนักศึกษาจาก Core Hub พ.ศ. {selectedEntryYear ?? "—"}
          </p>
        </div>
        <AcademicYearFilter years={SUPPORTED_ENTRY_YEARS} selectedYear={selectedEntryYear} />
        {!students.ok && (
          <p role="alert" className="text-body-md text-error">
            โหลดรายชื่อนักศึกษาไม่สำเร็จ: {students.message}
          </p>
        )}
        {students.ok && (
          <p className="text-caption text-on-surface-variant">
            พบ {students.data.meta.total} คน · หน้า {students.data.meta.page}/{Math.max(1, students.data.meta.totalPages)}
            {students.data.meta.totalPages > 1 && (
              <span className="ml-3 inline-flex gap-3">
                {page > 1 && <Link className="text-primary-container hover:underline" href={`/officers?${new URLSearchParams({ q, page: String(page - 1), entryYear: String(selectedEntryYear ?? "") })}`}>ก่อนหน้า</Link>}
                {page < students.data.meta.totalPages && <Link className="text-primary-container hover:underline" href={`/officers?${new URLSearchParams({ q, page: String(page + 1), entryYear: String(selectedEntryYear ?? "") })}`}>ถัดไป</Link>}
              </span>
            )}
          </p>
        )}
      </section>

      {!years.ok && (
        <p role="alert" className="text-body-md text-error">
          โหลดรายชื่อชั้นปีไม่สำเร็จ: {years.message}
        </p>
      )}

      <form action={grantOfficer} className={`${cardClass} grid gap-4 p-6 lg:grid-cols-2`}>
        <label className="flex flex-col gap-1 text-label-md">
          ตำแหน่ง
          <select name="officerRole" required className={inputClass} defaultValue="TREASURER">
            <option value="TREASURER">{OFFICER_LABEL.TREASURER} (ประจำชั้นปี)</option>
            {/* branch heads can appoint treasurers only; admins and staff may manage both roles */}
            {caps.canManageAllOffices && <option value="BRANCH_HEAD">{OFFICER_LABEL.BRANCH_HEAD}</option>}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label-md">
          ชั้นปีที่แต่งตั้งเหรัญญิก
          <select name="yearAccountId" className={inputClass} defaultValue={assignableYearAccounts[0]?.id ?? ""}>
            <option value="">เลือกชั้นปีที่รับผิดชอบ</option>
            {assignableYearAccounts.map((year) => (
              <option key={year.id} value={year.id}>
                ชั้นปีที่ {year.yearLevel} · รุ่นปีแรกเข้า พ.ศ. {year.entryAcademicYearLabel ?? "—"}
              </option>
            ))}
          </select>
          {!assignableYearAccounts.length && (
            <span className="text-caption text-error">ยังไม่มีบัญชีชั้นปีที่ใช้งานอยู่ กรุณาสร้างบัญชีชั้นปีก่อนแต่งตั้งเหรัญญิก</span>
          )}
        </label>
        {students.ok && (
          <StudentPicker students={students.data.items} entryYear={selectedEntryYear} initialQuery={q} />
        )}
        {(!students.ok || !students.data.items.some((student) => student.coreUserId)) && (
          <>
            <p className="text-body-sm text-on-surface-variant lg:col-span-2">
              หากค้นไม่พบรายชื่อที่ผูกบัญชี Core Hub สามารถระบุบัญชีและรหัสนักศึกษาเองได้
            </p>
            <label className="flex flex-col gap-1 text-label-md">
              รหัสบัญชี Core Hub (core_user_id)
              <input name="coreUserId" required maxLength={64} pattern="\S+" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-label-md">
              รหัสนักศึกษา
              <input name="personCode" maxLength={50} pattern="[A-Za-z0-9-]+" className={inputClass} />
            </label>
          </>
        )}
        <button type="submit" className={`${primaryButtonClass} w-fit lg:col-span-2`}>
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
                <th className={thClass}>ชั้นปี</th>
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
                    {/* branch heads can release treasurers only; backend permissions are authoritative */}
                    {(caps.canManageAllOffices || assignment.officerRole === "TREASURER") && (
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
