// App-wide state: the signed-in admin, company policy, people list, and hash routing.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, session, setOnSessionExpired } from "./core";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [me, setMe] = useState(() => (session.token && session.user?.role === "admin" ? session.user : null));
  const [policy, setPolicy] = useState(null);
  const [loginNote, setLoginNote] = useState("");
  const usersRef = useRef({ list: [], at: 0 });

  const signOut = useCallback((note = "") => {
    session.clear();
    usersRef.current = { list: [], at: 0 };
    setPolicy(null);
    setMe(null);
    setLoginNote(note);
    history.replaceState(null, "", location.pathname);
    if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => {});
  }, []);

  useEffect(() => setOnSessionExpired(() => signOut("Your session ended. Sign in again.")), [signOut]);

  const reloadPolicy = useCallback(async () => {
    try { const j = await api("/policy"); setPolicy(j.data); return j.data; } catch { return null; }
  }, []);

  // After sign-in (or on start with a stored session): load the policy and re-check the account
  useEffect(() => {
    if (!me) return;
    reloadPolicy();
    api("/auth/me").then((j) => {
      if (j.data?.role !== "admin") return signOut("This app is for admins only.");
      session.set(null, j.data);
      setMe(j.data);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?._id]);

  const signIn = async (email, password) => {
    const j = await api("/auth/login", { method: "POST", body: { email, password } });
    if (j.data?.role !== "admin") throw new Error("This app is for admins only. Please use the main site.");
    session.set(j.token, j.data);
    setLoginNote("");
    setMe(j.data);
  };

  // People list, cached for 5 minutes
  const loadUsers = useCallback(async (force = false) => {
    const c = usersRef.current;
    if (!force && c.list.length && Date.now() - c.at < 5 * 60000) return c.list;
    const j = await api("/attendance-app/users");
    usersRef.current = { list: j.data || [], at: Date.now() };
    return usersRef.current.list;
  }, []);
  const invalidateUsers = useCallback(() => { usersRef.current.at = 0; }, []);

  const leaveTypes = policy?.leave_types || [];
  const lateAfterMin = policy
    ? (Number(policy.work_start_time?.split(":")[0] ?? 9) * 60 + Number(policy.work_start_time?.split(":")[1] ?? 0)) + (policy.late_threshold_minutes ?? 15)
    : 9 * 60 + 15;

  return (
    <AppCtx.Provider value={{ me, signIn, signOut, loginNote, policy, reloadPolicy, leaveTypes, lateAfterMin, loadUsers, invalidateUsers }}>
      {children}
    </AppCtx.Provider>
  );
}

// "#employee/123" → { page: "employee", arg: "123" }
export function useRoute() {
  const read = () => {
    const [page, arg] = location.hash.replace(/^#/, "").split("/");
    return { page: page || "today", arg: arg || null };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo({ top: 0 }); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return route;
}
export const go = (hash) => { location.hash = hash; };
