import { lazy, Suspense, useState } from "react";
import { EditorProvider } from "./state/EditorContext";
import { TelemetryProvider } from "./state/TelemetryContext";
import EditorLayout from "./EditorLayout";
import LandingPage from "./components/LandingPage";

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false";

const AppWithAuth = lazy(() => import("./AppWithAuth"));

function AppNoAuth() {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return <LandingPage onLogin={() => setEntered(true)} />;
  }

  return (
    <EditorProvider>
      <TelemetryProvider>
        <EditorLayout onLogout={() => {}} />
      </TelemetryProvider>
    </EditorProvider>
  );
}

export default function App() {
  if (AUTH_ENABLED) {
    return (
      <Suspense>
        <AppWithAuth />
      </Suspense>
    );
  }
  return <AppNoAuth />;
}
