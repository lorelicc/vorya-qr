"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Company } from "./types";

type CompanyApi = { company: Company; api: string; app: string };
const CompanyContext = createContext<CompanyApi | null>(null);

export function CompanyProvider({ company, children }: { company: Company; children: ReactNode }) {
  const value = { company, api: `companies/${company.id}`, app: `/app/c/${company.id}` };
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

/** Current company plus its API base (`companies/{id}`) and app base (`/app/c/{id}`). */
export function useCompany(): CompanyApi {
  const value = useContext(CompanyContext);
  if (!value) throw new Error("useCompany richiede CompanyProvider");
  return value;
}
