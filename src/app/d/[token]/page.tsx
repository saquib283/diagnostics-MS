import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/db/sequences";

export const dynamic = "force-dynamic";

export default async function PublicSharedDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = sha256Hex(token.trim());
  const record = await db.documentShareToken.findUnique({
    where: { tokenHash },
  });

  const isExpiredOrRevoked =
    !record ||
    Boolean(record.revokedAt) ||
    record.expiresAt <= new Date() ||
    (record.maxViews !== null && record.viewCount >= record.maxViews);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-lg rounded-[6px] border border-[#CBD5E1] bg-white p-6 space-y-4">
        <div className="flex items-center gap-2 text-[#1B365D]">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-[#0F172A] m-0">
            Secure Patient Document Access
          </h1>
        </div>

        {isExpiredOrRevoked ? (
          <div
            role="alert"
            className="rounded-[4px] border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-sm text-[#991B1B]"
          >
            This secure document link has expired or has been revoked. Contact the diagnostic consultancy reception for an updated link.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#334155] m-0">
              Document Type:{" "}
              <strong className="font-semibold text-[#0F172A]">
                {record.resourceType}
              </strong>
            </p>
            <p className="text-xs text-[#475569] m-0">
              Link valid until:{" "}
              <span className="tabular-nums">{record.expiresAt.toUTCString()}</span>
            </p>
            <div className="pt-2">
              <Link
                href={`/api/v1/public/documents/${encodeURIComponent(token)}`}
                className="inline-flex h-9 items-center gap-2 rounded-[4px] bg-[#1B365D] px-4 text-sm font-medium text-white no-underline hover:bg-[#122644]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>View / Download Document</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
