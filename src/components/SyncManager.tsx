"use client";

import { syncMarketPrices } from "@/lib/sync";
import { useEffect } from "react";

export default function SyncManager() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    if (navigator.onLine) {
      void syncMarketPrices();
    }

    const onOnline = () => {
      void syncMarketPrices();
    };

    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
