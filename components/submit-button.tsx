"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className,
  disabled = false
}: {
  children: React.ReactNode;
  pendingText?: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={pending || disabled} aria-busy={pending}>
      {pending ? pendingText ?? "Working..." : children}
    </button>
  );
}
