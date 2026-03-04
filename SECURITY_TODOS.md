# Pre-App-Store Security Checklist — Daiyly
# Bundle: com.ahmetkizilkaya.daiyly

## MUST DO before submission

- [ ] **expo-updates code signing**: Generate RSA key pair, place cert at `./certs/certificate.pem`, configure `app.json` updates.codeSigningCertificate (alg: rsa-v1_5-sha256, keyid: main)
- [ ] **Apple ASC Key rotation**: Key RHRSDZ855Y was in git history before purge — rotate at developer.apple.com
- [ ] **freeRASP**: Install `freerasp-react-native` for Frida/jailbreak/root detection. See: https://github.com/talsec/Free-RASP-ReactNative — requires Android signing cert hash and iOS provisioning profile before wiring up
- [ ] **Server-side entitlement validation**: Backend /daiyly/ai-insights and other premium endpoints should verify active RevenueCat subscription server-side (not just client-side useProGate check)

## DONE
- [x] HTTPS + TLS 1.3 (Let's Encrypt, api.vexellabspro.com)
- [x] JWT scope validation (app_id claim vs X-App-ID header)
- [x] Rate limiting on all AI endpoints
- [x] ALLOWED_API_HOSTS allowlist in api.ts
- [x] Background privacy overlay (FTC HBNR compliance)
- [x] SHA-256 nonce on Apple Sign-In
- [x] RevenueCat ENFORCED entitlement verification
- [x] android allowBackup=false
- [x] iOS Keychain access groups (app.json entitlements — $(AppIdentifierPrefix)com.ahmetkizilkaya.daiyly)
- [x] Sentry PII scrubbing (request.data, user.email, query params stripped)
- [x] JWT decode uses Buffer.from(base64) — non-ASCII email safe
- [x] Email normalized with .trim().toLowerCase() on login (login.tsx)
- [x] Deep link allowlist (home/insights/history/search/settings only)
- [x] Auth rate limit: 10 req/min per IP (backend)
- [x] Apple Sign-In rate limit: 5 req/min per token prefix (backend)
- [x] HSTS max-age=63072000 includeSubDomains preload (backend)
- [x] daiyly/services.go: LIKE wildcard escaping for ILIKE search (backend)
- [x] daiyly/services.go: Content max 50000 chars on Create+Update (backend)
- [x] Sentry endpoint tag strips query params (api.ts)
