"use client";

import { useRouter } from "next/navigation";
import { inputClass } from "@/csmju";

export default function AcademicYearFilter({
  years,
  selectedYear,
}: {
  years: number[];
  selectedYear?: number;
}) {
  const router = useRouter();

  return (
    <label className="flex flex-col gap-1 text-label-md">
      ปีการศึกษาแรกเข้า
      <select
        value={selectedYear ?? ""}
        className={inputClass}
        onChange={(event) => {
          const year = event.target.value;
          router.push(year ? `/officers?academicYear=${encodeURIComponent(year)}` : "/officers");
        }}
      >
        {years.map((year) => (
          <option key={year} value={year}>พ.ศ. {year}</option>
        ))}
      </select>
    </label>
  );
}
