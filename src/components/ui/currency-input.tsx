"use client";

import { Input } from "@/components/ui/input";
import { ChangeEvent } from "react";

interface CurrencyInputProps {
  value: string;
  onChange: (value: { formatted: string; raw: number }) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder,
  disabled,
}: CurrencyInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Clean input, allow decimals
    const rawValue = input.replace(/[^0-9.]/g, "");

    // Only allow one decimal point
    const parts = rawValue.split(".");
    if (parts.length > 2) return;

    const raw = parseFloat(rawValue);
    const formatted = isNaN(raw)
      ? ""
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(raw);

    onChange({
      formatted: rawValue === "" ? "" : formatted,
      raw: isNaN(raw) ? 0 : raw,
    });
  };

  return (
    <Input
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className="appearance-none"
    />
  );
}
