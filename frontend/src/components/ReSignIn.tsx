"use client";

import { useEffect, useState } from "react";
import { cardClass, primaryButtonClass } from "@/csmju";
import { loginHref } from "@/lib/sign-in";

/**
 * Silent re-SSO (auth-contract.md 7). The session is a Core Hub token that lives 15
 * minutes; when the backend answers 401 this sends the whole page to
 * /auth/login?next=<this page>, Core Hub renews the sign-in without asking while
 * its own session lasts, and the browser is back here within a second.
 *
 * - A top-level navigation (`window.location`), never `fetch`: the way there is a
 *   chain of redirects through Core Hub's own origin, which fetch can neither follow
 *   nor carry Core Hub's cookies on.
 * - Loop guard: a 401 less than 30 s after this tab last left to renew means
 *   renewing does not help (cookies blocked, a clock far off ...), so the user gets
 *   a "sign in again" button instead of another round trip.
 * - `ask`: a form was just sent - ask before leaving instead of renewing on its own.
 */

/** When this tab last left to renew: a timestamp only, never a token (SEC-03). */
const RENEWED_AT_KEY = "csmju-sso-renewed-at";
const LOOP_GUARD_MS = 30_000;

/** Milliseconds since epoch, 0 when never, null when storage is blocked. */
function renewedAt(): number | null {
  try {
    const value = Number(window.sessionStorage.getItem(RENEWED_AT_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return null;
  }
}

function markRenewal(): boolean {
  try {
    window.sessionStorage.setItem(RENEWED_AT_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export default function ReSignIn({ next, ask = false }: { next?: string; ask?: boolean }) {
  const [asking, setAsking] = useState(ask);
  const [href, setHref] = useState(loginHref(next ?? "/"));

  useEffect(() => {
    const target = loginHref(next ?? `${window.location.pathname}${window.location.search}`);

    // Decided in a timer, not in the effect body: the result is state the browser owns
    // (sessionStorage, the address bar), and the cleanup makes React's double run in
    // development count as ONE renewal - the first run's timer is cancelled.
    const timer = window.setTimeout(() => {
      setHref(target);
      if (ask) return;

      const last = renewedAt();
      // Without storage the guard cannot work, so never renew on our own then.
      if (last === null || Date.now() - last < LOOP_GUARD_MS || !markRenewal()) {
        setAsking(true);
        return;
      }
      window.location.assign(target);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ask, next]);

  return (
    <section className={`${cardClass} mx-auto max-w-xl px-6 py-10 text-center`}>
      {asking ? (
        <>
          <h1 className="mb-2 font-display text-headline-md text-on-surface">เข้าสู่ระบบอีกครั้ง</h1>
          <p className="mb-6 text-body-md text-on-surface-variant">
            {ask
              ? "การเข้าสู่ระบบหมดอายุก่อนส่งข้อมูล — เข้าสู่ระบบอีกครั้ง แล้วส่งใหม่"
              : "ต่ออายุการเข้าสู่ระบบไม่สำเร็จ — ตรวจว่าเบราว์เซอร์รับคุกกี้ และเปิดระบบด้วย localhost ตรงกับที่ลงทะเบียน"}
          </p>
          <a className={`${primaryButtonClass} mx-auto w-fit`} href={href} onClick={() => markRenewal()}>
            เข้าสู่ระบบอีกครั้ง
          </a>
        </>
      ) : (
        <>
          <h1 className="mb-2 font-display text-headline-md text-on-surface">กำลังต่ออายุการเข้าสู่ระบบ…</h1>
          <p className="text-body-md text-on-surface-variant">กำลังผ่าน CSMJU Core Hub แล้วกลับมาที่หน้านี้</p>
          <noscript>
            <a className={`${primaryButtonClass} mx-auto mt-6 w-fit`} href={href}>
              เข้าสู่ระบบอีกครั้ง
            </a>
          </noscript>
        </>
      )}
    </section>
  );
}
