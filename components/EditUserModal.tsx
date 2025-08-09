// components/EditUserModal.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import UserForm from "./UserForm";

export default function EditUserModal({
  userId, onClose, onSaved,
}: { userId: string; onClose: () => void; onSaved?: () => void }) {
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    let aborted = false;
    setUser(null);
    fetch(`/api/users/${userId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((u) => !aborted && setUser(u))
      .catch(() => !aborted && setUser(null));
    return () => { aborted = true; };
  }, [userId]);

  const title = useMemo(
    () => (user?.name ? `Редактирование: ${user.name}` : "Редактирование пользователя"),
    [user]
  );

  return (
    <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,.40)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "min(880px, 96vw)", maxHeight: "92vh", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 14px 32px rgba(0,0,0,.12)", display: "flex", flexDirection: "column", padding: 0, background: "#fff" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
          <button aria-label="Закрыть" onClick={onClose} className="btn-ghost" style={{ marginLeft: "auto", height: 32, width: 32, borderRadius: 8 }}>×</button>
        </div>
        <div style={{ padding: 16, overflowY: "auto" }}>
          {user && (
            <UserForm
              mode="edit"
              initialValues={{
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                roles: user.roles,
                classroom: user.classroom,
                subjects: user.subjects,
                methodicalGroups: user.methodicalGroups,
              }}
              onSuccess={() => { onClose(); onSaved?.(); }}
            />
          )}
        </div>
        <div style={{ borderTop: "1px solid #e5e7eb", padding: "10px 16px", display: "flex", justifyContent: "flex-end", gap: 8, background: "#fafafa" }}>
          <button className="btn" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
