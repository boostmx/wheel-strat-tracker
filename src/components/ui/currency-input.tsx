"use client"

import { Input } from "@/components/ui/input"
import { ChangeEvent } from "react"

interface CurrencyInputProps {
  value: string
  onChange: (value: { formatted: string; raw: number }) => void
  placeholder?: string
  disabled?: boolean
}

export function CurrencyInput({ value, onChange, placeholder, disabled }: CurrencyInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, "")
    const raw = parseFloat(rawValue)
    const formatted = isNaN(raw) ? "" : new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(raw)

    onChange({
      formatted: formatted || "",
      raw: isNaN(raw) ? 0 : raw,
    })
  }

  return (
    <Input
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className="appearance-none"
    />
  )
}
