"use client"

import * as React from "react"
import { RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getHealth } from "@/lib/api"
import type { HealthOut } from "@/lib/api-contracts"

export function ServiceStatus() {
  const [health, setHealth] = React.useState<HealthOut | null>(null)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [revision, setRevision] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    void getHealth(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return
        setHealth(value)
        setError("")
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setHealth(null)
        setError(
          reason instanceof Error
            ? reason.message
            : "The document service is unavailable."
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [revision])

  return (
    <section
      aria-label="Document service"
      aria-busy={loading}
      className="flex flex-wrap items-center gap-3 font-sans text-sm"
    >
      <Badge
        variant={
          error || (health && !health.database) ? "destructive" : "secondary"
        }
      >
        {loading
          ? "Checking document service"
          : error
            ? "Service unavailable"
            : health?.database
              ? "Service connected"
              : "Service degraded"}
      </Badge>
      <p className="text-muted-foreground" role="status">
        {error ||
          (health
            ? `${health.documents} documents · ${health.indexed_chunks} indexed passages`
            : "")}
      </p>
      <Button
        variant="ghost"
        size="sm"
        disabled={loading}
        onClick={() => {
          setLoading(true)
          setRevision((value) => value + 1)
        }}
      >
        <RefreshCwIcon data-icon="inline-start" />
        Refresh status
      </Button>
    </section>
  )
}
