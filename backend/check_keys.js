require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const https = require('https');

const keys = {
  OPENROUTE_API_KEY:    process.env.OPENROUTE_API_KEY,
  IRCTC_API_KEY:        process.env.IRCTC_API_KEY,
  GEOAPIFY_API_KEY:     process.env.GEOAPIFY_API_KEY,
};

console.log('\n=== API Key Presence Check ===');
for (const [name, value] of Object.entries(keys)) {
  const placeholder = !value ||
    value.includes('your_') ||
    value.includes('here') ||
    value.length < 5;
  const tag = placeholder ? '[PLACEHOLDER/MISSING]' : '[FOUND]';
  console.log(`  ${tag.padEnd(22)} ${name} = ${value ? value.slice(0, 12) + '...' : 'undefined'}`);
}

function get(url, headers = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: body.slice(0, 120) }));
    });
    req.on('error', (e) => resolve({ status: 'ERR', body: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 'TIMEOUT', body: '' }); });
  });
}

async function run() {
  console.log('\n=== Live API Tests ===');

  // Geoapify
  process.stdout.write('  Geoapify geocoding ... ');
  const geo = await get(`https://api.geoapify.com/v1/geocode/search?text=Bandra,Mumbai&apiKey=${keys.GEOAPIFY_API_KEY}`);
  console.log(geo.status === 200 ? 'OK 200' : `FAIL ${geo.status}`);

  // OpenRouteService
  process.stdout.write('  OpenRouteService     ... ');
  const ors = await get(
    `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${keys.OPENROUTE_API_KEY}&start=72.8414,19.0522&end=72.8258,18.9353`
  );
  console.log(ors.status === 200 ? 'OK 200' : `FAIL ${ors.status} - ${ors.body.slice(0,80)}`);


  // IRCTC RapidAPI (correct host: irctc1.p.rapidapi.com)
  process.stdout.write('  IRCTC RapidAPI       ... ');
  const irctc = await get(
    'https://irctc1.p.rapidapi.com/api/v3/trainsList?fromStationCode=CSTM&toStationCode=BVI&dateOfJourney=20260404&classType=SL&quota=GN',
    {
      'x-rapidapi-key':  keys.IRCTC_API_KEY,
      'x-rapidapi-host': 'irctc1.p.rapidapi.com'
    }
  );
  console.log(irctc.status === 200 ? 'OK 200' : `FAIL ${irctc.status}`);

  console.log('\nDone.\n');
}

run();
