import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Thai } from "next/font/google";
import { CsmjuAppShell, type NavItem } from "@/csmju";
import { getMe, getMyOffices } from "@/lib/api";
import { capsOf, roleSummary } from "@/lib/caps";
import { ROLE_LABEL } from "@/lib/labels";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

// Keep in step with display_name in subsystem.yaml.
const DISPLAY_NAME = "ความโปร่งใสทางการเงินของสาขา";

// Core Hub web origin for the "กลับ CSMJU Portal" link — from .env, never hardcoded.
const CORE_HUB_WEB_URL = process.env.CORE_HUB_WEB_URL;

export const metadata: Metadata = {
  title: {
    template: `%s · ${DISPLAY_NAME} · CSMJU`,
    default: `${DISPLAY_NAME} · CSMJU`,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The identity the backend verified from the Core Hub token (cached per request, so
  // the page below does not ask twice). Without a session there is no shell: the page
  // itself shows the sign-in button or renews the session.
  const me = await getMe();

  let body = children;
  if (me.ok) {
    // Only students can hold an office; the lookup is cached, so gate() does not repeat it.
    const offices = await getMyOffices(me.data);
    const caps = capsOf(me.data, offices.ok ? offices.data : null);
    const nav: NavItem[] = [
      { label: "ภาพรวม", labelEn: "Overview", href: "/", icon: "dashboard" },
      { label: "รายการทั้งหมด", labelEn: "Transactions", href: "/transactions", icon: "receipt" },
      ...(caps.canFile
        ? [{ label: "ยื่นรายการ", labelEn: "File entry", href: "/entries", icon: "description" } satisfies NavItem]
        : []),
      ...(caps.canDecide
        ? [
            { label: "รออนุมัติ", labelEn: "Approvals", href: "/approvals", icon: "event" } satisfies NavItem,
            { label: "ประวัติการตรวจสอบ", labelEn: "Audit", href: "/audit-logs", icon: "menu-book" } satisfies NavItem,
          ]
        : []),
      ...(caps.canManageOffices
        ? [{ label: "ตำแหน่งในระบบ", labelEn: "Offices", href: "/officers", icon: "group" } satisfies NavItem]
        : []),
    ];
    body = (
      <CsmjuAppShell
        displayName={DISPLAY_NAME}
        nav={nav}
        user={{
          initials: (me.data.email || ROLE_LABEL[me.data.subsystemRole]).slice(0, 2).toUpperCase(),
          roleLabel: roleSummary(me.data, caps) || ROLE_LABEL[me.data.subsystemRole],
        }}
        coreHubUrl={CORE_HUB_WEB_URL}
      >
        {children}
      </CsmjuAppShell>
    );
  }

  return (
    <html lang="th" className={`${jakarta.variable} ${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-on-surface">{body}</body>
    </html>
  );
}
