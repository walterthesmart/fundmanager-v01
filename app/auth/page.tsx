'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleSignIn = async () => {
    setBusy(true);
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });
    setBusy(false);
    
    if (res?.error) {
      toast.error("Invalid credentials");
      return;
    }
    
    router.push("/");
    router.refresh();
  };

  const handleSignUp = async () => {
    setBusy(true);
    // In a real app we would call an API endpoint to register the user in Prisma
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: fullName }),
    });
    setBusy(false);
    
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Registration failed");
      return;
    }
    
    toast.success("Account created. You can sign in now.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_minmax(0,480px)]">
      <aside className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 size-full bg-slate-900" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(140deg, color-mix(in oklab, var(--color-primary) 88%, transparent), color-mix(in oklab, var(--color-primary) 55%, transparent))",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="rise-in flex items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-foreground">
              Sankore
            </p>
          </div>

          <div className="rise-in max-w-md">
            <h2 className="text-4xl font-semibold leading-tight text-primary-foreground">
              Fund operations, settled to the second.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
              Real-time balances, maker-checker cash approvals, live product pricing and an
              immutable audit trail — one operating layer for the whole book.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                ["Sub-second", "balance settlement"],
                ["Immutable", "audit provenance"],
                ["Maker-checker", "cash approvals"],
              ].map(([head, sub]) => (
                <div key={head} className="border-l border-mint/40 pl-3">
                  <p className="text-sm font-semibold text-mint">{head}</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-primary-foreground/55">
                    {sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[0.2em] text-primary-foreground/40">
            Sankore Fund Manager
          </p>
        </div>
      </aside>

      <div className="relative flex items-center justify-center bg-background px-4 py-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="rise-in w-full max-w-md">
          <div className="mb-6 hidden lg:block">
            <h1 className="text-2xl font-semibold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to the fund operations platform.
            </p>
          </div>

          <div className="panel p-6">
            <Tabs defaultValue="signin">
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <Field label="Email" value={email} onChange={setEmail} type="email" />
                <Field label="Password" value={password} onChange={setPassword} type="password" />
                <Button className="press w-full" disabled={busy} onClick={handleSignIn}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Sign in
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <Field label="Full name" value={fullName} onChange={setFullName} />
                <Field label="Email" value={email} onChange={setEmail} type="email" />
                <Field label="Password" value={password} onChange={setPassword} type="password" />
                <Button className="press w-full" disabled={busy} onClick={handleSignUp}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create account
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
