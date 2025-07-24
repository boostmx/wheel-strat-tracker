"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { CurrencyInput } from "@/components/ui/currency-input"

export function CreatePortfolioModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [capitalFormatted, setCapitalFormatted] = useState("")
  const [capitalRaw, setCapitalRaw] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    setIsLoading(true)

    const res = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startingCapital: capitalRaw }),
    })

    setIsLoading(false)

    if (res.ok) {
      toast.success("Portfolio created!")
      setOpen(false)
      setName("")
      setCapitalFormatted("")
      setCapitalRaw(0)
      router.refresh()
    } else {
      toast.error("Failed to create portfolio")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Create Portfolio</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Portfolio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Portfolio Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <CurrencyInput
            value={capitalFormatted}
            onChange={({ formatted, raw }) => {
              setCapitalFormatted(formatted)
              setCapitalRaw(raw)
            }}
            placeholder="Starting Capital"
          />

          <Button
            onClick={handleSubmit}
            disabled={isLoading || !name || capitalRaw <= 0}
          >
            {isLoading ? "Creating..." : "Create Portfolio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
