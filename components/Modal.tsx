// components/Modal.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-modal-root", "true");
    document.body.appendChild(el);
    setContainer(el);
    return () => {
      document.body.removeChild(el);
      setContainer(null);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !container) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 12,
          boxShadow:
            "0 12px 28px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.15)",
          border: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #eef0f2",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {title ?? "Окно"}
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid #dcdfe6",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Закрыть
          </button>
        </div>

        <div style={{ padding: 16 }}>{children}</div>

        {footer && (
          <div
            style={{
              padding: 16,
              borderTop: "1px solid #eef0f2",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, container);
}
