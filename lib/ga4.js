// lib/ga4.js
// Fetches realtime data from Google Analytics 4 Data API

import { BetaAnalyticsDataClient } from '@google-analytics/data';

let analyticsClient = null;

function getClient() {
  if (analyticsClient) return analyticsClient;

  // Support both JSON string env var (for Vercel) and key file (local dev)
  if (process.env.GA4_SERVICE_ACCOUNT_KEY) {
    const credentials = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_KEY);
    analyticsClient = new BetaAnalyticsDataClient({ credentials });
  } else if (process.env.GA4_KEY_FILE_PATH) {
    analyticsClient = new BetaAnalyticsDataClient({
      keyFilename: process.env.GA4_KEY_FILE_PATH,
    });
  } else {
    throw new Error('No GA4 credentials found. Set GA4_SERVICE_ACCOUNT_KEY in your .env.local');
  }

  return analyticsClient;
}

// Maps GA4 traffic source → vehicle type
function getVehicleType(source, medium, deviceCategory, pagePath) {
  if (pagePath && pagePath.includes('404')) return 'police_car';
  if (deviceCategory === 'mobile') return 'sedan';
  if (medium === 'organic' || source === 'google') return 'sports_car';
  if (medium === 'social' || ['facebook','instagram','twitter','linkedin','youtube'].some(s => source?.includes(s))) return 'box_truck';
  if (medium === 'referral') return 'panel_van';
  if (medium === 'email') return 'taxi';
  if (source === '(direct)' || medium === '(none)') return 'city_bus';
  if (medium === 'cpc' || medium === 'paid') return 'motorcycle';
  return 'hatchback';
}

// Maps device/source to protocol label shown on vehicle
function getProtocolLabel(vehicleType) {
  const map = {
    city_bus:   'DIRECT',
    sports_car: 'SEARCH',
    box_truck:  'SOCIAL',
    motorcycle: 'PAID',
    taxi:       'EMAIL',
    sedan:      'MOBILE',
    panel_van:  'REFERRAL',
    police_car: '404',
    bicycle:    'BOT',
    hatchback:  'OTHER',
  };
  return map[vehicleType] || 'OTHER';
}

export async function getRealtimeVisitors() {
  const client = getClient();
  const propertyId = process.env.GA4_PROPERTY_ID;

  if (!propertyId) throw new Error('GA4_PROPERTY_ID not set');

  // Run realtime report — GA4 Realtime API
  const [response] = await client.runRealtimeReport({
    property: `properties/${propertyId}`,
    dimensions: [
      { name: 'unifiedScreenName' },       // page path
      { name: 'trafficMedium' },           // organic, social, etc
      { name: 'trafficSource' },           // google, facebook, etc
      { name: 'deviceCategory' },          // desktop, mobile, tablet
      { name: 'country' },                 // visitor country
      { name: 'city' },                    // visitor city
      { name: 'minutesAgo' },              // how recent (0 = last minute)
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
    ],
    minuteRanges: [{ name: 'last5min', startMinutesAgo: 4, endMinutesAgo: 0 }],
  });

  const visitors = [];

  if (!response.rows || response.rows.length === 0) {
    return { visitors: [], summary: { total: 0, byType: {} } };
  }

  response.rows.forEach((row, index) => {
    const pagePath     = row.dimensionValues[0]?.value || '/';
    const medium       = row.dimensionValues[1]?.value || '(none)';
    const source       = row.dimensionValues[2]?.value || '(direct)';
    const device       = row.dimensionValues[3]?.value || 'desktop';
    const country      = row.dimensionValues[4]?.value || 'Unknown';
    const city         = row.dimensionValues[5]?.value || 'Unknown';
    const minutesAgo   = parseInt(row.dimensionValues[6]?.value || '0');
    const activeUsers  = parseInt(row.metricValues[0]?.value || '0');
    const pageViews    = parseInt(row.metricValues[1]?.value || '0');

    const vehicleType  = getVehicleType(source, medium, device, pagePath);
    const protocol     = getProtocolLabel(vehicleType);

    // Create one vehicle entry per active user in this row
    for (let i = 0; i < Math.max(activeUsers, 1); i++) {
      visitors.push({
        id: `${index}-${i}-${Date.now()}`,
        vehicleType,
        protocol,
        source: source === '(direct)' ? 'Direct' : source,
        medium: medium === '(none)' ? 'None' : medium,
        pagePath,
        device,
        country,
        city,
        minutesAgo,
        pageViews,
        // Freshness affects speed — newer hits move faster
        speedMultiplier: minutesAgo === 0 ? 1.4 : minutesAgo <= 2 ? 1.0 : 0.7,
      });
    }
  });

  // Build summary counts
  const byType = {};
  visitors.forEach(v => {
    byType[v.vehicleType] = (byType[v.vehicleType] || 0) + 1;
  });

  return {
    visitors,
    summary: {
      total: visitors.length,
      byType,
      timestamp: new Date().toISOString(),
    },
  };
}

// Fallback mock data when GA4 creds aren't set up yet (useful during dev/demo)
export function getMockVisitors() {
  const types = [
    { vehicleType: 'sports_car', protocol: 'SEARCH', source: 'google', medium: 'organic', country: 'India', city: 'Mumbai', device: 'desktop' },
    { vehicleType: 'city_bus',   protocol: 'DIRECT', source: 'Direct', medium: 'None',    country: 'USA',   city: 'New York', device: 'desktop' },
    { vehicleType: 'box_truck',  protocol: 'SOCIAL', source: 'instagram', medium: 'social', country: 'UK',  city: 'London',   device: 'mobile' },
    { vehicleType: 'sedan',      protocol: 'MOBILE', source: 'google', medium: 'organic', country: 'India', city: 'Delhi',    device: 'mobile' },
    { vehicleType: 'taxi',       protocol: 'EMAIL',  source: 'newsletter', medium: 'email', country: 'Canada', city: 'Toronto', device: 'desktop' },
    { vehicleType: 'panel_van',  protocol: 'REFERRAL', source: 'github.com', medium: 'referral', country: 'Germany', city: 'Berlin', device: 'desktop' },
    { vehicleType: 'motorcycle', protocol: 'PAID',   source: 'google', medium: 'cpc',    country: 'India', city: 'Bangalore', device: 'desktop' },
    { vehicleType: 'police_car', protocol: '404',    source: '(direct)', medium: '(none)', country: 'France', city: 'Paris', device: 'mobile' },
    { vehicleType: 'hatchback',  protocol: 'OTHER',  source: 'bing', medium: 'organic', country: 'Australia', city: 'Sydney', device: 'tablet' },
  ];

  const count = Math.floor(Math.random() * 6) + 4;
  const visitors = [];
  for (let i = 0; i < count; i++) {
    const t = types[Math.floor(Math.random() * types.length)];
    visitors.push({
      ...t,
      id: `mock-${i}-${Date.now()}`,
      pagePath: ['/', '/about', '/projects', '/blog', '/contact'][Math.floor(Math.random() * 5)],
      minutesAgo: Math.floor(Math.random() * 5),
      pageViews: Math.floor(Math.random() * 8) + 1,
      speedMultiplier: 0.7 + Math.random() * 0.8,
    });
  }

  const byType = {};
  visitors.forEach(v => { byType[v.vehicleType] = (byType[v.vehicleType] || 0) + 1; });

  return { visitors, summary: { total: visitors.length, byType, timestamp: new Date().toISOString() } };
}
