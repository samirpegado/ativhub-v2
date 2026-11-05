"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatTaxId } from "@/lib/tax-id/br";

export function TaxIdInput({
  id,
  name,
  defaultValue,
  className,
  required,
  disabled,
}: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => formatTaxId(defaultValue));

  return (
    <Input
      id={id}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      required={required}
      disabled={disabled}
      value={text}
      placeholder="000.000.000-00"
      className={className}
      onChange={(event) => {
        setText(formatTaxId(event.target.value));
      }}
    />
  );
}
