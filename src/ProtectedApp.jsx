// redmen/src/ProtectedApp.jsx
import React from "react";

// In dev mode we bypass Firebase auth entirely.
export default function ProtectedApp({ children }) {
  return <>{children}</>;
}
