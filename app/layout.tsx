// app/layout.tsx
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Providers from "@/components/providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="app-body">
        <header className="app-header" role="banner">
          <h1 className="app-title">CRM Гимназия №108</h1>
        </header>
        <Providers>
          <div className="app-shell">
            <aside className="app-sidebar" role="complementary">
              <Sidebar />
            </aside>
            <main id="content" className="app-content" role="main" tabIndex={-1}>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
