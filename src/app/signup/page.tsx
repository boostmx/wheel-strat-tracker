"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export default function SignUpPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    setLoading(false)

    if (res.ok) {
      toast.success("Account created! You can now log in.")
      router.push("/")
    } else {
      const data = await res.json()
      toast.error(data.error || "Something went wrong")
    }
  }

  return (
    <div className="min-h-screen bg-muted py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="space-y-8">
          <h1 className="text-2xl font-bold text-center">Create an Account</h1>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 bg-white p-6 rounded-lg shadow-md border">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name</Label>
                <Input name="firstName" value={form.firstName} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name</Label>
                <Input name="lastName" value={form.lastName} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</Label>
                <Input name="email" type="email" value={form.email} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</Label>
                <Input name="username" value={form.username} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</Label>
                <Input name="password" type="password" value={form.password} onChange={handleChange} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Sign Up"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}