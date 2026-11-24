import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { sumMoney, type MoneyInput } from "@/lib/money";

const GATEWAY_METHODS: readonly PaymentMethod[] = [
  "UPI_QR",
  "UPI_ONLINE",
  "CARD",
  "NETBANKING",
  "WALLET",
];

const SUCCESS_STATUSES: readonly PaymentStatus[] = [
  "SUCCESS",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

/**
 * Strictly separates consultancy cash/gateway/bank collections (Model A)
 * from direct patient-to-partner collections (Model B).
 */
export function aggregateConsultancyCollections(params: {
  patientPayments: ReadonlyArray<{
    method: PaymentMethod;
    status: PaymentStatus;
    amount: MoneyInput;
  }>;
  modelBDirectCollections: ReadonlyArray<{ amount: MoneyInput }>;
}) {
  const successful = params.patientPayments.filter((p) =>
    SUCCESS_STATUSES.includes(p.status),
  );

  const cashCollected = sumMoney(
    successful.filter((p) => p.method === "CASH").map((p) => p.amount),
  );

  const razorpayCollected = sumMoney(
    successful
      .filter((p) => GATEWAY_METHODS.includes(p.method))
      .map((p) => p.amount),
  );

  const otherBankCollected = sumMoney(
    successful
      .filter((p) => p.method !== "CASH" && !GATEWAY_METHODS.includes(p.method))
      .map((p) => p.amount),
  );

  const totalConsultancyCollections = sumMoney(
    successful.map((p) => p.amount),
  );

  const partnerDirectCollectionsTrackedSeparately = sumMoney(
    params.modelBDirectCollections.map((c) => c.amount),
  );

  return {
    cashCollected,
    razorpayCollected,
    otherBankCollected,
    totalConsultancyCollections,
    partnerDirectCollectionsTrackedSeparately,
  };
}

