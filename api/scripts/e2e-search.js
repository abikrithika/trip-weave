async function run() {
  try {
    const res = await fetch('http://localhost:5050/api/flights/ai-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Find a return flight from CPH to LHR departing 2026-07-15 returning 2026-07-22' }),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (err) {
    console.error('Request failed:', err.message || err);
  }
}

run();
