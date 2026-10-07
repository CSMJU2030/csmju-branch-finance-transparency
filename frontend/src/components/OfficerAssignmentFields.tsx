"use client";

import { useState } from "react";
import { inputClass } from "@/csmju";
import { OFFICER_LABEL } from "@/lib/labels";

type YearAccount = { id: string; yearLevel: number; entryAcademicYearLabel: string | null };

export default function OfficerAssignmentFields({ canManageAllOffices, yearAccounts }: { canManageAllOffices: boolean; yearAccounts: YearAccount[] }) {
  const [role, setRole] = useState("TREASURER");
  return <>
    <label className="flex flex-col gap-1 text-label-md">
      ตำแหน่ง
      <select name="officerRole" required className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="TREASURER">{OFFICER_LABEL.TREASURER} (ประจำชั้นปี)</option>
        {canManageAllOffices && <option value="BRANCH_HEAD">{OFFICER_LABEL.BRANCH_HEAD}</option>}
      </select>
    </label>
    <label className="flex flex-col gap-1 text-label-md">
      ชั้นปีที่แต่งตั้งให้ดูแล
      <select name="yearAccountId" required className={inputClass} defaultValue={yearAccounts[0]?.id ?? ""}>
        <option value="">เลือกชั้นปีที่ดูแล</option>
        {yearAccounts.map((year) => <option key={year.id} value={year.id}>ชั้นปีที่ {year.yearLevel} · รุ่นปีแรกเข้า พ.ศ. {year.entryAcademicYearLabel ?? "—"}</option>)}
      </select>
      {role === "BRANCH_HEAD" && <span className="text-caption text-on-surface-variant">หัวหน้าสาขาดูแลเฉพาะชั้นปีที่แต่งตั้ง</span>}
      {!yearAccounts.length && <span className="text-caption text-error">ยังไม่มีบัญชีชั้นปีที่ใช้งานอยู่ กรุณาสร้างบัญชีชั้นปีก่อนแต่งตั้ง</span>}
    </label>
  </>;
}
