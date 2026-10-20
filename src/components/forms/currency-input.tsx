"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatBrlFromDigits, formatBrlInput } from "@/lib/money/brl";

export function CurrencyInput({
  id,
  name,
  defaultValue,
  className,
  required,
  disabled,
}: {
  id?: string;
  name: string;
  defaultValue?: number | string | null;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => formatBrlInput(defaultValue));

  return (
    <Input
      id={id}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      required={required}
      disabled={disabled}
      value={text}
      placeholder="R$ 0,00"
      className={className}
      onChange={(event) => {
        setText(formatBrlFromDigits(event.target.value));
      }}
    />
  );
}
