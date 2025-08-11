"use client";

import React from "react";
import Modal from "./Modal";
import UserForm from "./UserForm";

export default function AddUserModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Добавить пользователя" width={720}>
      <UserForm
        mode="create"
        initialValues={{
          name: "",
          username: "",   // логин обязателен при создании
          email: "",
          phone: "",
          classroom: "",
          roleSlug: "teacher",
          birthday: null,
          telegram: "",
          avatarUrl: "",
          about: "",
          notifyEmail: false,
          notifyTelegram: false,
          subjects: [],
          methodicalGroups: [],
          password: "",
        }}
        onSuccess={() => {
          onAdded?.();
          onClose();
        }}
      />
    </Modal>
  );
}
