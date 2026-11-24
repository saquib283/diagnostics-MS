import { createHash } from "node:crypto";
import net from "node:net";
import path from "node:path";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export type AllowedReportMime = "application/pdf" | "image/jpeg" | "image/png";

const EXTENSION_MIME_MAP: Record<string, AllowedReportMime> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function detectMagicByteMime(buf: Buffer): AllowedReportMime | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

export function sanitizeDisplayFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.\-() ]+/g, "_").trim();
  return base.slice(0, 180) || "document.pdf";
}

export function validateUploadedReportBuffer(params: {
  filename: string;
  declaredMimeType?: string | null;
  buffer: Buffer;
  maxBytes: number;
}): {
  detectedMime: AllowedReportMime;
  sanitizedFilename: string;
  sha256Checksum: string;
  fileSizeBytes: number;
} {
  if (params.buffer.length === 0) {
    throw new AppError("BAD_REQUEST", "Uploaded file cannot be empty.", 400);
  }
  if (params.buffer.length > params.maxBytes) {
    throw new AppError(
      "BAD_REQUEST",
      `File exceeds maximum allowed size of ${Math.round(params.maxBytes / (1024 * 1024))} MB.`,
      400,
    );
  }

  const ext = path.extname(params.filename).toLowerCase();
  const expectedByExt = EXTENSION_MIME_MAP[ext];
  if (!expectedByExt) {
    throw new AppError(
      "BAD_REQUEST",
      "Unsupported file extension. Allowed formats: PDF, JPG, JPEG, PNG.",
      400,
    );
  }

  const detectedMime = detectMagicByteMime(params.buffer);
  if (!detectedMime || detectedMime !== expectedByExt) {
    throw new AppError(
      "BAD_REQUEST",
      "File binary signature does not match an allowed PDF, JPEG, or PNG format.",
      400,
    );
  }

  if (
    params.declaredMimeType &&
    params.declaredMimeType !== "application/octet-stream" &&
    params.declaredMimeType !== detectedMime
  ) {
    throw new AppError(
      "BAD_REQUEST",
      `Declared MIME type (${params.declaredMimeType}) conflicts with file signature (${detectedMime}).`,
      400,
    );
  }

  const sha256Checksum = createHash("sha256")
    .update(params.buffer)
    .digest("hex");

  return {
    detectedMime,
    sanitizedFilename: sanitizeDisplayFilename(params.filename),
    sha256Checksum,
    fileSizeBytes: params.buffer.length,
  };
}

/**
 * Streams a buffer to a ClamAV daemon (`clamd`) using the `zINSTREAM\0` protocol
 * when `CLAMAV_ENABLED=true`. Rejects infected payloads (`FOUND`) and fails closed
 * if scanning is explicitly enabled in configuration but `clamd` is unreachable.
 */
export async function scanBufferWithClamAvIfEnabled(
  buffer: Buffer,
  overrideConfig?: { enabled: boolean; host: string; port: number },
): Promise<{ scanned: boolean; clean: boolean; rawResponse?: string }> {
  const env = getEnv();
  const enabled = overrideConfig?.enabled ?? Boolean(env.CLAMAV_ENABLED);
  if (!enabled) {
    return { scanned: false, clean: true };
  }

  const host = overrideConfig?.host ?? env.CLAMAV_HOST;
  const port = overrideConfig?.port ?? env.CLAMAV_PORT;

  const responseText = await new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    socket.setTimeout(10_000);

    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0", "ascii"));
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const slice = buffer.subarray(offset, offset + chunkSize);
        const lenHeader = Buffer.alloc(4);
        lenHeader.writeUInt32BE(slice.length, 0);
        socket.write(lenHeader);
        socket.write(slice);
      }
      const endHeader = Buffer.alloc(4);
      endHeader.writeUInt32BE(0, 0);
      socket.write(endHeader);
    });

    socket.on("data", (data: Buffer) => chunks.push(data));
    socket.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim());
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new AppError("INTERNAL_ERROR", "Malware scan timed out.", 503));
    });
    socket.on("error", (err) => {
      reject(
        new AppError(
          "INTERNAL_ERROR",
          `Malware scanner unavailable: ${err.message}`,
          503,
        ),
      );
    });
  });

  if (responseText.includes("FOUND")) {
    throw new AppError(
      "BAD_REQUEST",
      "Uploaded file was rejected by malware protection.",
      400,
    );
  }
  if (!responseText.endsWith("OK")) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Unexpected malware scanner response: ${responseText}`,
      502,
    );
  }

  return { scanned: true, clean: true, rawResponse: responseText };
}
