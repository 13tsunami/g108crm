"use client";

import React from "react";
import Modal from "./Modal";
import UserForm from "./UserForm";

type RoleSlim = { slug: string; name?: string };

type RowUser = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  classroom?: string | null;
  roles?: RoleSlim[];
  roleSlug?: string;
  role?: string | { slug: string; name?: string };
  subjects?: string[];
  methodicalGroups?: string[];
  groups?: string[];
  telegram?: string | null;
  avatarUrl?: string | null;
  about?: string | null;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  birthday?: string | null;
};

function toInitial(u: RowUser) {
  const slug =
    u.roleSlug ||
    (Array.isArray(u.roles) && u.roles[0]?.slug) ||
    (typeof u.role === "string" ? u.role : (u.role as any)?.slug) ||
    "";

  const roles =
    Array.isArray(u.roles)
      ? u.roles.map(r => ({ slug: r.slug, name: r.name ?? r.slug }))
      : undefined;

  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    phone: u.phone ?? "",
    roleSlug: slug,
    classroom: u.classroom ?? "",
    subjects: Array.isArray(u.subjects) ? u.subjects : [],
    methodicalGroups: Array.isArray(u.methodicalGroups)
      ? u.methodicalGroups
      : (Array.isArray(u.groups) ? u.groups : []),
    telegram: u.telegram ?? "",
    avatarUrl: u.avatarUrl ?? "",
    about: u.about ?? "",
    notifyEmail: typeof u.notifyEmail === "boolean" ? u.notifyEmail : true,
    notifyTelegram: typeof u.notifyTelegram === "boolean" ? u.notifyTelegram : false,
    roles,
    birthday: u.birthday ?? null,
  };
}

export default function EditUserModal({
  user, onClose, onSaved, allowRoleChange = true,
}: { user: RowUser; onClose: () => void; onSaved?: () => void; allowRoleChange?: boolean; }) {
  const initial = toInitial(user);

  return (
    <Modal open onClose={onClose} title="Редактировать пользователя" width={900} footer={<div />}>
      <UserForm
        key={user.id}
        mode="edit"
        initialValues={initial}
        allowRoleChange={allowRoleChange}
        onSuccess={() => { onClose(); onSaved?.(); }}
      />
    </Modal>
  );
}
