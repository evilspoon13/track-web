import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { EditorProvider } from "./state/EditorContext";
import EditorLayout from "./EditorLayout";
import LandingPage from "./components/LandingPage";
import { listScreens, DeviceNotRegisteredError } from "./utils/layoutIO";

type AppState = "loading" | "ready" | "unregistered";

export default function AppWithAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [appState, setAppState] = useState<AppState>("loading");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await setDoc(doc(db, "users", u.uid), {
          email: u.email,
          displayName: u.displayName,
          createdAt: serverTimestamp(),
        }, { merge: true });

        try {
          await listScreens();
          setAppState("ready");
        } catch (err) {
          if (err instanceof DeviceNotRegisteredError) {
            setAppState("unregistered");
          } else {
            setAppState("ready");
          }
        }
      } else {
        setAppState("loading");
      }
      setUser(u);
    });
    return unsub;
  }, []);

  if (!user) {
    return <LandingPage onLogin={() => {}} />;
  }

  if (appState === "loading") return null;

  if (appState === "unregistered") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", textAlign: "center", padding: "2rem" }}>
        <p>Your email hasn&apos;t been added to a device. Ask a team admin to register you via the Pi&apos;s captive portal.</p>
      </div>
    );
  }

  return (
    <EditorProvider>
      <EditorLayout onLogout={() => { signOut(auth); setAppState("loading"); }} />
    </EditorProvider>
  );
}
