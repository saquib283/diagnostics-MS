/**
 * DCMS Deterministic Synthetic Demo Seed
 * ============================================================================
 * IMPORTANT: Contains ONLY clearly marked synthetic [DEMO] data.
 * Zero real personal, clinical, or payment data.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../src/lib/permissions/rbac";
import type { SystemRoleCode } from "../src/lib/permissions/types";
import { SYSTEM_ACCOUNTS } from "../src/modules/accounting/service";

const prisma = new PrismaClient();

async function main() {
  console.info("Seeding DCMS synthetic demo baseline...");

  // 1. Permissions & System Roles
  const permMap = new Map<string, string>();
  for (const code of ALL_PERMISSIONS) {
    const [mod = "core"] = code.split(":");
    const p = await prisma.permission.upsert({
      where: { code },
      create: { code, module: mod, description: `Permission ${code}` },
      update: {},
    });
    permMap.set(code, p.id);
  }

  const roleDefs: Array<{
    code: SystemRoleCode;
    name: string;
    scope: "CONSULTANCY" | "PARTNER";
  }> = [
    { code: "SUPER_ADMIN", name: "Super Administrator", scope: "CONSULTANCY" },
    { code: "ADMIN", name: "Operations Administrator", scope: "CONSULTANCY" },
    { code: "RECEPTIONIST", name: "Front-Desk Receptionist", scope: "CONSULTANCY" },
    { code: "ACCOUNTANT", name: "Finance & Settlements Accountant", scope: "CONSULTANCY" },
    { code: "REPORT_MANAGER", name: "Report Coordinator", scope: "CONSULTANCY" },
    { code: "VIEWER_AUDITOR", name: "Read-Only Auditor", scope: "CONSULTANCY" },
    { code: "PARTNER_ADMIN", name: "Partner Centre Admin", scope: "PARTNER" },
    { code: "PARTNER_STAFF", name: "Partner Lab Staff", scope: "PARTNER" },
    { code: "PARTNER_REPORT_MANAGER", name: "Partner Report Uploader", scope: "PARTNER" },
  ];

  const roleIdByCode = new Map<SystemRoleCode, string>();
  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        scope: def.scope,
        isSystem: true,
      },
      update: { name: def.name },
    });
    roleIdByCode.set(def.code, role.id);

    for (const permCode of ROLE_PERMISSIONS[def.code]) {
      const permId = permMap.get(permCode);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: permId },
          },
          create: { roleId: role.id, permissionId: permId },
          update: {},
        });
      }
    }
  }

  // 2. System Chart of Accounts
  for (const acct of SYSTEM_ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { code: acct.code },
      create: acct,
      update: {},
    });
  }

  // 3. Organization & Conservative Safe Policy Defaults (Open Decisions Gate)
  const org = await prisma.organization.upsert({
    where: { code: "DEMO-APEX-DCMS" },
    create: {
      code: "DEMO-APEX-DCMS",
      legalName: "[DEMO] Apex Diagnostic Consultancy Pvt. Ltd.",
      displayName: "[DEMO] Apex Diagnostic Consultancy",
      registeredAddress: "204 Healthcare Chambers, Shivajinagar",
      city: "Pune",
      stateCode: "27",
      stateName: "Maharashtra",
      pincode: "411005",
      contactEmail: "billing@demo-diagnostics.example",
      contactPhone: "+912025550199",
      settings: {
        create: {
          defaultCommissionBasis: "UNCONFIGURED",
          requireConsultancyCompletionApproval: false,
          allowInvoiceOverpayment: false,
          partnerPatientPhoneVisibility: "MASKED",
          requireSettlementApproval: true,
          gstEnabled: false,
          invoiceDocumentTitle: "Invoice",
          staticQrFallbackEnabled: false,
          shareLinkDefaultTtlHours: 72,
          invoiceTermsText:
            "[DEMO] Subject to Pune jurisdiction. Diagnostic services fulfilled by assigned partner diagnostic centre.",
        },
      },
    },
    update: {},
  });

  // 4. Tax Codes (Configurable; Exempt clinical + Illustrative 18% intermediary SAC)
  const exemptTax = await prisma.taxCode.upsert({
    where: { code: "DIAG-EXEMPT" },
    create: {
      code: "DIAG-EXEMPT",
      name: "Clinical Diagnostic Service (Exempt — Verify with CA)",
      hsnSacCode: "999316",
      supplyCategory: "DIAGNOSTIC_SERVICE",
      cgstRate: "0.0000",
      sgstRate: "0.0000",
      igstRate: "0.0000",
      isExempt: true,
      effectiveFrom: new Date("2026-04-01"),
    },
    update: {},
  });

  await prisma.taxCode.upsert({
    where: { code: "COMM-GST-18" },
    create: {
      code: "COMM-GST-18",
      name: "Intermediary / Consultancy Service 18% (Verify with CA)",
      hsnSacCode: "998599",
      supplyCategory: "CONSULTANCY_COMMISSION",
      cgstRate: "9.0000",
      sgstRate: "9.0000",
      igstRate: "18.0000",
      isExempt: false,
      effectiveFrom: new Date("2026-04-01"),
    },
    update: {},
  });

  // 5. Demo Consultancy Users (Password: Demo#Erp2026!)
  const demoPasswordHash = await hashPassword("Demo#Erp2026!");

  const upsertDemoUser = async (params: {
    email: string;
    fullName: string;
    portalType: "CONSULTANCY" | "PARTNER";
    roleCode: SystemRoleCode;
  }) => {
    const roleId = roleIdByCode.get(params.roleCode)!;
    return prisma.user.upsert({
      where: { email: params.email },
      create: {
        email: params.email,
        fullName: params.fullName,
        passwordHash: demoPasswordHash,
        portalType: params.portalType,
        userRoles: { create: [{ roleId }] },
      },
      update: {},
    });
  };

  const superAdmin = await upsertDemoUser({
    email: "superadmin@demo-dcms.local",
    fullName: "[DEMO] Vikram Deshmukh (Super Admin)",
    portalType: "CONSULTANCY",
    roleCode: "SUPER_ADMIN",
  });
  await upsertDemoUser({
    email: "reception@demo-dcms.local",
    fullName: "[DEMO] Ananya Joshi (Receptionist)",
    portalType: "CONSULTANCY",
    roleCode: "RECEPTIONIST",
  });
  await upsertDemoUser({
    email: "accounts@demo-dcms.local",
    fullName: "[DEMO] Rohitulkarni (Accountant)",
    portalType: "CONSULTANCY",
    roleCode: "ACCOUNTANT",
  });

  // 6. Demo Partner Diagnostic Centres (Model A & Model B)
  const partnerA = await prisma.partner.upsert({
    where: { partnerCode: "PRT-METRO" },
    create: {
      partnerCode: "PRT-METRO",
      legalName: "[DEMO] Metro Advanced Scans & Labs LLP",
      displayName: "[DEMO] Metro Scans (Model A)",
      contactPerson: "Dr. Priya Nair",
      email: "ops@demo-metroscans.local",
      phone: "+912026661100",
      addressLine: "Plot 12, Kothrud Medical Hub",
      city: "Pune",
      stateCode: "27",
      stateName: "Maharashtra",
      pincode: "411038",
      defaultPaymentModel: "MODEL_A_CONSULTANCY_COLLECTS",
      paymentTermsDays: 15,
      isDemoData: true,
    },
    update: {},
  });

  const partnerB = await prisma.partner.upsert({
    where: { partnerCode: "PRT-STAR" },
    create: {
      partnerCode: "PRT-STAR",
      legalName: "[DEMO] Star Care Pathology & Imaging Pvt. Ltd.",
      displayName: "[DEMO] Star Care Diagnostics (Model B)",
      contactPerson: "Sameer Gokhale",
      email: "desk@demo-starcare.local",
      phone: "+912027772200",
      addressLine: "88 Baner High Street",
      city: "Pune",
      stateCode: "27",
      stateName: "Maharashtra",
      pincode: "411045",
      defaultPaymentModel: "MODEL_B_PATIENT_PAYS_PARTNER",
      paymentTermsDays: 30,
      isDemoData: true,
    },
    update: {},
  });

  // Partner Users (strictly isolated to their respective centres)
  const partnerAUser = await upsertDemoUser({
    email: "partner.metro@demo-dcms.local",
    fullName: "[DEMO] Priya Nair (Metro Partner Admin)",
    portalType: "PARTNER",
    roleCode: "PARTNER_ADMIN",
  });
  await prisma.partnerUser.upsert({
    where: { userId_partnerId: { userId: partnerAUser.id, partnerId: partnerA.id } },
    create: {
      userId: partnerAUser.id,
      partnerId: partnerA.id,
      partnerRole: "PARTNER_ADMIN",
      isPrimary: true,
    },
    update: {},
  });

  const partnerBUser = await upsertDemoUser({
    email: "partner.star@demo-dcms.local",
    fullName: "[DEMO] Sameer Gokhale (Star Partner Admin)",
    portalType: "PARTNER",
    roleCode: "PARTNER_ADMIN",
  });
  await prisma.partnerUser.upsert({
    where: { userId_partnerId: { userId: partnerBUser.id, partnerId: partnerB.id } },
    create: {
      userId: partnerBUser.id,
      partnerId: partnerB.id,
      partnerRole: "PARTNER_ADMIN",
      isPrimary: true,
    },
    update: {},
  });

  // Contracts
  await prisma.partnerContract.upsert({
    where: { contractNumber: "CNT-METRO-2026" },
    create: {
      partnerId: partnerA.id,
      contractNumber: "CNT-METRO-2026",
      allowedModels: "BOTH",
      commissionBasis: "NET_AFTER_DISCOUNT_EXCL_TAX",
      settlementCycle: "FORTNIGHTLY",
      effectiveFrom: new Date("2026-04-01"),
      createdById: superAdmin.id,
    },
    update: {},
  });

  await prisma.partnerContract.upsert({
    where: { contractNumber: "CNT-STAR-2026" },
    create: {
      partnerId: partnerB.id,
      contractNumber: "CNT-STAR-2026",
      allowedModels: "MODEL_B_ONLY",
      commissionBasis: "NET_AFTER_DISCOUNT_EXCL_TAX",
      settlementCycle: "MONTHLY",
      effectiveFrom: new Date("2026-04-01"),
      createdById: superAdmin.id,
    },
    update: {},
  });

  // 7. Test Categories, Tests & Package
  const radiology = await prisma.testCategory.upsert({
    where: { code: "RADIOLOGY" },
    create: { code: "RADIOLOGY", name: "Radiology & Imaging", sortOrder: 1 },
    update: {},
  });
  const pathology = await prisma.testCategory.upsert({
    where: { code: "PATHOLOGY" },
    create: { code: "PATHOLOGY", name: "Pathology & Biochemistry", sortOrder: 2 },
    update: {},
  });

  const mriBrain = await prisma.test.upsert({
    where: { code: "MRI-BRAIN" },
    create: {
      code: "MRI-BRAIN",
      name: "MRI Brain (Plain)",
      categoryId: radiology.id,
      defaultSellingPrice: "3500.00",
      turnaroundHours: 6,
      taxCodeId: exemptTax.id,
    },
    update: {},
  });

  const lipidProfile = await prisma.test.upsert({
    where: { code: "LIPID-01" },
    create: {
      code: "LIPID-01",
      name: "Complete Lipid Profile",
      categoryId: pathology.id,
      sampleType: "Fasting Serum",
      defaultSellingPrice: "1000.00",
      turnaroundHours: 12,
      taxCodeId: exemptTax.id,
    },
    update: {},
  });

  const cbcTest = await prisma.test.upsert({
    where: { code: "CBC-01" },
    create: {
      code: "CBC-01",
      name: "Complete Blood Count (CBC)",
      categoryId: pathology.id,
      sampleType: "EDTA Whole Blood",
      defaultSellingPrice: "500.00",
      turnaroundHours: 6,
      taxCodeId: exemptTax.id,
    },
    update: {},
  });

  const wellnessPkg = await prisma.testPackage.upsert({
    where: { code: "PKG-WELLNESS-BASIC" },
    create: {
      code: "PKG-WELLNESS-BASIC",
      name: "Preventive Blood Screening Package",
      defaultSellingPrice: "1300.00",
      taxCodeId: exemptTax.id,
    },
    update: {},
  });

  await prisma.testPackageItem.upsert({
    where: { packageId_testId: { packageId: wellnessPkg.id, testId: lipidProfile.id } },
    create: { packageId: wellnessPkg.id, testId: lipidProfile.id, quantity: 1, allocationWeight: "2.0000" },
    update: {},
  });
  await prisma.testPackageItem.upsert({
    where: { packageId_testId: { packageId: wellnessPkg.id, testId: cbcTest.id } },
    create: { packageId: wellnessPkg.id, testId: cbcTest.id, quantity: 1, allocationWeight: "1.0000" },
    update: {},
  });

  // Negotiated Partner Prices (Partner A) & Commission Rate (Partner B)
  const existingPricesCount = await prisma.partnerTestPrice.count({
    where: { partnerId: partnerA.id },
  });
  if (existingPricesCount === 0) {
    await prisma.partnerTestPrice.createMany({
      data: [
        {
          partnerId: partnerA.id,
          testId: mriBrain.id,
          agreedPurchasePrice: "2450.00",
          effectiveFrom: new Date("2026-04-01"),
          createdById: superAdmin.id,
        },
        {
          partnerId: partnerA.id,
          testId: lipidProfile.id,
          agreedPurchasePrice: "650.00",
          effectiveFrom: new Date("2026-04-01"),
          createdById: superAdmin.id,
        },
        {
          partnerId: partnerA.id,
          testId: cbcTest.id,
          agreedPurchasePrice: "300.00",
          effectiveFrom: new Date("2026-04-01"),
          createdById: superAdmin.id,
        },
      ],
    });
  }

  const existingCommCount = await prisma.partnerCommissionRate.count({
    where: { partnerId: partnerB.id },
  });
  if (existingCommCount === 0) {
    await prisma.partnerCommissionRate.create({
      data: {
        partnerId: partnerB.id,
        testId: null,
        commissionPercentage: "15.0000",
        calculationBasis: "NET_AFTER_DISCOUNT_EXCL_TAX",
        effectiveFrom: new Date("2026-04-01"),
        createdById: superAdmin.id,
      },
    });
  }

  // 8. Synthetic Demo Patient + matching sequence counter so next patient gets PAT-YYYY-00002
  const currentYear = String(new Date().getUTCFullYear());
  const demoPatientCode = `PAT-${currentYear}-00001`;
  await prisma.patient.upsert({
    where: { patientCode: demoPatientCode },
    create: {
      patientCode: demoPatientCode,
      fullName: "[DEMO] Aarav Kulkarni",
      mobile: "+919000000101",
      gender: "MALE",
      ageYearsSnapshot: 39,
      city: "Pune",
      state: "Maharashtra",
      isDemoData: true,
      createdById: superAdmin.id,
    },
    update: {},
  });

  await prisma.invoiceSequence.upsert({
    where: {
      organizationId_docType_financialYear: {
        organizationId: org.id,
        docType: "PATIENT",
        financialYear: currentYear,
      },
    },
    create: {
      organizationId: org.id,
      docType: "PATIENT",
      financialYear: currentYear,
      prefix: `PAT-${currentYear}-`,
      currentValue: 1,
      paddingLength: 5,
    },
    update: {},
  });

  console.info(`Seed completed for organization: ${org.displayName}`);
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

