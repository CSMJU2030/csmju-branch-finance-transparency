import type { StatusTone } from "@/csmju";
import type { SubsystemRole, TransactionStatus, TransactionType } from "./api";

export const STATUS_LABEL: Record<TransactionStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: "รอตรวจสอบ", tone: "warning" },
  NEEDS_REVIEW: { label: "รอยืนยัน", tone: "warning" },
  APPROVED: { label: "อนุมัติแล้ว", tone: "success" },
  REJECTED: { label: "ไม่อนุมัติ", tone: "error" },
  VOIDED: { label: "ยกเลิกรายการ", tone: "neutral" },
  CANCELLED: { label: "ถอนคำขอ", tone: "neutral" },
};

export const TYPE_LABEL: Record<TransactionType, string> = {
  INCOME: "รายรับ",
  EXPENSE: "รายจ่าย",
  ADJUSTMENT: "ปรับปรุงยอด",
};

export const ROLE_LABEL: Record<SubsystemRole, string> = {
  STUDENT: "นักศึกษา",
  LECTURER: "อาจารย์",
  STAFF: "บุคลากร",
  ADMIN: "ผู้ดูแลระบบ",
  ALUMNI: "ศิษย์เก่า",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  EXPENSE_CREATED: "ยื่นรายจ่าย",
  EXPENSE_UPDATED: "แก้ไขรายจ่าย",
  EXPENSE_CANCELLED: "ถอนคำขอรายจ่าย",
  INCOME_CREATED: "บันทึกรายรับ",
  INCOME_UPDATED: "แก้ไขรายรับ",
  INCOME_CANCELLED: "ถอนรายการรายรับ",
  UPLOAD_BILL: "แนบบิล",
  TRANSACTION_APPROVED: "อนุมัติ",
  INCOME_CONFIRMED: "ยืนยันรายรับ",
  TRANSACTION_REJECTED: "ไม่อนุมัติ",
  VOID_TRANSACTION: "ยกเลิกรายการที่อนุมัติแล้ว",
  ADVANCE_ACADEMIC_YEAR: "ปิดปีการศึกษา",
  OFFICER_GRANTED: "แต่งตั้งตำแหน่ง",
  OFFICER_REVOKED: "ปลดตำแหน่ง",
};

/**
 * What to tell the user when the backend refused. The status decides the headline;
 * a 400 or 409 also carries the backend's own sentence because it says what to fix
 * ("This expense has no bill attached ..."). Never a stack trace, never raw JSON.
 */
export function describeError(status: number, message: string): string {
  switch (status) {
    case 400:
      return `ข้อมูลไม่ถูกต้อง: ${message}`;
    case 401:
      return "การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
    case 403:
      return "คุณไม่มีสิทธิ์ทำรายการนี้";
    case 404:
      return "ไม่พบข้อมูลที่ต้องการ";
    case 409:
      return `ทำรายการไม่ได้ในสถานะปัจจุบัน: ${message}`;
    case 503:
      return "เชื่อมต่อบริการที่เกี่ยวข้องไม่ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";
    default:
      return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
  }
}

export const OFFICER_LABEL = {
  TREASURER: "เหรัญญิก",
  BRANCH_HEAD: "หัวหน้าสาขา",
} as const;
