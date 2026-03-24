# Phantom Wallet: Domain and Transaction Warnings

If Phantom shows **"Request blocked"** or **"This dApp could be malicious"** on your deployed domain (e.g. `swap.circuitx.live`), it usually means Phantom cannot safely simulate the transaction before signing.

## What We've Implemented

Per [Phantom’s guidance](https://docs.phantom.com/developer-powertools/blocklist#transaction-simulation-warning):

- **Simulate before signing** – For every transaction that Phantom signs (deposits, funding ephemeral), we run `connection.simulateTransaction(tx, { sigVerify: false })` **before** calling `signTransaction`. If simulation fails, we surface an error and never prompt Phantom.
- **Single signer** – User-signed transactions use one signer (the connected wallet).
- **`signTransaction` only** – We use `signTransaction` and then `sendRawTransaction` ourselves; we do not use `signAndSendTransaction`.

## If the Warning Still Appears

1. **Submit your domain for review**  
   Phantom asks that you contact their domain review team:  
   [Phantom domain review form](https://docs.google.com/forms/d/1JgIxdmolgh_80xMfQKBKx9-QPC7LRdN6LHpFFW8BlKM/viewform)  
   Use this for `swap.circuitx.live` (and any other production domains). New or unverified domains often see this warning until review.

2. **Phantom Portal**  
   Register and verify your dApp and domain:  
   [Phantom Portal](https://docs.phantom.com/phantom-portal/getting-started)

3. **If it persists after code and domain steps**  
   Re-submit via the form above and mention that you’ve applied simulation-before-sign and single-signer flows.

## References

- [Domain and transaction warnings](https://docs.phantom.com/developer-powertools/blocklist)
- [Phantom Portal](https://docs.phantom.com/phantom-portal/portal)
