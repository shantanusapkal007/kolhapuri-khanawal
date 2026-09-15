"use client";

import { useEffect } from "react";
import { initFirebaseAnalytics } from "@/lib/firebase/config";

export function FirebaseAnalytics() {
  useEffect(() => {
    initFirebaseAnalytics();
  }, []);

  return null;
}
