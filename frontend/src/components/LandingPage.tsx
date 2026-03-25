import { useState } from "react";
import DotsBackground from "@/components/ui/dots-background";

interface LandingPageProps {
  onLogin: () => void;
}

const LETTERS = "T.R.A.C.K.".split("");
const TITLE_DONE = 1.3;

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false";

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleLogin = async () => {
    if (!AUTH_ENABLED) {
      setIsExiting(true);
      setTimeout(onLogin, 450);
      return;
    }
    try {
      const { signInWithPopup } = await import("firebase/auth");
      const { auth, googleProvider } = await import("../lib/firebase");
      await signInWithPopup(auth, googleProvider);
      setIsExiting(true);
      setTimeout(onLogin, 450);
    } catch {
      // user closed popup or auth failed — stay on landing page
    }
  };

  return (
    <div
      className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-gray-950"
      style={isExiting ? { animation: "pageExit 0.45s ease forwards" } : undefined}
    >
      <DotsBackground />

      <div className="relative z-10 flex flex-col items-center gap-6">

        {/* Top bar — beams left to right */}
        <div
          className="h-px w-48 bg-gray-700"
          style={{
            animation: "beamOut 0.5s ease forwards",
            animationDelay: "0.1s",
            transformOrigin: "left center",
            transform: "scaleX(0)",
          }}
        />

        {/* Title — staggered letter fade-in */}
        <div className="flex items-center gap-0.5">
          {LETTERS.map((letter, i) => (
            <span
              key={i}
              className="text-5xl font-bold tracking-widest text-white"
              style={{
                animation: "fadeIn 0.4s ease forwards",
                animationDelay: `${0.3 + i * 0.06}s`,
                opacity: 0,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* Subtitle — fades in after title */}
        <p
          className="text-xs font-mono tracking-widest text-gray-500"
          style={{
            animation: "fadeIn 0.5s ease forwards",
            animationDelay: `${TITLE_DONE}s`,
            opacity: 0,
          }}
        >
          TELEMETRY RENDERING AND CAPTURE KIT
        </p>

        {/* Bottom bar — beams right to left */}
        <div
          className="h-px w-48 bg-gray-700"
          style={{
            animation: "beamOut 0.5s ease forwards",
            animationDelay: `${TITLE_DONE}s`,
            transformOrigin: "right center",
            transform: "scaleX(0)",
          }}
        />

        {/* Sign in button — fades up from below */}
        <button
          onClick={handleLogin}
          className="mt-2 flex max-w-xs w-full items-center justify-center gap-3 rounded-full border border-gray-600 bg-white px-6 py-3 text-sm font-medium text-gray-800 shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl"
          style={{
            animation: "fadeUp 0.6s ease forwards",
            animationDelay: `${TITLE_DONE + 0.3}s`,
            opacity: 0,
          }}
        >
          {AUTH_ENABLED ? (
            <>
              <GoogleIcon />
              Sign in with Google
            </>
          ) : (
            "Enter"
          )}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes beamOut {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pageExit {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
