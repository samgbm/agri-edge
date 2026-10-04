export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-emerald-950 px-6 py-10 text-white">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">
        Agri-Edge
      </p>
      <h1 className="mt-2 text-3xl font-semibold">You are offline</h1>
      <p className="mt-3 text-base leading-relaxed text-emerald-100">
        The saved app shell is still here. Leaf scans and cached market prices
        will work without a signal. Open Agri-Edge again once this page has
        loaded once on this phone.
      </p>
    </main>
  );
}
