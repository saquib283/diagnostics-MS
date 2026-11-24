import React from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Info,
  XCircle,
} from "lucide-react";
import { cn } from "./primitives";

type Tone = "success" | "warning" | "info" | "danger" | "neutral";

const TONE_MAP: Record<
  Tone,
  { classes: string; Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }
> = {
  success: {
    classes: "bg-[#DCFCE7] text-[#166534] border-[#86EFAC]",
    Icon: CheckCircle2,
  },
  warning: {
    classes: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
    Icon: AlertTriangle,
  },
  info: {
    classes: "bg-[#E0F2FE] text-[#075985] border-[#7DD3FC]",
    Icon: Info,
  },
  danger: {
    classes: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
    Icon: XCircle,
  },
  neutral: {
    classes: "bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]",
    Icon: Clock,
  },
};

export function resolveStatusTone(status: string): Tone {
  switch (status.toUpperCase()) {
    case "COMPLETED":
    case "PAID":
    case "SUCCESS":
    case "SETTLED":
    case "APPROVED":
    case "ACTIVE":
    case "CREDITED":
    case "SENT":
    case "DELIVERED":
    case "UPLOADED":
    case "READY":
    case "MATCHED":
      return "success";

    case "PARTIALLY_PAID":
    case "PARTIALLY_COMPLETED":
    case "PARTIALLY_SETTLED":
    case "PARTIALLY_REFUNDED":
    case "IN_PROGRESS":
    case "PENDING_APPROVAL":
    case "PROCESSING":
    case "UNRECONCILED":
    case "UNCONFIGURED":
      return "warning";

    case "CONFIRMED":
    case "MODEL_A_CONSULTANCY_COLLECTS":
    case "MODEL_B_PATIENT_PAYS_PARTNER":
    case "PAYABLE_TO_PARTNER":
    case "RECEIVABLE_FROM_PARTNER":
      return "info";

    case "FAILED":
    case "CANCELLED":
    case "VOID":
    case "REFUNDED":
    case "REVERSED":
    case "SUSPENDED":
    case "UNABLE_TO_PERFORM":
    case "EXPIRED":
    case "DISPUTED":
      return "danger";

    default:
      return "neutral";
  }
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const tone = resolveStatusTone(status);
  const { classes, Icon } = TONE_MAP[tone];
  const display = (label ?? status).replace(/_/g, " ");
  const EffectiveIcon = status === "VOID" || status === "CANCELLED" ? Ban : Icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-xs font-medium leading-tight whitespace-nowrap",
        classes,
        className,
      )}
    >
      <EffectiveIcon className="h-3 w-3 shrink-0" aria-hidden={true} />
      <span>{display}</span>
    </span>
  );
}

