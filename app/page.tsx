"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const BORDER = "#e5e7eb";

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();

  // Если пользователь авторизован и попал на корень — перекидываем на дашборд
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  return (
    <section style={{ padding: 12 }}>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: "#fff", padding: 16 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Добро пожаловать в G108 CRM</h1>
        <p style={{ margin: 0, color: "#374151" }}>
          Выберите пункт меню слева. Все разделы оформлены в едином стиле: светлые карточки, чёткие границы, спокойная типографика.
        </p>
      </div>
    </section>
  );
}
