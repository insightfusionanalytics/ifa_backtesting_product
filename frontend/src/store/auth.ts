import { create } from "zustand";
import type { Me } from "../lib/api";

type AuthState = {
  me: Me | null;
  loading: boolean;
  setMe: (me: Me | null) => void;
  setLoading: (l: boolean) => void;
};

export const useAuth = create<AuthState>((set) => ({
  me: null,
  loading: true,
  setMe: (me) => set({ me }),
  setLoading: (loading) => set({ loading }),
}));
