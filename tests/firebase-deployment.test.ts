import { describe, it, expect } from "vitest";
import { app, firebaseConfig, initFirebaseAnalytics } from "@/lib/firebase/config";
import fs from "fs";
import path from "path";

describe("Firebase & Vercel Deployment Configuration", () => {
  describe("1. Firebase Client Configuration", () => {
    it("should configure the exact user project kolhapuri-khanawal", () => {
      expect(firebaseConfig.projectId).toBe("kolhapuri-khanawal");
      expect(firebaseConfig.authDomain).toBe("kolhapuri-khanawal.firebaseapp.com");
      expect(firebaseConfig.storageBucket).toBe("kolhapuri-khanawal.firebasestorage.app");
      expect(firebaseConfig.appId).toBe("1:411458352091:web:df9c228a995a18cb0cadfe");
      expect(firebaseConfig.measurementId).toBe("G-QY2NE6C18L");
      expect(firebaseConfig.apiKey).toBeTruthy();
    });

    it("should initialize the Firebase App singleton without errors", () => {
      expect(app).toBeDefined();
      expect(app.name).toBe("[DEFAULT]");
      expect(app.options.projectId).toBe("kolhapuri-khanawal");
    });

    it("should safely handle initFirebaseAnalytics in server environment without crashing", async () => {
      // In node/server environment, window may be undefined or mocked; it must never throw an unhandled exception
      const analytics = await initFirebaseAnalytics();
      // In non-browser environment, it resolves cleanly to null
      expect(analytics === null || typeof analytics === "object").toBe(true);
    });
  });

  describe("2. Deployment Configuration Files", () => {
    it("should have a valid .firebaserc with kolhapuri-khanawal as default project", () => {
      const firebasercPath = path.join(process.cwd(), ".firebaserc");
      expect(fs.existsSync(firebasercPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(firebasercPath, "utf-8"));
      expect(content.projects?.default).toBe("kolhapuri-khanawal");
    });

    it("should have a valid firebase.json for hosting", () => {
      const firebaseJsonPath = path.join(process.cwd(), "firebase.json");
      expect(fs.existsSync(firebaseJsonPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(firebaseJsonPath, "utf-8"));
      expect(content.hosting.public || content.hosting.source).toBeDefined();
      expect(content.hosting.public === "out" || content.hosting.source === ".").toBe(true);
    });

    it("should have a valid vercel.json with nextjs framework", () => {
      const vercelJsonPath = path.join(process.cwd(), "vercel.json");
      expect(fs.existsSync(vercelJsonPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
      expect(content.framework).toBe("nextjs");
      expect(content.headers).toBeInstanceOf(Array);
      expect(content.headers.length).toBeGreaterThan(0);
    });

    it("should have .env.production containing Firebase public credentials", () => {
      const envPath = path.join(process.cwd(), ".env.production");
      expect(fs.existsSync(envPath)).toBe(true);

      const content = fs.readFileSync(envPath, "utf-8");
      expect(content).toContain("NEXT_PUBLIC_FIREBASE_PROJECT_ID=kolhapuri-khanawal");
      expect(content).toContain("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-QY2NE6C18L");
    });
  });
});
