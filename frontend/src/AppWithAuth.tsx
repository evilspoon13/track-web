import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { EditorProvider } from "./state/EditorContext";
import { TelemetryProvider } from "./state/TelemetryContext";
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
    const handleRetry = async () => {
      setAppState("loading");
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
    };

    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 p-8">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-white">No Device Linked</h2>
          <p className="text-sm text-gray-400">
            Your account isn&apos;t linked to a T.R.A.C.K. device yet. To get started, a team member
            with access to the Pi needs to add your email (<span className="text-gray-300">{user.email}</span>)
            as a team member on the captive portal.
          </p>
          <p className="text-xs text-gray-600">
            Connect to the Pi&apos;s WiFi access point, open the captive portal, go to the Device tab,
            and add this email to the team members list.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={handleRetry}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => { signOut(auth); setAppState("loading"); }}
              className="rounded bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EditorProvider>
      <TelemetryProvider>
        <EditorLayout onLogout={() => { signOut(auth); setAppState("loading"); }} />
      </TelemetryProvider>
    </EditorProvider>
  );
}
