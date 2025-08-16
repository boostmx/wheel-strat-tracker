import bcrypt from "bcrypt";

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hashed?: string | null) {
  if (!hashed) return false;
  return bcrypt.compare(plain, hashed);
}
