import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scryptCb);
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export async function hashPassword(plainPassword: string): Promise<string> {
  if (plainPassword.length < 8 || plainPassword.length > 256) {
    throw new Error("Password must be between 8 and 256 characters");
  }
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(plainPassword, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  plainPassword: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = parts[4];
  const expectedHex = parts[5];
  if (!salt || !expectedHex) {
    return false;
  }
  const expectedBuffer = Buffer.from(expectedHex, "hex");
  const derived = (await scryptAsync(plainPassword, salt, expectedBuffer.length)) as Buffer;
  if (derived.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(derived, expectedBuffer);
}

