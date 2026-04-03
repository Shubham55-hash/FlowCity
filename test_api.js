const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/ghost-commute', {
      startLocation: { name: 'Borivali' },
      endLocation: { name: 'Andheri' },
      preferences: { priority: 'time' }
    });
    console.log('STATUS:', res.status);
    console.log('TOTAL TIME:', res.data.totalTimeMin, 'min');
    console.log('SEGMENTS:', JSON.stringify(res.data.segments.map(s => `${s.from} -> ${s.to} (${s.predictedDurationMin}m)`), null, 2));
    console.log('SOURCES:', res.data.dataSources);
  } catch (err) {
    console.error('ERROR:', err.response?.data || err.message);
  }
}

test();
