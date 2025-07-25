"use client";

import { Input } from "@/components/ui/input";
import { ChangeEvent, FocusEvent, useState } from "react";

interface CurrencyInputProps {
  value: { formatted: string; raw: number };
  onChange: (val: { formatted: string; raw: number }) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder,
  disabled,
}: CurrencyInputProps) {
  const [localInput, setLocalInput] = useState(value.formatted);

  // When user types
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setLocalInput(input);

    const raw = parseFloat(input.replace(/[^0-9.]/g, ""));
    onChange({
      formatted: input,
      raw: isNaN(raw) ? 0 : raw,
    });
  };

  // When user leaves the input — format cleanly
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
    const formatted =
      !isNaN(raw) && e.target.value !== ""
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(raw)
        : "";

    setLocalInput(formatted);
    onChange({
      formatted,
      raw: isNaN(raw) ? 0 : raw,
    });
  };

  // When user clicks into the input — strip formatting
  const handleFocus = () => {
    setLocalInput(value.raw ? value.raw.toString() : "");
  };

  return (
    <Input
      inputMode="decimal"
      value={localInput}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      disabled={disabled}
      className="appearance-none"
    />
  );
}
