import type { ReactElement } from "react";
import ReSignIn from "@/components/ReSignIn";
import SignedOut from "@/components/SignedOut";
import { getMe, getMyOffices, hasSession, type Me } from "./api";
import { capsOf, type Caps } from "./caps";

/**
 * The first thing every page does: who is this, and what may they do? Either the verified
 * identity with its capabilities, or the view to show instead - a renewal for a session that
 * ended, the sign-in page for a visitor who never had one (or the reason, when the backend
 * itself is down).
 */
export async function gate(): Promise<{ me: Me; caps: Caps } | { view: ReactElement }> {
  const me = await getMe();
  if (!me.ok) {
    // A session that ended renews itself; a visitor who never signed in gets the button.
    if (me.status === 401 && (await hasSession())) return { view: <ReSignIn /> };
    return { view: <SignedOut reason={me.status === 401 ? null : me.message} /> };
  }

  const offices = await getMyOffices(me.data);
  if (!offices.ok && offices.status === 401) return { view: <ReSignIn /> };
  // If the offices cannot be loaded the person is shown as holding none: the safe reading.
  return { me: me.data, caps: capsOf(me.data, offices.ok ? offices.data : null) };
}
