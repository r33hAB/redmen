import { useEffect, useState } from "react";
import { auth } from "./lib/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

export default function ProtectedApp({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoaded(true); }), []);

  if (!loaded) return null;
  const isAdmin = user && ADMIN_EMAILS.includes((user.email || "").toLowerCase());
  if (!isAdmin) return <Login err={err} setErr={setErr} />;
  return (
    <div>
      <button onClick={() => signOut(auth)} className="fixed top-2 right-2 px-3 py-1 rounded">
        Sign out
      </button>
      {children}
    </div>
  );
}

function Login({ err, setErr }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  async function go(e) {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, pw); }
    catch (e) { setErr(e?.message || "Login failed"); }
  }
  return (
    <form onSubmit={go} style={{display:"grid",gap:8,maxWidth:320,margin:"15vh auto"}}>
      <h1>Redmen Beta</h1>
      {!!err && <div style={{color:"crimson"}}>{err}</div>}
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} />
      <button type="submit">Sign In</button>
    </form>
  );
}
