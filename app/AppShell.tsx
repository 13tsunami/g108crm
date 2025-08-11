// app/AppShell.tsx
"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/sign-in");

  if (isAuthPage) {
    return (
      <main id="content" className="app-content" role="main" tabIndex={-1}>
        {children}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" role="complementary">
        <Sidebar />
      </aside>
      <main id="content" className="app-content" role="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
