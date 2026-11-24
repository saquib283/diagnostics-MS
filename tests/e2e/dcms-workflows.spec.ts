import { test, expect } from "@playwright/test";

test.describe("DCMS Healthcare ERP End-to-End Browser Workflows", () => {
  test("Login page renders accessible healthcare ERP sign-in form with autofill & password toggle, and guards protected portals", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Sign in to DCMS" }),
    ).toBeVisible();

    const emailInput = page.getByLabel(/Work email/i);
    await expect(emailInput).toHaveAttribute("autocomplete", "username");
    await expect(emailInput).toHaveAttribute("required", "");

    const pwdInput = page.getByLabel(/^Password/i);
    await expect(pwdInput).toHaveAttribute("autocomplete", "current-password");
    await expect(pwdInput).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: /Show password/i }).click();
    await expect(pwdInput).toHaveAttribute("type", "text");

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/partner/orders");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Verifies pixel-exact table header right-alignment, multi-column form input baselines, and mobile nav drawer", async ({
    page,
  }) => {
    const hydrationOrPageErrors: string[] = [];
    page.on("pageerror", (err) => hydrationOrPageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" && /hydration|did not match/i.test(msg.text())) {
        hydrationOrPageErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.getByLabel(/Work email/i).fill("superadmin@demo-dcms.local");
    await page.getByLabel(/^Password/i).fill("Demo#Erp2026!");
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // 1. Right-aligned table headers must match right-aligned numeric cells (CSS @layer components check)
    const balanceTh = page.getByRole("columnheader", { name: "Balance Due" });
    const thTextAlign = await balanceTh.evaluate(
      (el) => window.getComputedStyle(el).textAlign,
    );
    expect(thTextAlign).toBe("right");

    // 2. Patient Registration multi-column form: top Y coordinates & 36px heights must align even when Mobile has a hint
    await page.goto("/admin/patients");
    const nameBox = (await page.locator("#pat-fullname").boundingBox())!;
    const mobileBox = (await page.locator("#pat-mobile").boundingBox())!;
    const ageBox = (await page.locator("#pat-age").boundingBox())!;
    expect(Math.abs(nameBox.y - mobileBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(mobileBox.y - ageBox.y)).toBeLessThanOrEqual(1);

    const emailBox = (await page.locator("#pat-email").boundingBox())!;
    const cityBox = (await page.locator("#pat-city").boundingBox())!;
    const genderRadioBar = (await page
      .locator("#gender-MALE")
      .locator("..")
      .locator("..")
      .boundingBox())!;
    expect(Math.abs(genderRadioBar.y - emailBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(genderRadioBar.height - emailBox.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(emailBox.y - cityBox.y)).toBeLessThanOrEqual(1);

    // 3. Order Builder multi-column form: Patient & Partner selects align cleanly despite Partner hint
    await page.goto("/admin/orders/new");
    const patSelectBox = (await page.locator("#ord-patient").boundingBox())!;
    const prtSelectBox = (await page.locator("#ord-partner").boundingBox())!;
    expect(Math.abs(patSelectBox.y - prtSelectBox.y)).toBeLessThanOrEqual(1);

    // 4. Mobile viewport (390x844): sidebar collapses into drawer so main heading stays above the fold
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/dashboard");
    const sidebar = page.locator("#primary-sidebar-nav");
    await expect(sidebar).toBeHidden();

    const h1Box = (await page.locator("h1#main-content").boundingBox())!;
    expect(h1Box.y).toBeLessThan(150);

    await page.getByRole("button", { name: /Open navigation menu/i }).click();
    await expect(sidebar).toBeVisible();

    expect(hydrationOrPageErrors).toEqual([]);
  });

  test("End-to-end Model A patient registration, order creation, split payments, share link revocation, Partner A fulfilment & Partner B isolation", async ({
    browser,
    page,
  }) => {
    test.setTimeout(90_000);

    // 1. Sign in to Consultancy Admin Portal
    await page.goto("/login");
    await page.getByLabel(/Work email/i).fill("superadmin@demo-dcms.local");
    await page.getByLabel(/^Password/i).fill("Demo#Erp2026!");
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // 2. Register a synthetic patient (+91 string mobile preserved)
    const uniqueSuffix = String(Date.now()).slice(-4);
    const patientName = `[DEMO] Ananya Deshpande ${uniqueSuffix}`;
    const patientMobile = `+91982299${uniqueSuffix}`;

    await page.goto("/admin/patients");
    await page.getByLabel(/Patient full name/i).fill(patientName);
    await page.getByLabel(/Mobile number/i).fill(patientMobile);
    await page.getByLabel(/Age \(Years\)/i).fill("29");
    await page
      .getByRole("button", { name: /Save & Open Patient Record/i })
      .click();

    await expect(page).toHaveURL(/\/admin\/patients\/[0-9a-f-]+/);
    await expect(
      page.getByRole("heading", { name: new RegExp(patientName.replace(/[[\]]/g, "\\$&")) }),
    ).toBeVisible();
    await expect(page.getByText(patientMobile).first()).toBeVisible();
    const patientId = page.url().split("/admin/patients/")[1]!;

    // 3. Create a single-partner Model A order (₹5,000 = ₹3,500 MRI-BRAIN + 3 x ₹500 CBC-01)
    await page.goto(`/admin/orders/new?patientId=${patientId}`);
    const metroOptionValue = await page
      .locator("#ord-partner option", { hasText: "PRT-METRO" })
      .getAttribute("value");
    await page.locator("#ord-partner").selectOption(metroOptionValue!);

    const mriOptionValue = await page
      .locator("#line-target-0 option", { hasText: "MRI-BRAIN" })
      .getAttribute("value");
    await page.locator("#line-target-0").selectOption(mriOptionValue!);

    await page.getByRole("button", { name: /Add Test/i }).click();
    const cbcOptionValue = await page
      .locator("#line-target-1 option", { hasText: "CBC-01" })
      .getAttribute("value");
    await page.locator("#line-target-1").selectOption(cbcOptionValue!);
    await page.locator("#line-qty-1").fill("3");

    await page
      .getByRole("button", { name: /Create Diagnostic Order & Snapshot Rates/i })
      .click();

    await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]+/);
    const orderId = page.url().split("/admin/orders/")[1]!;

    // 4. Issue Immutable Consultancy Invoice (Model A)
    await page
      .getByRole("button", {
        name: /Issue Immutable Consultancy Invoice \(Model A\)/i,
      })
      .click();

    await expect(page).toHaveURL(/\/admin\/invoices\/[0-9a-f-]+/);
    await expect(page.getByText("₹5,000.00").first()).toBeVisible();

    // 5. Mandatory Split Payments: ₹2,000 Cash + ₹3,000 Bank Transfer
    await page.locator("#split-pay-amount").fill("2000.00");
    await page.locator("#split-pay-ref").fill("COUNTER-CASH-01");
    await page
      .getByRole("button", { name: /Record ₹2000\.00 Collection/i })
      .click();

    await expect(
      page.getByText(/Remaining balance: ₹3000\.00/i),
    ).toBeVisible();

    await page.locator("#pay-mode-BANK_TRANSFER").check();
    await page.locator("#split-pay-amount").fill("3000.00");
    await page.locator("#split-pay-ref").fill("NEFT-UTR-889900");
    await page
      .getByRole("button", { name: /Record ₹3000\.00 Collection/i })
      .click();

    await expect(
      page.getByText(/This invoice has ₹0\.00 balance due/i),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Receipt PDF" })).toHaveCount(2);

    // Verify Invoice PDF endpoint returns real %PDF- bytes
    const invoiceId = page.url().split("/admin/invoices/")[1]!;
    const pdfRes = await page.request.get(`/api/v1/invoices/${invoiceId}/pdf`);
    expect(pdfRes.status()).toBe(200);
    const pdfBuf = await pdfRes.body();
    expect(pdfBuf.subarray(0, 5).toString("ascii")).toBe("%PDF-");

    // 6. Generate Secure Expiring Share Link & Verify Immediate Revocation
    await page.getByRole("button", { name: /Share Document/i }).click();
    const shareLinkLocator = page.locator("div.font-mono-code", {
      hasText: "/d/",
    });
    await expect(shareLinkLocator).toBeVisible();
    const fullShareUrl = (await shareLinkLocator.textContent())!.trim();
    const sharePath = new URL(fullShareUrl).pathname;

    const publicCtx = await browser.newContext();
    const publicPage = await publicCtx.newPage();
    await publicPage.goto(sharePath);
    await expect(
      publicPage.getByRole("link", { name: /View \/ Download Document/i }),
    ).toBeVisible();

    // Revoke link from Admin Invoice page
    await page.getByRole("button", { name: /Revoke Link/i }).first().click();
    await expect(page.getByText("Revoked").first()).toBeVisible();

    await publicPage.reload();
    await expect(
      publicPage.getByText(/expired or has been revoked/i).first(),
    ).toBeVisible();
    await publicCtx.close();

    // 7. Partner A (Metro Scans) Portal — Masked Phone, Zero Selling Prices, Status Update & PDF Upload
    const partnerACtx = await browser.newContext();
    const partnerAPage = await partnerACtx.newPage();
    await partnerAPage.goto("/login");
    await partnerAPage
      .getByLabel(/Work email/i)
      .fill("partner.metro@demo-dcms.local");
    await partnerAPage.getByLabel(/^Password/i).fill("Demo#Erp2026!");
    await partnerAPage.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(partnerAPage).toHaveURL(/\/partner\/dashboard/);

    await partnerAPage.goto(`/partner/orders/${orderId}`);
    await expect(
      partnerAPage.getByText(`+91******${uniqueSuffix}`).first(),
    ).toBeVisible();

    // Ensure consultancy selling price (₹3,500.00 / ₹5,000.00) is never rendered to Partner
    const partnerBodyText = await partnerAPage.locator("body").innerText();
    expect(partnerBodyText).not.toContain("3,500.00");
    expect(partnerBodyText).not.toContain("5,000.00");

    // Transition MRI-BRAIN item PENDING -> IN_PROGRESS -> COMPLETED and upload valid PDF report
    const mriRow = partnerAPage.getByRole("row", { name: /MRI-BRAIN/i });
    const mriStatusSelect = mriRow.getByLabel("Select next test status");
    await mriStatusSelect.selectOption("IN_PROGRESS");
    await mriRow.getByRole("button", { name: "Apply" }).click();
    await expect(
      mriRow.getByRole("cell", { name: "IN PROGRESS", exact: true }),
    ).toBeVisible();

    await mriStatusSelect.selectOption("COMPLETED");
    await mriRow.getByRole("button", { name: "Apply" }).click();
    await expect(
      mriRow.getByRole("cell", { name: "COMPLETED", exact: true }),
    ).toBeVisible();

    const fileInput = mriRow.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "MRI_Brain_Report.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\n%Playwright E2E Report\n%%EOF", "utf8"),
    });
    await expect(
      partnerAPage.getByRole("link", { name: /v1 \(MRI_Brain_Report\.pdf\)/i }),
    ).toBeVisible();
    await partnerACtx.close();

    // 8. Partner B (Star Care) Cross-Tenant Isolation — Cannot access Partner A order or see patient
    const partnerBCtx = await browser.newContext();
    const partnerBPage = await partnerBCtx.newPage();
    await partnerBPage.goto("/login");
    await partnerBPage
      .getByLabel(/Work email/i)
      .fill("partner.star@demo-dcms.local");
    await partnerBPage.getByLabel(/^Password/i).fill("Demo#Erp2026!");
    await partnerBPage.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(partnerBPage).toHaveURL(/\/partner\/dashboard/);

    const crossProbe = await partnerBPage.request.get(
      `/api/v1/partner/orders/${orderId}`,
    );
    expect(crossProbe.status()).toBe(404);

    await partnerBPage.goto("/partner/orders");
    await expect(partnerBPage.getByText(patientName)).toHaveCount(0);
    await partnerBCtx.close();
  });
});
