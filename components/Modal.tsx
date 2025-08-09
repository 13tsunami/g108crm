"use client";

import React, { useEffect, useRef } from "react";

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number; // по умолчанию 880
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 880,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Закрытие по Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Блокируем прокрутку body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,.40)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(${width}px, 96vw)`,
          maxHeight: "92vh",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          boxShadow: "0 14px 32px rgba(0,0,0,.12)",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          overflow: "hidden", // важное!
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {title ?? "Окно"}
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              marginLeft: "auto",
              height: 32,
              width: 32,
              borderRadius: 8,
              background: "transparent",
              border: "1px solid #e5e7eb",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Scroll body */}
        <div
          style={{
            overflowY: "auto",
            padding: 16,
            minHeight: 0, // чтобы grid позволил скролл
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            padding: "10px 16px",
            background: "#fafafa",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          {footer ?? (
            <button
              onClick={onClose}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid #dcdfe6",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
