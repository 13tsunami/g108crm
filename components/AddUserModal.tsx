// components/AddUserModal.tsx
"use client";
import React from "react";
import Modal from "./Modal";
import UserForm from "./UserForm";

export default function AddUserModal({
  open = true, onClose, onAdded,
}: { open?: boolean; onClose: () => void; onAdded?: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Добавить пользователя" width={900} footer={<div />}>
      <UserForm onSuccess={() => { onClose(); onAdded?.(); }} />
    </Modal>
  );
}
