import { CsmjuLogo, cardClass, primaryButtonClass } from "@/csmju";
import { loginHref } from "@/lib/sign-in";

/**
 * What a visitor without a session sees. There is no login form here and there
 * never will be (auth-contract.md 9): the button is a plain link to this
 * subsystem's own /auth/login, which sends the browser on to Core Hub.
 */
export default function SignedOut({ reason }: { reason: string | null }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 px-4 py-10">
      <CsmjuLogo />
      <section className={`${cardClass} w-full px-6 py-8 text-center`}>
        <h1 className="mb-2 font-display text-headline-md text-on-surface">ระบบตรวจสอบและความโปร่งใสทางการเงินของสาขา</h1>
        <p className="mb-6 text-body-md text-on-surface-variant">
          เข้าสู่ระบบด้วยบัญชี CSMJU เดียวกับที่ใช้ใน CSMJU Core Hub ระบบนี้ไม่มีหน้า login ของตัวเอง
        </p>
        {reason && (
          <p role="alert" className="mb-6 rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container">
            {reason}
          </p>
        )}
        {/* a full navigation to the backend route, not next/link */}
        <a className={`${primaryButtonClass} mx-auto w-fit`} href={loginHref("/")}>
          เข้าสู่ระบบด้วยบัญชี CSMJU
        </a>
      </section>
    </main>
  );
}
