import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";

/**
 * Server-only client for this subsystem's own backend. The browser never calls the
 * backend with a token of its own: pages and server actions forward the HttpOnly
 * SSO cookie, and the backend verifies it against the Core Hub JWKS on every
 * request (auth-contract.md 6). Nothing here ever reaches the browser's JavaScript.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:4210";

/**
 * The session cookie the backend sets at /auth/callback: `<SUBSYSTEM_ID>_access_token`
 * with `-` as `_` (auth-contract.md 5.1). HttpOnly - only this server reads it.
 */
export const SSO_COOKIE = `${(process.env.SUBSYSTEM_ID ?? "csmju-branch-finance-transparency").replace(/-/g, "_")}_access_token`;

// ---------------------------------------------------------------------------
// Types of the backend's API. TODO(API-01): generate from backend/openapi.json once
// the backend exports it (tech-stack.md 3).
// ---------------------------------------------------------------------------

export type SubsystemRole = "STUDENT" | "LECTURER" | "ADMIN" | "STAFF" | "ALUMNI";
export type TransactionType = "INCOME" | "EXPENSE" | "ADJUSTMENT";
export type TransactionStatus = "PENDING" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "VOIDED" | "CANCELLED";

export type Me = {
  id: string;
  email: string;
  coreRole: string;
  subsystemRole: SubsystemRole;
  session: { expiresAt: string | null };
};

export type YearAccountListItem = {
  id: string;
  yearLevel: number;
  name: string;
  entryAcademicYearLabel: string | null;
  currency: string;
  active: boolean;
};

export type AssignableYearAccount = Pick<YearAccountListItem, "id" | "yearLevel" | "name" | "entryAcademicYearLabel">;

export type AcademicYearOption = { academicYear: number };

export type CurrentAcademicTerm = { academicYear: number };

export type BranchStudent = {
  personCode: string;
  fullNameTh: string;
  fullNameEn: string | null;
  coreUserId: string | null;
  entryYear: number | null;
};

export type BranchStudentPage = {
  items: BranchStudent[];
  meta: PageMeta;
};

export type YearSummary = {
  yearAccountId: string;
  yearLevel: number;
  name: string;
  currency: string;
  active: boolean;
  openingBalanceSatang: number;
  approvedIncomeSatang: number;
  approvedExpenseSatang: number;
  balanceSatang: number;
  pendingExpenseTotalSatang: number;
  periods: Array<{
    academicYear: string;
    yearLevel: number;
    startedAt: string;
    endedAt: string | null;
    closingBalanceSatang: number | null;
  }>;
};

export type Transaction = {
  id: string;
  yearAccountId: string;
  type: TransactionType;
  status: TransactionStatus;
  /** Integer satang - 12550 is 125.50 baht. */
  amountSatang: number;
  /** A calendar date, "2026-10-05T00:00:00.000Z". */
  transactionDate: string;
  description: string;
  category: string | null;
  createdByCoreUserId: string;
  /** Core Hub person code of the creator. */
  createdByPersonCode: string | null;
  approvedByCoreUserId: string | null;
  approvedByPersonCode: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type Evidence = {
  id: string;
  transactionId: string;
  /** IMAGE: a Core Hub image. PDF: kept by this subsystem and served behind the session cookie. */
  kind: "IMAGE" | "PDF";
  imageId: string | null;
  /** IMAGE: Core Hub's public file URL (usable as <img src>). PDF: this site's /api/v1/evidence/:id/file. */
  url: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isCurrent: boolean;
  uploadedAt: string;
};

export type AuditLog = {
  id: string;
  actorCoreUserId: string | null;
  actorPersonCode: string | null;
  action: string;
  targetType: string;
  targetId: string;
  yearAccountId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  metadataJson: { reason?: string } | null;
  createdAt: string;
  yearAccount: { id: string; name: string; yearLevel: number } | null;
};

export type OfficerRole = "TREASURER" | "BRANCH_HEAD";

/** A Layer 2 office: a student holds it inside this subsystem (the token cannot say so). */
export type OfficerAssignment = {
  id: string;
  coreUserId: string;
  personCode: string | null;
  officerRole: OfficerRole;
  /** The cohort/year this officer is appointed to care for. */
  yearAccountId: string;
  activeFrom: string;
  activeTo: string | null;
};

export type Offices = {
  isBranchHead: boolean;
  treasurerYearAccountIds: string[];
  assignments: OfficerAssignment[];
};

export type PageMeta = { total: number; page: number; limit: number; totalPages: number };

type Envelope<T> =
  | { success: true; data: T; meta?: PageMeta }
  | { success: false; error: { code: string; message: string } };

export type ApiResult<T> =
  | { ok: true; data: T; meta?: PageMeta }
  | { ok: false; status: number; message: string };

/**
 * The backend answered 401: no session, or one that ended (expired, or Core Hub
 * signed the user out). The page then renders <ReSignIn />.
 */
export const isUnauthorized = (...results: ApiResult<unknown>[]) =>
  results.some((result) => !result.ok && result.status === 401);

/** Whether this browser has a session cookie at all - a first visit has none. */
export async function hasSession(): Promise<boolean> {
  return (await cookies()).has(SSO_COOKIE);
}

export { capsOf, roleSummary, type Caps } from "./caps";
export async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<ApiResult<T>> {
  const token = (await cookies()).get(SSO_COOKIE)?.value;
  if (!token) return { ok: false, status: 401, message: "ยังไม่ได้เข้าสู่ระบบ" };

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Cookie: `${SSO_COOKIE}=${encodeURIComponent(token)}`,
        // multipart: fetch sets the boundary itself, so no Content-Type here
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 503, message: "เชื่อมต่อ backend ของระบบย่อยไม่ได้" };
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (res.ok && body?.success) return { ok: true, data: body.data, meta: body.meta };
  return {
    ok: false,
    status: res.status,
    message: body && !body.success ? body.error.message : `HTTP ${res.status}`,
  };
}

/** GET /api/v1/me - the identity the backend verified from the Core Hub token (once per request). */
export const getMe = cache(() => call<Me>("/api/v1/me"));

/**
 * The offices the caller holds. Only students can hold one, so nobody else is asked
 * (an admin or a lecturer would just get a 403).
 */
export const getMyOffices = cache(async (me: Me): Promise<ApiResult<Offices | null>> => {
  if (me.subsystemRole !== "STUDENT") return { ok: true, data: null };
  return call<Offices>("/api/v1/officer-assignments/me");
});

export const listYearAccounts = cache((includeArchived: boolean) =>
  call<YearAccountListItem[]>(`/api/v1/year-accounts${includeArchived ? "?includeArchived=true" : ""}`),
);

export const getYearSummary = (id: string, academicYear?: number) =>
  call<YearSummary>(`/api/v1/year-accounts/${encodeURIComponent(id)}/summary${academicYear ? `?academicYear=${academicYear}` : ""}`);

export type TransactionQuery = {
  page?: number;
  limit?: number;
  yearAccountId?: string;
  type?: string;
  status?: string;
  mine?: boolean;
  academicYear?: number;
};

export function listTransactions(query: TransactionQuery) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  if (query.yearAccountId) params.set("yearAccountId", query.yearAccountId);
  if (query.type) params.set("type", query.type);
  if (query.status) params.set("status", query.status);
  if (query.mine) params.set("mine", "true");
  if (query.academicYear) params.set("academicYear", String(query.academicYear));
  return call<Transaction[]>(`/api/v1/transactions?${params.toString()}`);
}

export const getTransaction = (id: string) => call<Transaction>(`/api/v1/transactions/${encodeURIComponent(id)}`);
export const listEvidence = (id: string) => call<Evidence[]>(`/api/v1/transactions/${encodeURIComponent(id)}/evidence`);
export const getAuditTrail = (id: string) => call<AuditLog[]>(`/api/v1/transactions/${encodeURIComponent(id)}/audit`);
export const listPending = (academicYear?: number) =>
  call<Transaction[]>(`/api/v1/approvals/pending${academicYear ? `?academicYear=${academicYear}` : ""}`);

export function listAuditLogs(query: { page?: number; action?: string; targetType?: string; yearAccountId?: string }) {
  const params = new URLSearchParams({ page: String(query.page ?? 1), limit: "30" });
  if (query.action) params.set("action", query.action);
  if (query.targetType) params.set("targetType", query.targetType);
  if (query.yearAccountId) params.set("yearAccountId", query.yearAccountId);
  return call<AuditLog[]>(`/api/v1/audit-logs?${params.toString()}`);
}

export const listOfficers = () => call<OfficerAssignment[]>("/api/v1/officer-assignments?active=true&limit=100");
export const listAssignableYearAccounts = () => call<AssignableYearAccount[]>("/api/v1/officer-assignments/year-accounts");

export const getCurrentAcademicTerm = cache(() =>
  call<CurrentAcademicTerm | null>("/api/v1/core-hub/academic-terms/current"),
);

export const getRecentAcademicYears = cache(() =>
  call<number[]>("/api/v1/core-hub/academic-years"),
);

export const getAssignableEntryYears = cache(() =>
  call<number[]>("/api/v1/officer-assignments/entry-years"),
);

/** Personal directory results are always requested with no-store and never memoized. */
export function listAssignableStudents(query: { q?: string; page?: number; entryYear?: number }) {
  const params = new URLSearchParams({ page: String(query.page ?? 1) });
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.entryYear !== undefined) params.set("entryYear", String(query.entryYear));
  return call<BranchStudentPage>(`/api/v1/officer-assignments/students?${params.toString()}`);
}

/** GET /api/health - public. */
export async function getHealth(): Promise<{ status: string; service?: string } | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { cache: "no-store" });
    const body = (await res.json()) as Envelope<{ status: string; service?: string }>;
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}
