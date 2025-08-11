"use client";

import React from "react";
import Modal from "./Modal";
import UserForm from "./UserForm";

type RowUser = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  classroom?: string | null;
  roleSlug?: string;
  birthday?: string | null;
  telegram?: string | null;
  avatarUrl?: string | null;
  about?: string | null;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  subjects?: string[];
  methodicalGroups?: string[];
};

export default function EditUserModal({
  user,
  onClose,
  onSaved,
  allowRoleChange = true,
}: {
  user: RowUser | null;
  onClose: () => void;
  onSaved?: () => void;
  allowRoleChange?: boolean;
}) {
  if (!user) return null;

  return (
    <Modal open={true} onClose={onClose} title="Редактировать пользователя" width={720}>
      <UserForm
        mode="edit"
        initialValues={{
          id: user.id,
          name: user.name ?? "",
          email: user.email ?? "",
          phone: user.phone ?? "",
          classroom: user.classroom ?? "",
          roleSlug: user.roleSlug ?? "teacher",
          birthday: user.birthday ?? null,
          telegram: user.telegram ?? "",
          avatarUrl: user.avatarUrl ?? "",
          about: user.about ?? "",
          notifyEmail: !!user.notifyEmail,
          notifyTelegram: !!user.notifyTelegram,
          subjects: user.subjects ?? [],
          methodicalGroups: user.methodicalGroups ?? [],
        }}
        allowRoleChange={allowRoleChange}
        onSuccess={() => {
          onSaved?.();
          onClose();
        }}
      />
    </Modal>
  );
}
