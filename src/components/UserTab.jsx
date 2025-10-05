import React, { useEffect, useState } from "react";
import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "../lib/firebase";

export default function UserTab() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u); setLoading(false);
    }, (e) => { setError(e); setLoading(false); });
    return () => unsub();
  }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      if (mode === "login") await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      setEmail(""); setPassword("");
    } catch (e) {
      alert(e?.message || String(e));
    }
  }
  async function google() {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { alert(e?.message || String(e)); }
  }
  async function logout(){ try { await signOut(auth); } catch {} }

  if (loading) return <div style={{color:"#c6cfdb"}}>Loading user…</div>;

  if (user) {
    return (
      <div style={{ display:"grid", gap:12, color:"#c6cfdb" }}>
        <div style={{fontSize:18,fontWeight:600}}>Your account</div>
        <div><b>Email:</b> {user.email || "(none)"}</div>
        <div><b>UID:</b> <code>{user.uid}</code></div>
        <div><b>Provider:</b> {(user.providerData?.[0]?.providerId)||"unknown"}</div>
        <div style={{marginTop:8, opacity:0.8}}>Premium: <i>coming soon</i></div>
        <button onClick={logout} style={btn()}>Log out</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:420, width:"100%", color:"#c6cfdb" }}>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {["login","signup"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={tab(mode===m)}>{m.toUpperCase()}</button>
        ))}
      </div>
      <form onSubmit={submit} style={{ display:"grid", gap:10 }}>
        <label style={label()}>
          <span>Email</span>
          <input value={email} onChange={e=>setEmail(e.target.value)} required type="email" style={input()} />
        </label>
        <label style={label()}>
          <span>Password</span>
          <input value={password} onChange={e=>setPassword(e.target.value)} required type="password" style={input()} />
        </label>
        <button type="submit" style={btn()}>{mode==="login"?"Log in":"Sign up"}</button>
      </form>
      <div style={{margin:"12px 0", textAlign:"center"}}>or</div>
      <button onClick={google} style={btnSecondary()}>Continue with Google</button>
      {error && <div style={{color:"#e57373", marginTop:12}}>Auth error: {String(error?.message || error)}</div>}
    </div>
  );
}

function tab(active) {
  return {
    padding:"8px 12px",
    borderRadius:8,
    border:"1px solid #2b3c52",
    background: active ? "#1b2738" : "transparent",
    color:"#c6cfdb",
    fontSize:12,
    cursor:"pointer",
    textTransform:"uppercase",
    letterSpacing:"0.06em"
  };
}
function label(){ return { display:"grid", gap:6, fontSize:13 } }
function input(){
  return {
    padding:"10px 12px",
    borderRadius:10,
    border:"1px solid #2b3c52",
    background:"#0f1724",
    color:"#dde7f6"
  };
}
function btn(){
  return {
    padding:"10px 14px",
    borderRadius:10,
    border:"1px solid #2b3c52",
    background:"#1b2738",
    color:"#c6cfdb",
    fontSize:14,
    cursor:"pointer"
  };
}
function btnSecondary(){
  return {
    padding:"10px 14px",
    borderRadius:10,
    border:"1px solid #2b3c52",
    background:"transparent",
    color:"#c6cfdb",
    fontSize:14,
    cursor:"pointer"
  };
}