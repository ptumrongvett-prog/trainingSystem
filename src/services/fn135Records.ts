/**
 * Read FN-135 trainer-form submissions. Writes stay in trainingSheets.ts.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { parseFn135ForEmployee, type Fn135Submission } from '../lib/fn135Records';

export async function loadFn135ForEmployee(empId: string): Promise<Fn135Submission[]> {
  const snap = await getDocs(collection(db, 'fn135_records'));
  const docs = snap.docs.map(item => ({ id: item.id, ...item.data() }));
  return parseFn135ForEmployee(docs, empId);
}

export type { Fn135Submission };
