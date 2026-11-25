# Ramko Training System

Supervisor and admin sign-in uses Firebase Authentication (email and password) on project `ramko-training-system`. The menu still follows the role: administrators see the full sidebar, supervisors see the shorter one. Plant employees do not sign in. `/FN135` is unchanged.

This repository does not enable the provider, create users, write Firestore, or deploy. Pear does the steps below.

## Why email and password

The dashboard already asked for a password, and `authProvider.ts` was stubbed for `signInWithEmailAndPassword`. There is no Google OAuth client or company-domain check in this project. Email and password replaces the shared `admin` / `supervisor` password with one Firebase user per person. The person does not pick the role on the form.

## Why an allowlist, not a role stored only in the browser

Each account needs a document `auth_roles/{uid}` with `role` set to `admin` or `supervisor`. The signed-in user can read only their own document. Clients cannot write the collection. QC reads of `qc_employee_history` and `qc_meta` are allowed only when that document exists and the role is one of those two strings. A modified browser can change which buttons it draws. It cannot grant itself the QC read.

Custom claims were not used. Setting them needs a service-account script, and the ID token keeps the old claim until it refreshes. Pear can assign a role from the Firestore console, and the next sign-in sees it immediately.

The old shared password and the `training_auth_role` localStorage value no longer open the dashboard. Sign-out calls Firebase `signOut`, which drops the persisted session, and deletes that leftover key.

`fn135_records` is unchanged (`allow read, write: if true`).

## What Pear does, in this order

Do these in the Firebase console for project **ramko-training-system**. Do not skip ahead. Until step 1 is live, any Firebase user satisfies the rules that are published today (`request.auth != null`) and can read QC history.

1. Deploy **only** the Firestore rules from this branch, before enabling the sign-in provider and before deploying hosting:

   ```bash
   npx -y firebase-tools@latest deploy --only firestore:rules
   ```

   That publishes `auth_roles` and the tighter QC reads. It does not deploy hosting or Cloud Functions. The `fn135_records` rule is the same as before.

2. Open [Authentication → Sign-in method](https://console.firebase.google.com/project/ramko-training-system/authentication/providers) and enable **Email/Password**. Leave **Email link (passwordless sign-in)** off. Do not enable Google.

3. Open [Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/ramko-training-system/authentication/settings) and confirm these domains are listed, with no `https://` and no port:

   - `localhost`
   - `ramko-training-system.firebaseapp.com`
   - `ramko-training-system.web.app`

4. Open [Authentication → Users → Add user](https://console.firebase.google.com/project/ramko-training-system/authentication/users). Create one user per supervisor and per admin. Use their work email and a unique password, and share the password outside the app. Do not reuse the old shared dashboard passwords. The app has no sign-up screen and no password-reset screen. Add, disable, and reset passwords on this Users page. Copy each user's **User UID**.

5. Open Firestore and create a document for each user. Collection `auth_roles`. Document ID is the **UID** from step 4, not the email. Fields:

   | Field | Type | Value |
   | --- | --- | --- |
   | `role` | string | `admin` or `supervisor` |
   | `email` | string | the same email, so a person can see who the document is |

   `role` must be those lowercase words. `Admin` or `supervisor ` will not match. The rules authorize by the document ID and `role`. The `email` field is a label for people reading the console. Create the documents in the console (the console bypasses security rules). The app cannot write them.

6. After review, build and deploy **hosting only** when you want the new sign-in page on the live site:

   ```bash
   npm run build
   npx -y firebase-tools@latest deploy --only hosting
   ```

7. Sign in on the dashboard with that email and password. The sidebar shows Administrator or Supervisor, with the same sections as before, plus the account email. Sign out and confirm the login page returns. A reload while signed in should stay signed in. A reload after sign-out should stay on the login page.

8. Do not create Firebase users for people who only use the FN-135 tablet. They keep opening `/FN135` with no account.

## Dev-only previews

These query strings work on `npm run dev` only. Production builds ignore them. They do not create a Firebase session and do not write to Firestore.

- `?fixture=auth` — email and password form
- `?fixture=auth&screen=error` — incorrect email or password
- `?fixture=auth&screen=denied` — signed in, but no `auth_roles` document
- `?fixture=auth&screen=supervisor` — supervisor menu
- `?fixture=auth&screen=admin` — administrator menu
- `?fixture=employee-profile` — employee profile sample, still without a Firebase session

## Risks

- Enabling Email/Password before the new rules are deployed lets anyone who can call the Auth REST API with the public client key create a user and read QC data. The client key is already in the built app. Deploy the rules first.
- Deploying the rules before hosting does not change the live dashboard: it still uses the shared password, still has no Firebase user, and still cannot read QC. FN-135 is unaffected.
- Deploying hosting before the rules and the `auth_roles` documents makes the new sign-in fail closed. If the role document cannot be read, the app signs the user out. QC stays unread.
- A self-registered Auth user (the provider allows the sign-up API even though this app never calls it) has no allowlist document. After the new rules are live they cannot read QC. Disable stray users on the Authentication Users page.
- Google Sheets and the sample dashboard data are still loaded in the browser for a signed-in supervisor or admin. They were already available to anyone who knew the shared password. This change locks down the QC collections only.
- Each QC read also reads that user's `auth_roles` document from inside the rules.
- Email and password is not company single sign-on. An account can use any email address Pear types in. A Google sign-in limited to a company domain would need a new OAuth setup this app does not have.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
