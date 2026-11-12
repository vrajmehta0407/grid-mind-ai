"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

interface GridMindState {
  userId: string;
  isAuthenticated: boolean;
  userEmailOrPhone: string | null;
  setSession: (userId: string, label: string) => void;
  signOut: () => void;
}

export const useGridMindStore = create<GridMindState>()(
  persist(
    (set) => ({
      userId: DEMO_USER_ID,
      isAuthenticated: true,
      userEmailOrPhone: "priya@gridmind.demo",
      setSession: (userId, label) =>
        set({ userId, isAuthenticated: true, userEmailOrPhone: label }),
      signOut: () =>
        set({ userId: DEMO_USER_ID, isAuthenticated: false, userEmailOrPhone: null }),
    }),
    { name: "gridmind-session" }
  )
);

