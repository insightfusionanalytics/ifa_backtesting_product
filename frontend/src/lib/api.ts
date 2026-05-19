import axios from "axios";
import { auth } from "./firebase";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type Me = {
  id: string;
  email: string;
  role: "client" | "sub_admin" | "main_admin";
  status: "active" | "suspended";
  client: { id: string; name: string; tier: string; status: string } | null;
  needs_tnc_acceptance: boolean;
  latest_tnc_version_id: string | null;
};

export async function fetchMe(): Promise<Me> {
  const res = await api.get<Me>("/me");
  return res.data;
}

export type TermsClause = { id: string; title: string; body: string; required: boolean };
export type Terms = {
  id: string;
  version: string;
  body: string;
  clauses: TermsClause[];
  effective_from: string;
};

export async function fetchTerms(): Promise<Terms> {
  const res = await api.get<Terms>("/terms/current");
  return res.data;
}

export async function acceptTerms(version_id: string, accepted_clauses: string[]) {
  const res = await api.post<{ ok: boolean; acceptance_id: string }>("/terms/accept", {
    version_id,
    accepted_clauses,
  });
  return res.data;
}
