# NearMe Production Deployment & Configuration Guide

## 1. Firebase Project & Authentication Providers
1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project (`projectId` in `firebase-applet-config.json`).
2. Under **Authentication → Sign-in method**, enable:
   - **Email/Password** (with Email Verification templates configured)
   - **Google**
   - **Phone** (optional, requires reCAPTCHA verification and authorized domains)
3. Add your production domain to **Authentication → Settings → Authorized domains**.

## 2. Cloud Firestore, Security Rules & Indexes
1. Deploy hardened rules and composite indexes:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
2. Verify `firebase-blueprint.json` matches your collections and test security rules using `npx tsx --test firestore.rules.test.ts`.

## 3. Firebase Storage
1. Enable **Firebase Storage** in the Firebase Console.
2. Deploy storage rules:
   ```bash
   firebase deploy --only storage
   ```

## 4. Cloud Functions & Secret Manager
1. Upgrade the Firebase project to the **Blaze (pay-as-you-go)** plan to deploy Cloud Functions v2.
2. Store server secrets in Firebase Secret Manager (never expose them as `VITE_*` variables):
   ```bash
   firebase functions:secrets:set PAYMENT_PROVIDER_SECRET
   firebase functions:secrets:set PAYMENT_WEBHOOK_SECRET
   firebase functions:secrets:set ADMIN_BOOTSTRAP_SECRET
   ```
3. Build and deploy functions:
   ```bash
   cd functions && npm install && npm run build && cd ..
   firebase deploy --only functions
   ```

## 5. Push Notifications (FCM)
1. In **Project Settings → Cloud Messaging**, generate a **Web Push certificate** (VAPID key).
2. Set `VITE_FIREBASE_VAPID_KEY` in your build environment.

## 6. Payment Provider Setup
1. Configure `PAYMENT_PROVIDER_SECRET` and `PAYMENT_WEBHOOK_SECRET` on the backend server environment (or Firebase Secret Manager).
2. Point your payment provider webhook endpoint to `https://<your-domain>/api/payments/webhook` (or the Cloud Function URL).
3. NearMe enforces verified server-side webhook signatures before upgrading any user to VIP.

## 7. Hosting & HTTPS Domain
1. Build the production frontend:
   ```bash
   npm run build
   ```
2. Deploy to Firebase Hosting or Cloud Run (`npm start`):
   ```bash
   firebase deploy --only hosting
   ```
3. Attach your custom domain with automatic SSL/HTTPS provisioning so Geolocation API, Service Workers, and Web Push Notifications work reliably.
