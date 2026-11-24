import nodemailer from "nodemailer";
import { DeliveryStatus, ShareChannel } from "@prisma/client";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { maskIndianMobile } from "@/lib/permissions/scope";

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
}

export interface NotificationDispatchResult {
  status: DeliveryStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  destinationMasked: string;
}

/**
 * Approved WhatsApp Business Cloud API adapter + honest unconfigured fallback.
 * NEVER fakes delivery when WHATSAPP_PROVIDER=disabled.
 * NEVER sends clinical/medical findings in plain text notifications.
 */
export async function sendWhatsAppTemplateNotification(params: {
  recipientMobile: string;
  templateName: string;
  bodyVariables: readonly string[];
  eventType: string;
  referenceType: string;
  referenceId: string;
}): Promise<NotificationDispatchResult> {
  const env = getEnv();
  const destinationMasked = maskIndianMobile(params.recipientMobile);

  if (
    env.WHATSAPP_PROVIDER === "disabled" ||
    !env.WHATSAPP_PHONE_NUMBER_ID ||
    !env.WHATSAPP_ACCESS_TOKEN
  ) {
    await db.notificationLog.create({
      data: {
        channel: ShareChannel.WHATSAPP,
        eventType: params.eventType,
        recipientMasked: destinationMasked,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        status: DeliveryStatus.PROVIDER_NOT_CONFIGURED,
        errorMessage:
          "WhatsApp Business provider is not configured in environment variables.",
      },
    });
    return {
      status: DeliveryStatus.PROVIDER_NOT_CONFIGURED,
      destinationMasked,
      errorMessage: "WhatsApp Business provider is not configured.",
    };
  }

  try {
    const cleanDigits = params.recipientMobile.replace(/[^\d]/g, "");
    const endpoint = `${env.WHATSAPP_API_BASE_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanDigits,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: params.bodyVariables.map((text) => ({
                type: "text",
                text,
              })),
            },
          ],
        },
      }),
    });

    const body = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const errMsg = body.error?.message ?? `HTTP ${response.status}`;
      await db.notificationLog.create({
        data: {
          channel: ShareChannel.WHATSAPP,
          eventType: params.eventType,
          recipientMasked: destinationMasked,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          status: DeliveryStatus.FAILED,
          errorMessage: errMsg,
        },
      });
      return {
        status: DeliveryStatus.FAILED,
        destinationMasked,
        errorMessage: errMsg,
      };
    }

    const messageId = body.messages?.[0]?.id ?? null;
    await db.notificationLog.create({
      data: {
        channel: ShareChannel.WHATSAPP,
        eventType: params.eventType,
        recipientMasked: destinationMasked,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        providerMessageId: messageId,
        status: DeliveryStatus.SENT,
      },
    });
    return {
      status: DeliveryStatus.SENT,
      providerMessageId: messageId,
      destinationMasked,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "WhatsApp request failed";
    await db.notificationLog.create({
      data: {
        channel: ShareChannel.WHATSAPP,
        eventType: params.eventType,
        recipientMasked: destinationMasked,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        status: DeliveryStatus.FAILED,
        errorMessage: errMsg,
      },
    });
    return { status: DeliveryStatus.FAILED, destinationMasked, errorMessage: errMsg };
  }
}

export async function sendTransactionalEmail(params: {
  recipientEmail: string;
  subject: string;
  textBody: string;
  eventType: string;
  referenceType: string;
  referenceId: string;
}): Promise<NotificationDispatchResult> {
  const env = getEnv();
  const destinationMasked = maskEmail(params.recipientEmail);

  if (env.EMAIL_PROVIDER === "disabled" || !env.SMTP_HOST) {
    await db.notificationLog.create({
      data: {
        channel: ShareChannel.EMAIL,
        eventType: params.eventType,
        recipientMasked: destinationMasked,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        status: DeliveryStatus.PROVIDER_NOT_CONFIGURED,
        errorMessage: "SMTP email provider is not configured.",
      },
    });
    return {
      status: DeliveryStatus.PROVIDER_NOT_CONFIGURED,
      destinationMasked,
      errorMessage: "Email provider is not configured.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: Boolean(env.SMTP_SECURE),
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
    });

    const info = await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`,
      to: params.recipientEmail,
      subject: params.subject,
      text: params.textBody,
    });

    await db.notificationLog.create({
      data: {
        channel: ShareChannel.EMAIL,
        eventType: params.eventType,
        recipientMasked: destinationMasked,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        providerMessageId: info.messageId,
        status: DeliveryStatus.SENT,
      },
    });

    return {
      status: DeliveryStatus.SENT,
      providerMessageId: info.messageId,
      destinationMasked,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Email send failed";
    await db.notificationLog.create({
      data: {
        channel: ShareChannel.EMAIL,
        eventType: params.eventType,
        recipientMasked: destinationMasked,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        status: DeliveryStatus.FAILED,
        errorMessage: errMsg,
      },
    });
    return { status: DeliveryStatus.FAILED, destinationMasked, errorMessage: errMsg };
  }
}

