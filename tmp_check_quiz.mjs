// Quick debug script to check QuizResponses IsCorrect values from AppSheet
const APP_ID = '74c5d97d-992f-48c1-9aab-087a251db507';
const API_KEY = 'V2-T2LJI-6IEPQ-yNwyE-zmaTS-ZvkDi-Xjj5e-1Fmwz-J4ddD';

async function main() {
  const res = await fetch(`https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/QuizResponses/Action`, {
    method: 'POST',
    headers: {
      'ApplicationAccessKey': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Action: 'Find',
      Properties: { Locale: 'en-US', Timezone: 'Pacific Standard Time' },
      Rows: [],
    }),
  });

  const data = await res.json();
  
  console.log(`Total QuizResponses: ${data.length}`);
  console.log('\n--- First 5 rows (full) ---');
  data.slice(0, 5).forEach((r, i) => console.log(`Row ${i}:`, JSON.stringify(r, null, 2)));

  // Analyze IsCorrect values
  const values = {};
  for (const r of data) {
    const v = String(r.IsCorrect);
    values[v] = (values[v] || 0) + 1;
  }
  console.log('\n--- IsCorrect value distribution ---');
  console.log(values);
  
  // Check other field names that might indicate correctness
  if (data.length > 0) {
    console.log('\n--- All field names ---');
    console.log(Object.keys(data[0]));
  }
}

main().catch(console.error);
