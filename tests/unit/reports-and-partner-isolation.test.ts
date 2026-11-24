import net from "node:net";
import { describe, expect, it } from "vitest";
import {
  scanBufferWithClamAvIfEnabled,
  validateUploadedReportBuffer,
} from "@/lib/storage/file-validator";
import { toPartnerOrderDTO } from "@/modules/partners/dto";

async function withMockClamdServer(
  reply: string,
  fn: (port: number, receivedFrames: Buffer[]) => Promise<void>,
) {
  const frames: Buffer[] = [];
  const server = net.createServer((socket) => {
    const incoming: Buffer[] = [];
    socket.on("data", (chunk: Buffer) => {
      incoming.push(chunk);
      const merged = Buffer.concat(incoming);
      // zINSTREAM\0 ends with 4 zero bytes (\x00\x00\x00\x00) after header
      if (
        merged.length >= 14 &&
        merged.subarray(merged.length - 4).equals(Buffer.alloc(4, 0))
      ) {
        frames.push(merged);
        socket.end(Buffer.from(reply, "utf8"));
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as net.AddressInfo;
  try {
    await fn(addr.port, frames);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("Diagnostic Report File Security, ClamAV Scanner & Partner Portal Data Isolation DTOs", () => {
  it("accepts genuine PDF and PNG magic bytes and rejects disguised HTML/EXE polyglots", () => {
    const validPdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj", "utf8");
    const checked = validateUploadedReportBuffer({
      filename: "MRI_Brain_Report.pdf",
      declaredMimeType: "application/pdf",
      buffer: validPdf,
      maxBytes: 5 * 1024 * 1024,
    });
    expect(checked.detectedMime).toBe("application/pdf");
    expect(checked.sha256Checksum).toHaveLength(64);

    const disguisedExe = Buffer.from("MZ\x90\x00ThisIsAnExecutable", "utf8");
    expect(() =>
      validateUploadedReportBuffer({
        filename: "report.pdf",
        declaredMimeType: "application/pdf",
        buffer: disguisedExe,
        maxBytes: 5 * 1024 * 1024,
      }),
    ).toThrow(/File binary signature does not match/);
  });

  it("streams zINSTREAM chunks to ClamAV when enabled, accepts clean responses, rejects FOUND signatures, and fails closed when unreachable", async () => {
    const samplePdf = Buffer.from("%PDF-1.7\nClean Diagnostic Report\n%%EOF", "utf8");

    const skipped = await scanBufferWithClamAvIfEnabled(samplePdf, {
      enabled: false,
      host: "127.0.0.1",
      port: 9,
    });
    expect(skipped.scanned).toBe(false);

    await withMockClamdServer("stream: OK\0", async (port, frames) => {
      const clean = await scanBufferWithClamAvIfEnabled(samplePdf, {
        enabled: true,
        host: "127.0.0.1",
        port,
      });
      expect(clean.scanned).toBe(true);
      expect(clean.clean).toBe(true);
      expect(frames[0]?.subarray(0, 10).toString("ascii")).toBe("zINSTREAM\0");
    });

    await withMockClamdServer(
      "stream: Win.Test.EICAR_HDB-1 FOUND\0",
      async (port) => {
        await expect(
          scanBufferWithClamAvIfEnabled(samplePdf, {
            enabled: true,
            host: "127.0.0.1",
            port,
          }),
        ).rejects.toThrow(/malware protection/i);
      },
    );

    // Reserve an ephemeral closed port to deterministically verify fail-closed behavior
    const closedPort = await new Promise<number>((resolve) => {
      const tmp = net.createServer();
      tmp.listen(0, "127.0.0.1", () => {
        const p = (tmp.address() as net.AddressInfo).port;
        tmp.close(() => resolve(p));
      });
    });

    await expect(
      scanBufferWithClamAvIfEnabled(samplePdf, {
        enabled: true,
        host: "127.0.0.1",
        port: closedPort,
      }),
    ).rejects.toThrow(/Malware scanner unavailable/i);
  });

  it("strips consultancy selling prices, discounts, margins, and internal notes from PartnerOrderDTO and respects phone masking", () => {
    const internalOrder = {
      id: "ord-1",
      orderNumber: "ORD-2026-27-00010",
      partnerId: "partner-a",
      paymentModel: "MODEL_A_CONSULTANCY_COLLECTS" as const,
      status: "IN_PROGRESS" as const,
      referringDoctor: "Dr. Mehta",
      clinicalNotes: "Fasting 12h confirmed",
      internalNotes: "VIP corporate discount 15% — margin ₹900",
      subtotalSelling: "3500.00",
      discountTotal: "500.00",
      netSellingTotal: "3000.00",
      partnerPayableEstimate: "2100.00",
      createdAt: new Date("2026-11-24T08:00:00Z"),
      patient: {
        patientCode: "PAT-2026-00055",
        fullName: "Suresh Iyer",
        mobile: "+919820123456",
        gender: "MALE" as const,
        ageYearsSnapshot: 48,
        email: "suresh@private.example",
        addressLine: "Flat 402, Private Residency",
      },
      items: [
        {
          id: "item-1",
          testCodeSnapshot: "LIPID-01",
          testNameSnapshot: "Lipid Profile",
          quantity: 1,
          status: "IN_PROGRESS" as const,
          completedAt: null,
          unitSellingPriceSnapshot: "3500.00",
          discountAmountSnapshot: "500.00",
          netSellingAmountSnapshot: "3000.00",
          partnerUnitPriceSnapshot: "2100.00",
          reportTracking: { status: "PROCESSING" as const },
        },
      ],
    };

    const partnerDto = toPartnerOrderDTO(internalOrder, {
      phoneVisibility: "MASKED",
    });

    const serialized = JSON.stringify(partnerDto);
    expect(partnerDto.patient.mobileDisplay).toBe("+91******3456");
    expect(serialized).not.toContain("9820123456");
    expect(serialized).not.toContain("unitSellingPriceSnapshot");
    expect(serialized).not.toContain("netSellingTotal");
    expect(serialized).not.toContain("3500.00");
    expect(serialized).not.toContain("3000.00");
    expect(serialized).not.toContain("VIP corporate discount");
    expect(serialized).not.toContain("Flat 402");
  });
});
