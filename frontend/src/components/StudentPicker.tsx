"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BranchStudent } from "@/lib/api";
import { inputClass, primaryButtonClass } from "@/csmju";

export default function StudentPicker({
  students,
  academicYear,
  initialQuery = "",
}: {
  students: BranchStudent[];
  academicYear?: number;
  initialQuery?: string;
}) {
  const router = useRouter();
  const available = students.filter((student) => student.coreUserId !== null);
  const labelFor = (student: BranchStudent) => `${student.fullNameTh} · ${student.personCode}`;
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = available.find((student) =>
    value === labelFor(student) || value === student.personCode,
  );
  useEffect(() => {
    inputRef.current?.setCustomValidity(
      available.length > 0 && !selected ? "เลือกนักศึกษาจากผลการค้นหา" : "",
    );
  }, [available.length, selected]);
  const search = () => {
    const params = new URLSearchParams();
    if (academicYear) params.set("academicYear", String(academicYear));
    const searchTerm = selected?.personCode ?? value.trim();
    if (searchTerm) params.set("q", searchTerm);
    router.push(`/officers${params.size ? `?${params}` : ""}`);
  };

  return (
    <div className="flex flex-col gap-1 text-label-md lg:col-span-2">
      <label htmlFor="assignable-student-search">ค้นหาและเลือกนักศึกษาจาก Core Hub (ชื่อหรือรหัสนักศึกษา)</label>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id="assignable-student-search"
          type="search"
          list="assignable-students"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValue(nextValue);
            const isSelected = available.some(
              (student) => nextValue === labelFor(student) || nextValue === student.personCode,
            );
            event.currentTarget.setCustomValidity(
              available.length > 0 && !isSelected ? "เลือกนักศึกษาจากผลการค้นหา" : "",
            );
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
          required={available.length > 0}
          className={`${inputClass} min-w-0 flex-1`}
          placeholder="พิมพ์ชื่อหรือรหัส แล้วเลือกผลลัพธ์ หรือกด Enter เพื่อค้นหา"
          autoComplete="off"
        />
        <datalist id="assignable-students">
          {available.map((student) => (
            <option key={student.personCode} value={labelFor(student)} />
          ))}
        </datalist>
        <button type="button" className={primaryButtonClass} onClick={search}>ค้นหา</button>
      </div>
      {available.length > 0 && (
        <>
          <input type="hidden" name="coreUserId" value={selected?.coreUserId ?? ""} />
          <input type="hidden" name="personCode" value={selected?.personCode ?? ""} />
        </>
      )}
      <span className="text-caption text-on-surface-variant">
        {selected
          ? `เลือก ${selected.fullNameTh} · ${selected.personCode}`
          : "พิมพ์เพื่อค้นหาใน Core Hub แล้วเลือกชื่อในกล่องนี้ ระบบจะกรอกบัญชีและรหัสให้"}
      </span>
    </div>
  );
}
