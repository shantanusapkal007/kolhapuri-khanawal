/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Firebase SDK Integration & Production Client Configuration
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, Analytics } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBjg1aUq7UZCbUy1QhE-cuIsJCA_qOWXHw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "kolhapuri-khanawal.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kolhapuri-khanawal",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "kolhapuri-khanawal.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "411458352091",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:411458352091:web:df9c228a995a18cb0cadfe",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-QY2NE6C18L",
};

// Singleton App Instance — handles Next.js Fast Refresh & SSR safely
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let analyticsInstance: Analytics | null = null;

/**
 * Safely initialize Google Analytics in client-side browser environments only.
 * Guaranteed never to crash during Next.js SSR or Turbopack prerendering.
 */
export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") {
    return null;
  }
  if (analyticsInstance) {
    return analyticsInstance;
  }
  try {
    const supported = await isSupported();
    if (supported) {
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    }
  } catch (err) {
    console.warn("Firebase Analytics could not be initialized:", err);
  }
  return null;
}
