
import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, './.env') });

const keys = {
  OPENROUTE_API_KEY: process.env.OPENROUTE_API_KEY,
  IRCTC_API_KEY: process.env.IRCTC_API_KEY,
  IRCTC_API_HOST: process.env.IRCTC_API_HOST || 'irctc1.p.rapidapi.com',
  IRCTC_API_BASE_URL: process.env.IRCTC_API_BASE_URL || 'https://irctc1.p.rapidapi.com',
  GEOAPIFY_API_KEY: process.env.GEOAPIFY_API_KEY,
  UBER_SERVER_TOKEN: process.env.UBER_SERVER_TOKEN,
  OLA_API_KEY: process.env.OLA_API_KEY,
};

async function testKeys() {
  console.log('--- Testing API Keys ---');
  for (const [name, value] of Object.entries(keys)) {
    const isMock = value?.includes('your_') || value?.includes('token_here');
    console.log(`${name.padEnd(20)}: ${value && !isMock ? 'Present' : 'MISSING/MOCK'}`);
  }
  console.log('');

  // 1. Test Geoapify
  process.stdout.write('Testing Geoapify... ');
  try {
    const resp = await axios.get('https://api.geoapify.com/v1/geocode/search', {
      params: { text: 'Bandra, Mumbai', apiKey: keys.GEOAPIFY_API_KEY }
    });
    console.log('✅ Working');
  } catch (err: any) {
    console.log('❌ Failed:', err.response?.status || err.message);
  }

  // 2. Test OpenRouteService
  process.stdout.write('Testing OpenRouteService... ');
  try {
    const resp = await axios.get('https://api.openrouteservice.org/v2/directions/driving-car', {
      params: { 
        api_key: keys.OPENROUTE_API_KEY,
        start: '72.8414,19.0522',
        end: '72.8258,18.9353'
      }
    });
    console.log('✅ Working');
  } catch (err: any) {
    console.log('❌ Failed:', err.response?.status || err.message);
  }

  // 3. Test IRCTC (RapidAPI) - HUNTING
  process.stdout.write('Testing IRCTC (RapidAPI)... ');
  if (!keys.IRCTC_API_KEY || keys.IRCTC_API_KEY.includes('your_')) {
    console.log('⏭️ Skipped (No Key)');
  } else {
    const endpoints = [
      '/api/v3/trainBetweenStations',
      '/api/v3/trainsList',
      '/api/v2/trainBetweenStations',
      '/api/v1/searchTrain'
    ];
    let success = false;
    for (const endpoint of endpoints) {
      try {
        await axios.get(`${keys.IRCTC_API_BASE_URL}${endpoint}`, {
          params: { fromStationCode: 'ADH', toStationCode: 'BVI', dateOfJourney: new Date().toISOString().split('T')[0].replace(/-/g, '') },
          headers: { 'x-rapidapi-key': keys.IRCTC_API_KEY, 'x-rapidapi-host': keys.IRCTC_API_HOST }
        });
        console.log(`✅ Working (Endpoint: ${endpoint})`);
        success = true;
        break;
      } catch (err: any) {
        if (err.response?.status !== 404) {
          console.log(`❌ Failed on ${endpoint}:`, err.response?.status || err.message);
          success = true; // Not a 404, so endpoint is likely correct but data/auth issue
          break;
        }
      }
    }
    if (!success) console.log('❌ Failed: All tried endpoints returned 404');
  }

  // 4. Test Uber - FALLBACK
  process.stdout.write('Testing Uber... ');
  if (!keys.UBER_SERVER_TOKEN || keys.UBER_SERVER_TOKEN.includes('your_')) {
    console.log('⏭️ Skipped (No Token)');
  } else {
    const uberEndpoints = [
      'https://api.uber.com/v1.2/estimates/time',
      'https://api.uber.com/v1.2/estimates/price',
      'https://api.uber.com/v1/estimates/time'
    ];
    let success = false;
    for (const url of uberEndpoints) {
      try {
        await axios.get(url, {
          params: { start_latitude: 19.0522, start_longitude: 72.8414, end_latitude: 19.1136, end_longitude: 72.8697 },
          headers: { 'Authorization': `Token ${keys.UBER_SERVER_TOKEN}` }
        });
        console.log(`✅ Working (URL: ${url})`);
        success = true;
        break;
      } catch (err: any) {
        if (err.response?.status !== 404) {
          console.log(`❌ Failed on ${url}:`, err.response?.status || err.message);
          success = true; // Not a 404, endpoint exists but e.g. 403/401
          break;
        }
      }
    }
    if (!success) console.log('❌ Failed: All Uber endpoints returned 404');
  }

  // 5. Test Ola
  process.stdout.write('Testing Ola... ');
  if (!keys.OLA_API_KEY || keys.OLA_API_KEY.includes('your_')) {
    console.log('⏭️ Skipped (No Key)');
  } else {
    try {
      const resp = await axios.get('https://devapi.olacabs.com/v1/products', {
        params: { pickup_lat: 19.0522, pickup_lng: 72.8414 },
        headers: { 'X-APP-TOKEN': keys.OLA_API_KEY }
      });
      console.log('✅ Working');
    } catch (err: any) {
      console.log('❌ Failed:', err.response?.status || err.message);
    }
  }
}

testKeys();

