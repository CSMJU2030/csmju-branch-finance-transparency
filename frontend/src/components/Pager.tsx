import Link from "next/link";
import { secondaryButtonClass } from "@/csmju";
import type { PageMeta } from "@/lib/api";

/** Previous / next links that keep the other query parameters (the filters). */
export default function Pager({
  meta,
  path,
  query,
}: {
  meta: PageMeta | undefined;
  path: string;
  query: Record<string, string | undefined>;
}) {
  if (!meta || meta.totalPages <= 1) return null;

  const href = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    params.set("page", String(page));
    return `${path}?${params.toString()}`;
  };

  return (
    <nav aria-label="เลือกหน้า" className="flex items-center justify-between gap-4 px-6 py-4 text-body-md text-on-surface-variant">
      <span>
        หน้า {meta.page} / {meta.totalPages} · ทั้งหมด {meta.total} รายการ
      </span>
      <span className="flex gap-2">
        {meta.page > 1 && (
          <Link className={secondaryButtonClass} href={href(meta.page - 1)}>
            ก่อนหน้า
          </Link>
        )}
        {meta.page < meta.totalPages && (
          <Link className={secondaryButtonClass} href={href(meta.page + 1)}>
            ถัดไป
          </Link>
        )}
      </span>
    </nav>
  );
}
