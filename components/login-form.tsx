"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [error, setError] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const searchParams = useSearchParams()
  const mode = searchParams?.get("mode") ?? "login"

  const handleGoogleAuth = async () => {
    setError(null)
    setIsGoogleLoading(true)
    const redirectTo = `${window.location.origin}/preview/api-keys`

    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    })

    if (error) {
      setError(error.message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>{mode === "signup" ? "Create your AI Wiki account" : "Log in to AI Wiki"}</CardTitle>
          <CardDescription>
            Use your Google account to {mode === "signup" ? "get started" : "continue"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleGoogleAuth()
            }}
            className="space-y-4"
          >
            <Button className="w-full" type="submit" disabled={isGoogleLoading}>
              {isGoogleLoading ? "Connecting..." : mode === "signup" ? "Sign up with Google" : "Log in with Google"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account? <a className="underline" href="/login?mode=signup">Sign up</a>
            </p>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
