"use client";

import * as React from "react";

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
  [key: string]: any;
}) {
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return <>{children}</>;
}
