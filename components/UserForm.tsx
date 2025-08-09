// components/UserForm.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type RoleDTO = { id: string; name: string; slug: string; power: number };
type UserDTO = {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  roleSlug?: string;
  roles?: { slug: string; name: string }[];
  classroom?: string | null;
  subjects?: string[];
  methodicalGroups?: string[];
};

// «школьные предметы, 2025» — базовый перечень (легко расширяется)
const SUBJECTS_2025 = [
  "Русский язык","Литература","Иностранный язык (английский)","Иностранный язык (немецкий)","Иностранный язык (французский)",
  "Математика","Алгебра","Геометрия","Информатика","История","Обществознание","География",
  "Биология","Физика","Химия","Астрономия","Экономика","Право","Технология",
  "Физическая культура","ОБЖ","Музыка","ИЗО","Индивидуальный проект"
];

// Методические объединения (МО). Можно править под сайт гимназии 108.
const METHODICAL_GROUPS = [
  "МО естественных наук",
  "МО русского языка и литературы",
  "МО точных наук",
  "МО иностранных языков",
  "МО истории и обществознания",
  "МО начальной школы",
  "МО эстетического цикла",
  "МО физкультуры и ОБЖ",
  "МО технологии и информатики",
  "МО классных руководителей"
];

export default function UserForm({
  mode = "create",
  initialValues,
  onSuccess,
}: {
  mode?: "create" | "edit";
  initialValues?: Partial<UserDTO>;
  onSuccess?: () => void;
}) {
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [name, setName] = useState(initialValues?.name ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [roleSlug, setRoleSlug] = useState(initialValues?.roleSlug ?? "");
  const [classroom, setClassroom] = useState(initialValues?.classroom ?? "");
  const [subjects, setSubjects] = useState<string[]>(initialValues?.subjects ?? []);
  const [groups, setGroups] = useState<string[]>(initialValues?.methodicalGroups ?? []);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // роли из БД
  useEffect(() => {
    let aborted = false;
    fetch("/api/roles", { cache: "no-store" })
      .then((r) => r.json())
      .then((list: RoleDTO[]) => !aborted && setRoles(list || []))
      .catch(() => !aborted && setRoles([]));
    return () => { aborted = true; };
  }, []);

  // подхватываем initialValues при редактировании (когда придут)
  useEffect(() => {
    if (!initialValues) return;
    if (typeof initialValues.name === "string") setName(initialValues.name);
    if (typeof initialValues.email === "string" || initialValues.email === null) setEmail(initialValues.email ?? "");
    if (typeof initialValues.phone === "string" || initialValues.phone === null) setPhone(initialValues.phone ?? "");
    const fromRoles = initialValues.roles?.[0]?.slug;
    setRoleSlug(initialValues.roleSlug ?? fromRoles ?? "");
    setClassroom(initialValues.classroom ?? "");
    setSubjects(initialValues.subjects ?? []);
    setGroups(initialValues.methodicalGroups ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)]);

  // дефолтная роль
  useEffect(() => {
    if (roleSlug || roles.length === 0) return;
    const teacher =
      roles.find((r) => r.slug.toLowerCase().includes("teacher")) ||
      roles.find((r) => r.name.toLowerCase().includes("педагог"));
    if (teacher) setRoleSlug(teacher.slug);
    else {
      const minPower = [...roles].sort((a, b) => a.power - b.power)[0];
      if (minPower) setRoleSlug(minPower.slug);
    }
  }, [roles, roleSlug]);

  const canSubmit = useMemo(() => !!name.trim() && !!roleSlug, [name, roleSlug]);

  const onSelectMultiple = (setter: (v: string[]) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const arr = Array.from(e.target.selectedOptions).map((o) => o.value);
    setter(arr);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true); setError("");

    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        roleSlug,
        classroom: classroom || undefined,
        subjects,
        methodicalGroups: groups,
      };

      const res =
        mode === "edit" && initialValues?.id
          ? await fetch(`/api/users/${initialValues.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j?.error === "ROLE_NOT_FOUND") setError("Роль не найдена.");
        else if (j?.error === "UNIQUE_CONSTRAINT") setError("Телефон или email уже используются.");
        else setError("Ошибка сохранения.");
        return;
      }

      onSuccess?.();
      if (mode === "create") {
        setName(""); setEmail(""); setPhone(""); setRoleSlug("");
        setClassroom(""); setSubjects([]); setGroups([]);
      }
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit}>
      {error && <div style={{ color: "#c00", marginBottom: 12 }}>{error}</div>}

      <label className="block mb-2">ФИО</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван Иванович" />

      <div style={{ height: 12 }} />
      <label className="block mb-2">Email (необязательно)</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />

      <div style={{ height: 12 }} />
      <label className="block mb-2">Телефон (необязательно)</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="+7XXXXXXXXXX" />

      <div style={{ height: 12 }} />
      <label className="block mb-2">Роль</label>
      <select value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)}>
        <option value="">— выберите роль —</option>
        {roles.map((r) => (
          <option key={r.id} value={r.slug}>{r.name}</option>
        ))}
      </select>

      <div style={{ height: 12 }} />
      <label className="block mb-2">Классное руководство (например, 9Б)</label>
      <input value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder="9Б" />

      <div style={{ height: 12 }} />
      <label className="block mb-2">Предметы (множественный выбор)</label>
      <select multiple value={subjects} onChange={onSelectMultiple(setSubjects)} style={{ minHeight: 120 }}>
        {SUBJECTS_2025.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <div style={{ height: 12 }} />
      <label className="block mb-2">Группы пользователей (МО, множественный выбор)</label>
      <select multiple value={groups} onChange={onSelectMultiple(setGroups)} style={{ minHeight: 120 }}>
        {METHODICAL_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>

      <div style={{ height: 16 }} />
      <button type="submit" className="btn-primary" disabled={!canSubmit || loading}>
        {loading ? "Сохранение…" : mode === "edit" ? "Сохранить" : "Добавить"}
      </button>
    </form>
  );
}
