"use client";

import { Camera } from "lucide-react";
import { Component, useEffect, useState, type ReactNode } from "react";

type BoundaryState = {
  error: Error | null;
};

class ShellErrorBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-8">
          <p className="text-lg font-semibold text-red-800">
            Agri-Edge could not load this screen.
          </p>
          <p className="mt-2 text-base text-stone-700">
            Close the app and open it again. If you are offline, the saved
            shell should still appear.
          </p>
        </main>
      );
    }

    return <div className="flex flex-1 flex-col">{this.props.children}</div>;
  }
}

function NetworkStatus() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    const sync = () => {
      setOnline(navigator.onLine);
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const label =
    online === null
      ? "Checking connection…"
      : online
        ? "Online 🟢"
        : "Offline 🔴";

  const tone =
    online === null
      ? "bg-stone-200 text-stone-800"
      : online
        ? "bg-emerald-700 text-white"
        : "bg-red-700 text-white";

  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded-xl px-4 py-3 text-center text-base font-semibold tracking-wide ${tone}`}
    >
      Network Status: {label}
    </p>
  );
}

function HomeScreen() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col bg-emerald-50 text-stone-900">
      <header className="bg-emerald-950 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">
          Ondera cooperative
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Agri-Edge</h1>
        <p className="mt-1 text-sm text-emerald-100">
          Coffee advice that stays on this phone.
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-5 py-5">
        <NetworkStatus />

        <section
          aria-label="Leaf scan"
          className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-emerald-200 bg-white px-6 py-10 text-center shadow-sm"
        >
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-100 text-emerald-900">
            <Camera aria-hidden="true" size={52} strokeWidth={1.75} />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Scan a coffee leaf</h2>
          <p className="mt-2 max-w-xs text-base leading-relaxed text-stone-600">
            Camera diagnosis runs on this phone in the next step. No signal
            required.
          </p>
        </section>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <ShellErrorBoundary>
      <HomeScreen />
    </ShellErrorBoundary>
  );
}
