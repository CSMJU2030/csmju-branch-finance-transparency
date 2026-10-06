"use server";

import { redirect } from "next/navigation";
import { call } from "@/lib/api";
import { describeError } from "@/lib/labels";
import { parseBahtToSatang } from "@/lib/money";

/**
 * Form actions. Each forwards the SSO cookie to the backend, which checks the
 * permission itself - hiding a button on a page is only a convenience. The result
 * comes back to the page as ?ok= / ?error=, so no client JavaScript is needed.
 *
 * Money is converted from baht to integer satang here and nowhere else.
 */

type Failure = { ok: false; status: number; message: string };
type Result = { ok: true } | Failure;

const INVALID_AMOUNT = "จำนวนเงินไม่ถูกต้อง — กรอกเป็นบาท เช่น 1,250.50 (ทศนิยมไม่เกิน 2 ตำแหน่ง และไม่เกิน 20,000,000 บาท)";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** A `returnTo` that is a path of this site, or the fallback. */
function sitePath(value: string, fallback: string): string {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback;
}

function withParams(path: string, params: Record<string, string>): string {
  return `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams(params).toString()}`;
}

function fail(path: string, message: string): never {
  redirect(withParams(path, { error: message }));
}

/**
 * The backend answered 401 to a form: the session ended (or Core Hub signed the user
 * out). An action cannot navigate the top-level page to /auth/login, so /signin-again
 * asks the user and does it (auth-contract.md 7), then returns to the form's page.
 */
function signInAgain(path: string): never {
  const page = withParams(path, { error: "การเข้าสู่ระบบหมดอายุ กรุณาส่งอีกครั้ง" });
  redirect(`/signin-again?${new URLSearchParams({ next: page })}`);
}

function back(path: string, result: Result, ok: string): never {
  if (!result.ok && result.status === 401) signInAgain(path);
  if (!result.ok) fail(path, describeError(result.status, result.message));
  redirect(withParams(path, { ok }));
}

// ---------------------------------------------------------------------------
// Treasurer: files expenses and income, attaches the evidence
// ---------------------------------------------------------------------------

async function createEntry(formData: FormData, kind: "expense" | "income") {
  const amountSatang = parseBahtToSatang(text(formData, "amount"));
  if (amountSatang === null) fail("/entries", INVALID_AMOUNT);

  const category = text(formData, "category");
  const result = await call<{ id: string }>(kind === "expense" ? "/api/v1/expenses" : "/api/v1/incomes", {
    method: "POST",
    body: {
      yearAccountId: text(formData, "yearAccountId"),
      amountSatang,
      transactionDate: text(formData, "transactionDate"),
      description: text(formData, "description"),
      ...(category ? { category } : {}),
    },
  });

  if (result.ok) {
    // The evidence comes next: nothing is approved or confirmed without a bill.
    const done = kind === "expense" ? "ยื่นรายจ่ายแล้ว" : "บันทึกรายรับแล้ว";
    redirect(withParams(`/transactions/${result.data.id}`, { ok: `${done} — แนบหลักฐานเพื่อให้ตรวจสอบได้` }));
  }
  back("/entries", result, "");
}

export async function createExpense(formData: FormData) {
  await createEntry(formData, "expense");
}

export async function createIncome(formData: FormData) {
  await createEntry(formData, "income");
}

export async function updateTransaction(formData: FormData) {
  const id = text(formData, "id");
  const page = `/transactions/${encodeURIComponent(id)}`;

  const amount = text(formData, "amount");
  const amountSatang = amount ? parseBahtToSatang(amount) : undefined;
  if (amountSatang === null) fail(page, INVALID_AMOUNT);

  const category = text(formData, "category");
  const result = await call(`/api/v1/transactions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: {
      ...(amountSatang !== undefined ? { amountSatang } : {}),
      ...(text(formData, "transactionDate") ? { transactionDate: text(formData, "transactionDate") } : {}),
      ...(text(formData, "description") ? { description: text(formData, "description") } : {}),
      ...(category ? { category } : {}),
    },
  });
  back(page, result, "บันทึกการแก้ไขแล้ว");
}

export async function cancelTransaction(formData: FormData) {
  const id = text(formData, "id");
  const reason = text(formData, "reason");
  const page = `/transactions/${encodeURIComponent(id)}`;
  if (!reason) fail(page, "กรุณาระบุเหตุผลที่ถอนรายการ");

  const result = await call(`/api/v1/transactions/${encodeURIComponent(id)}/cancel`, { method: "PATCH", body: { reason } });
  back(page, result, "ถอนรายการแล้ว");
}

export async function uploadBill(formData: FormData) {
  const id = text(formData, "id");
  const page = `/transactions/${encodeURIComponent(id)}`;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) fail(page, "กรุณาเลือกไฟล์หลักฐาน (PDF, JPEG, PNG หรือ WebP)");

  const form = new FormData();
  form.append("file", file, file.name);
  const result = await call(`/api/v1/transactions/${encodeURIComponent(id)}/evidence`, { method: "POST", form });
  back(page, result, "แนบหลักฐานแล้ว");
}

// ---------------------------------------------------------------------------
// Deciders (branch head, admin)
// ---------------------------------------------------------------------------

async function decide(formData: FormData, action: "approve" | "confirm-income" | "reject" | "void", done: string) {
  const id = text(formData, "id");
  const returnTo = sitePath(text(formData, "returnTo"), `/transactions/${encodeURIComponent(id)}`);
  const reason = text(formData, "reason");

  if ((action === "reject" || action === "void") && !reason) fail(returnTo, "กรุณาระบุเหตุผล");

  const result = await call(`/api/v1/transactions/${encodeURIComponent(id)}/${action}`, {
    method: "PATCH",
    body: action === "reject" || action === "void" ? { reason } : undefined,
  });
  back(returnTo, result, done);
}

export async function approveTransaction(formData: FormData) {
  await decide(formData, "approve", "อนุมัติแล้ว");
}

export async function confirmIncome(formData: FormData) {
  await decide(formData, "confirm-income", "ยืนยันรายรับแล้ว");
}

export async function rejectTransaction(formData: FormData) {
  await decide(formData, "reject", "บันทึกการไม่อนุมัติแล้ว");
}

export async function voidTransaction(formData: FormData) {
  await decide(formData, "void", "ยกเลิกรายการที่อนุมัติแล้ว");
}

// ---------------------------------------------------------------------------
// Offices
// ---------------------------------------------------------------------------

export async function grantOfficer(formData: FormData) {
  const officerRole = text(formData, "officerRole");
  const personCode = text(formData, "personCode");
  const yearAccountId = text(formData, "yearAccountId");
  const result = await call("/api/v1/officer-assignments", {
    method: "POST",
    body: {
      coreUserId: text(formData, "coreUserId"),
      officerRole,
      ...(officerRole === "TREASURER" && yearAccountId ? { yearAccountId } : {}),
      ...(personCode ? { personCode } : {}),
    },
  });
  back("/officers", result, "แต่งตั้งแล้ว");
}

export async function revokeOfficer(formData: FormData) {
  const result = await call(`/api/v1/officer-assignments/${encodeURIComponent(text(formData, "id"))}/revoke`, {
    method: "PATCH",
  });
  back("/officers", result, "ปลดออกจากตำแหน่งแล้ว");
}

export async function advanceAcademicYear(formData: FormData) {
  if (text(formData, "confirm") !== "yes") fail("/", "ติ๊กยืนยันก่อน — การปิดปีการศึกษาย้อนกลับไม่ได้");

  const result = await call("/api/v1/year-accounts/advance-academic-year", {
    method: "POST",
    body: { newAcademicYear: text(formData, "newAcademicYear") },
  });
  back("/", result, "ปิดปีการศึกษาและเลื่อนชั้นแล้ว");
}
