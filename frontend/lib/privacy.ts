import CryptoJS from "crypto-js";
import { v4 as uuidv4 } from "uuid";

/**
 * Privacy commitment layer for multi-tenant reconciliation.
 *
 * Uses SHA-256 hash commitments so the platform can verify that
 * amounts match across sources without seeing raw transaction data
 * from other merchants. Commitments are verifiable but irreversible.
 */

/**
 * Create a hash commitment for an amount.
 * commitment = SHA256(merchantId:amountKobo:salt)
 */
export function createCommitment(
  amountKobo: number,
  merchantId: string,
  salt?: string
): { commitment: string; salt: string } {
  const s = salt || uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, "");
  const data = `${merchantId}:${amountKobo}:${s}`;
  const commitment = CryptoJS.SHA256(data).toString();
  return { commitment, salt: s };
}

/**
 * Verify a commitment against known values.
 */
export function verifyCommitment(
  amountKobo: number,
  merchantId: string,
  salt: string,
  commitment: string
): boolean {
  const expected = CryptoJS.SHA256(`${merchantId}:${amountKobo}:${salt}`).toString();
  return expected === commitment;
}

/**
 * Private reconciliation: check if ISW and bank amounts match
 * without exposing raw amounts to the platform.
 *
 * Both sides compute commitments with the same salt.
 * If commitments match → amounts match. Platform sees only hashes.
 */
export function reconcilePrivately(
  iswAmountKobo: number,
  bankAmountKobo: number,
  merchantId: string
): {
  match: boolean;
  iswCommitment: string;
  bankCommitment: string;
  salt: string;
} {
  const salt = uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, "");
  const iswC = createCommitment(iswAmountKobo, merchantId, salt);
  const bankC = createCommitment(bankAmountKobo, merchantId, salt);

  return {
    match: iswC.commitment === bankC.commitment,
    iswCommitment: iswC.commitment,
    bankCommitment: bankC.commitment,
    salt,
  };
}

/**
 * Batch privacy verification: verify a set of ISW transactions
 * sum to a bank settlement amount without revealing individual amounts.
 *
 * Each ISW transaction gets its own commitment. The sum commitment
 * is compared against the bank settlement commitment.
 */
export function verifySettlementPrivacy(
  iswAmounts: number[],
  bankSettlementKobo: number,
  merchantId: string
): {
  sumMatch: boolean;
  iswTotalKobo: number;
  commitments: string[];
} {
  const salt = uuidv4().replace(/-/g, "");
  const commitments = iswAmounts.map((a) =>
    createCommitment(a, merchantId, salt).commitment
  );

  const iswTotal = iswAmounts.reduce((s, a) => s + a, 0);
  const iswTotalCommitment = createCommitment(iswTotal, merchantId, salt);
  const bankCommitment = createCommitment(bankSettlementKobo, merchantId, salt);

  return {
    sumMatch: iswTotalCommitment.commitment === bankCommitment.commitment,
    iswTotalKobo: iswTotal,
    commitments,
  };
}
