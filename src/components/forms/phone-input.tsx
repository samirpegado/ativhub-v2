"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/phone/br";

export function PhoneInput({
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
  const [text, setText] = useState(() => formatPhone(defaultValue));

  return (
    <Input
      id={id}
      name={name}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      required={required}
      disabled={disabled}
      value={text}
      placeholder="(00) 00000-0000"
      className={className}
      onChange={(event) => {
        setText(formatPhone(event.target.value));
      }}
    />
  );
}
