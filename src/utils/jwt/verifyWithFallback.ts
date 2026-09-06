import jwt, { VerifyOptions } from 'jsonwebtoken';

export function verifyWithOptionalLegacySecret(
  token: string,
  primarySecret: string,
  legacySecret?: string,
  options?: VerifyOptions
): unknown {
  try {
    return jwt.verify(token, primarySecret, options);
  } catch (primaryError) {
    if (
      !(primaryError instanceof jwt.JsonWebTokenError) ||
      primaryError instanceof jwt.TokenExpiredError ||
      !legacySecret ||
      legacySecret === primarySecret
    ) {
      throw primaryError;
    }

    return jwt.verify(token, legacySecret, options);
  }
}
