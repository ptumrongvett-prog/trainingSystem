import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AUTH_ROLES_COLLECTION } from './authAccess';
import { Role } from '../types';

const rulesPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../firestore.rules');
const rules = readFileSync(rulesPath, 'utf8');

describe('firestore.rules QC matches', () => {
  it('leaves the FN-135 rule untouched and limits QC reads to the role allowlist', () => {
    expect(rules).toContain(`match /fn135_records/{docId} {
      allow read, write: if true;
    }`);

    expect(rules).toContain(`match /${AUTH_ROLES_COLLECTION}/{uid} {
      allow read: if isSignedIn() && request.auth.uid == uid;
      allow write: if false;
    }`);
    expect(rules).toContain(`get(allowlistPath()).data.role in ['${Role.ADMIN}', '${Role.SUPERVISOR}']`);
    expect(rules).toContain(`match /qc_employee_history/{id} {
      allow read: if isDashboardReader();
      allow write: if false;
    }`);
    expect(rules).toContain(`match /qc_meta/{id} {
      allow read: if isDashboardReader();
      allow write: if false;
    }`);
    expect(rules).not.toContain('allow read: if request.auth != null;');

    const fn135 = rules.match(/match \/fn135_records[\s\S]*?allow [^;]+;/g) ?? [];
    expect(fn135).toEqual(['match /fn135_records/{docId} {\n      allow read, write: if true;']);
    expect(rules.match(/allow read, write: if true;/g)).toEqual(['allow read, write: if true;']);
    expect(rules.match(/allow write: if false;/g)).toHaveLength(3);
  });
});
