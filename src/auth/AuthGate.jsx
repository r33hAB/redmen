import React from "react";
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "../lib/firebase";

const REQUIRE = (import.meta.env.VITE_REQUIRE_AUTH ?? "true") !== "false";
// Optional: lock to a single email (comma-separated allowlist supported)
const ALLOWED = String(import.meta.env.VITE_ALLOWED_EMAILS || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

export default function AuthGate({ children }) {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState(null);
  const [denied, setDenied] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (!REQUIRE) { setReady(true); return; }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setUser(null); setDenied(false); setReady(true); return; }
      const ok = ALLOWED.length === 0 ? true : ALLOWED.includes((u.email||"").toLowerCase());
      if (!ok) { setDenied(true); setUser(null); try { await signOut(auth); } catch {} setReady(true); return; }
      setDenied(false); setUser(u); setReady(true);
    });
    return () => unsub && unsub();
  }, []);

  if (!REQUIRE) return <>{children}</>;
  if (!ready) return <div className="p-6">Loading…</div>;

  if (denied) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="max-w-sm w-full rounded-2xl shadow p-6">
          <h1 className="text-xl font-semibold mb-3">Access denied</h1>
          <p className="text-sm opacity-80 mb-4">This app is restricted to a specific account.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <form className="max-w-sm w-full rounded-2xl shadow p-6"
              onSubmit={async (e) => {
                e.preventDefault();
                setErr("");
                try { await signInWithEmailAndPassword(auth, email, pass); }
                catch (e) { setErr(e.message || "Sign-in failed"); }
              }}>
          <h1 className="text-xl font-semibold mb-3">Sign in</h1>
          <div className="text-sm opacity-80 mb-4">Use your authorized email.</div>
          <input placeholder="Email" type="email" value={email}
                 onChange={(e)=>setEmail(e.target.value)}
                 className="w-full mb-2 rounded-xl py-2 px-3"/>
          <input placeholder="Password" type="password" value={pass}
                 onChange={(e)=>setPass(e.target.value)}
                 className="w-full mb-2 rounded-xl py-2 px-3"/>
          {err && <div className="text-red-400 text-sm mb-2">{err}</div>}
          <button className="w-full rounded-xl py-2 px-3 shadow" type="submit">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="fixed top-2 right-2 text-sm opacity-70">
        {user.email} · <button onClick={() => signOut(auth)}>Sign out</button>
      </div>
      {children}
    </div>
  );
}
