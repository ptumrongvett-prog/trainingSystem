/** FN-135 Training Record checklist items */

export const CHECKLIST_ITEMS = [
  'Perform the task to demonstrate they have internalized the work instructions',
  'Show they are confirming the labels are correct',
  'Demonstrate they are using the correct packaging',
  'Show how they are maintaining 6S',
  'Show the quality requirements for the part (quality alerts, criteria, print)',
  'Understand where the limit samples are and how to know it has been approved',
  'Show physical quality aids',
  'Show what paperwork is their responsibility to complete',
  'Demonstrate how to enter scrap, call a technician, enter daily requirements',
  'Demonstrate they are familiar with the team (QC, Technician, Material Handler)',
];

export interface EmpResult {
  checklist: { passed: boolean | null; notes: string }[];
  followUp: { passed: boolean | null; notes: string; checklist?: { passed: boolean | null; notes: string }[] };
  performance: {
    attitude: '' | 'Good' | 'Fair' | 'Poor';
    teachable: '' | 'Yes' | 'No';
    competent: '' | 'Yes' | 'No';
    fiveS: '' | 'Good' | 'Fair' | 'Poor';
    language: '' | 'English' | 'Spanish';
  };
  overallPassed: boolean | null;
}

export function createEmptyResult(): EmpResult {
  return {
    checklist: CHECKLIST_ITEMS.map(() => ({ passed: null, notes: '' })),
    followUp: { passed: null, notes: '', checklist: CHECKLIST_ITEMS.map(() => ({ passed: null, notes: '' })) },
    performance: { attitude: '', teachable: '', competent: '', fiveS: '', language: '' },
    overallPassed: null,
  };
}
