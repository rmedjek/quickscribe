// app/contexts/PageContext.tsx
"use client";

import React, {createContext, useContext, useState, ReactNode} from "react";

interface IPageContext {
  title: string;
  jobId: string | null;
  setPageTitle: (title: string, jobId?: string | null) => void;
  setRefetcher: (refetchFn: () => void) => void;
  triggerRefetch: () => void;
}

const PageContext = createContext<IPageContext | undefined>(undefined);

export function PageProvider({children}: {children: ReactNode}) {
  const [title, setTitle] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [refetcher, setRefetcher] = useState<() => void>(() => () => {});

  const setPageTitle = (newTitle: string, newJobId: string | null = null) => {
    setTitle(newTitle);
    setJobId(newJobId);
  };

  const triggerRefetch = () => {
    if (refetcher) {
      refetcher();
    }
  };

  return (
    <PageContext.Provider
      value={{title, jobId, setPageTitle, setRefetcher, triggerRefetch}}
    >
      {children}
    </PageContext.Provider>
  );
}

export function usePage() {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error("usePage must be used within <PageProvider>");
  return ctx;
}
