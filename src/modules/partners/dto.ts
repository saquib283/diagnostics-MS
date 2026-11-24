import type {
  CommercialModel,
  Gender,
  OrderItemStatus,
  OrderStatus,
  PartnerPhoneVisibility,
  ReportTrackingStatus,
  SettlementDirection,
  SettlementStatus,
} from "@prisma/client";
import { maskIndianMobile } from "@/lib/permissions/scope";

export interface PartnerOrderDTO {
  id: string;
  orderNumber: string;
  paymentModel: CommercialModel;
  status: OrderStatus;
  referringDoctor: string | null;
  clinicalNotes: string | null;
  createdAt: string;
  patient: {
    patientCode: string;
    fullName: string;
    gender: Gender;
    ageYears: number | null;
    mobileDisplay: string;
  };
  items: Array<{
    id: string;
    testCode: string;
    testName: string;
    quantity: number;
    status: OrderItemStatus;
    completedAt: string | null;
    reportStatus: ReportTrackingStatus;
  }>;
}

/**
 * Strictly allowlists fields exposed to Partner Portal users.
 * NEVER includes consultancy selling prices, discounts, internal notes, or margins.
 */
export function toPartnerOrderDTO(
  order: {
    id: string;
    orderNumber: string;
    paymentModel: CommercialModel;
    status: OrderStatus;
    referringDoctor: string | null;
    clinicalNotes: string | null;
    createdAt: Date;
    patient: {
      patientCode: string;
      fullName: string;
      mobile: string;
      gender: Gender;
      ageYearsSnapshot: number | null;
    };
    items: Array<{
      id: string;
      testCodeSnapshot: string;
      testNameSnapshot: string;
      quantity: number;
      status: OrderItemStatus;
      completedAt: Date | null;
      reportTracking?: { status: ReportTrackingStatus } | null;
    }>;
  },
  options: { phoneVisibility: PartnerPhoneVisibility },
): PartnerOrderDTO {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    paymentModel: order.paymentModel,
    status: order.status,
    referringDoctor: order.referringDoctor,
    clinicalNotes: order.clinicalNotes,
    createdAt: order.createdAt.toISOString(),
    patient: {
      patientCode: order.patient.patientCode,
      fullName: order.patient.fullName,
      gender: order.patient.gender,
      ageYears: order.patient.ageYearsSnapshot,
      mobileDisplay:
        options.phoneVisibility === "FULL"
          ? order.patient.mobile
          : maskIndianMobile(order.patient.mobile),
    },
    items: order.items.map((item) => ({
      id: item.id,
      testCode: item.testCodeSnapshot,
      testName: item.testNameSnapshot,
      quantity: item.quantity,
      status: item.status,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      reportStatus: item.reportTracking?.status ?? "AWAITING",
    })),
  };
}

export interface PartnerSettlementDTO {
  id: string;
  settlementNumber: string;
  direction: SettlementDirection;
  commercialModel: CommercialModel;
  periodStart: string;
  periodEnd: string;
  status: SettlementStatus;
  grossEligibleAmount: string;
  adjustmentsAmount: string;
  netAmount: string;
  settledAmount: string;
  balanceAmount: string;
}

export function toPartnerSettlementDTO(settlement: {
  id: string;
  settlementNumber: string;
  direction: SettlementDirection;
  commercialModel: CommercialModel;
  periodStart: Date;
  periodEnd: Date;
  status: SettlementStatus;
  grossEligibleAmount: { toString(): string };
  adjustmentsAmount: { toString(): string };
  netAmount: { toString(): string };
  settledAmount: { toString(): string };
  balanceAmount: { toString(): string };
}): PartnerSettlementDTO {
  return {
    id: settlement.id,
    settlementNumber: settlement.settlementNumber,
    direction: settlement.direction,
    commercialModel: settlement.commercialModel,
    periodStart: settlement.periodStart.toISOString().slice(0, 10),
    periodEnd: settlement.periodEnd.toISOString().slice(0, 10),
    status: settlement.status,
    grossEligibleAmount: settlement.grossEligibleAmount.toString(),
    adjustmentsAmount: settlement.adjustmentsAmount.toString(),
    netAmount: settlement.netAmount.toString(),
    settledAmount: settlement.settledAmount.toString(),
    balanceAmount: settlement.balanceAmount.toString(),
  };
}

