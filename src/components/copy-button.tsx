"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Kopyala" }: { value: string; label?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Panoya kopyalandı.");
    } catch {
      toast.error("Kopyalanamadı. Kodu elle seçip kopyalayın.");
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      <CopyIcon aria-hidden />
      {label}
    </Button>
  );
}
