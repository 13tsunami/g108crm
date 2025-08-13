"use client";

import React from "react";
import Modal from "./Modal";
import UserForm from "./UserForm";

type RowUser = {
  id: string;
  name: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  classroom?: string | null;
  roleSlug?: string;
  birthday?: string | null;
  telegram?: string | null;
  about?: string | null;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
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
          username: user.username ?? "",
          email: user.email ?? "",
          phone: user.phone ?? "",
          classroom: user.classroom ?? "",
          roleSlug: user.roleSlug ?? "teacher",
          birthday: user.birthday ?? null,
          telegram: user.telegram ?? "",
          about: user.about ?? "",
          notifyEmail: !!user.notifyEmail,
          notifyTelegram: !!user.notifyTelegram,
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
