import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { EditorProvider } from "./state/EditorContext";
import EditorLayout from "./EditorLayout";
import LandingPage from "./components/LandingPage";

export default function AppWithAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await setDoc(doc(db, "users", u.uid), {
          email: u.email,
          displayName: u.displayName,
          createdAt: serverTimestamp(),
        }, { merge: true });
      }
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  if (!authReady) return null;

  if (!user) {
    return <LandingPage onLogin={() => {}} />;
  }

  return (
    <EditorProvider>
      <EditorLayout onLogout={() => signOut(auth)} />
    </EditorProvider>
  );
}
