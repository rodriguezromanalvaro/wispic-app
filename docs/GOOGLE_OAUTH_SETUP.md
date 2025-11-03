# Google OAuth + Supabase setup (Wispic)

Follow these steps to enable real Google Sign-In in the app. The app-side code is already wired for Google OAuth and deep linking.

## 1) Domain, email, and DNS

- Provider: Google Workspace (Business Starter, 1 user)
- Primary mailbox: support@wispic.app
- Aliases: hello@, info@, contact@, no-reply@
- DNS host: Cloudflare (Free)

Add these DNS records in Cloudflare (replace the DKIM host/value after Google provides it):

- MX (priority order):
  - ASPMX.L.GOOGLE.COM. (priority 1)
  - ALT1.ASPMX.L.GOOGLE.COM. (5)
  - ALT2.ASPMX.L.GOOGLE.COM. (5)
  - ALT3.ASPMX.L.GOOGLE.COM. (10)
  - ALT4.ASPMX.L.GOOGLE.COM. (10)
- SPF (TXT on root): `v=spf1 include:_spf.google.com ~all`
- DKIM (TXT) from Google Admin after enabling; host looks like `google._domainkey` with long TXT value
- DMARC (TXT on _dmarc): `v=DMARC1; p=none; rua=mailto:dmarc@wispic.app; fo=1; pct=100` (start with p=none during warm-up)

## 2) Search Console & OAuth consent screen

- Verify `wispic.app` in Google Search Console (DNS TXT method)
- In Google Cloud Console (same org as Workspace):
  - Create a project (e.g., "Wispic App")
  - OAuth consent screen:
    - User type: External
    - App name: Wispic
    - Support email: support@wispic.app
    - Authorized domains: wispic.app
    - App logo/links: use https://wispic.app (optional until live)
    - Scopes: default profile/email are enough for Google sign-in
    - Test users: add your own Gmail while consent is in testing (before publishing)

## 3) Publish Privacy & Terms

- Host at:
  - https://wispic.app/privacy
  - https://wispic.app/terms
- These URLs are referenced in the app and can be added to the consent screen.

## 4) Google OAuth Client (Web) for Supabase

- In Google Cloud Console → Credentials → Create credentials → OAuth client ID → Web application
- Authorized redirect URIs: add your Supabase callback URL
  - Format: `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
  - You can find `<PROJECT-REF>` in your Supabase project settings or from the API URL (substring before `.supabase.co`)
- Save Client ID and Client secret

## 5) Enable Google provider in Supabase

- Supabase → Authentication → Providers → Google
  - Client ID: (from step 4)
  - Client secret: (from step 4)
  - Additional redirect URLs: add the app scheme callback: `wispic://auth/callback`
  - Save

Notes:
- The app uses Expo AuthSession and the `wispic` scheme; both sign-in and sign-up screens point to `wispic://auth/callback`.
- Sessions persist using expo-secure-store, and `detectSessionInUrl` is enabled.

## 6) Test the flow

- Build or run the app on a real device/emulator
- Go to sign-in and tap "Continuar con Google"
- Complete the Google flow and confirm you return to the app authenticated

## 7) iOS App Store policy reminder

- If you submit to the App Store and include third-party sign-in (Google), Apple may require "Sign in with Apple" as well. You can keep Apple disabled during development and re-enable at submission time if needed.
