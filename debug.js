require('dotenv').config();
const axios = require('axios');

const MEGAPLAN_CONFIG = {
  account: process.env.MEGAPLAN_ACCOUNT || 'likhtman',
  bearerToken: process.env.MEGAPLAN_BEARER_TOKEN || '',
  apiUrl: process.env.MEGAPLAN_API_URL || 'https://likhtman.megaplan.ru/api/v3'
};

async function debugDeal(dealId) {
  try {
    console.log(`\n📊 Fetching deal ${dealId}...\n`);

    const response = await axios.get(`${MEGAPLAN_CONFIG.apiUrl}/deal/${dealId}`, {
      headers: {
        'Authorization': `Bearer ${MEGAPLAN_CONFIG.bearerToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const deal = response.data?.data;

    console.log('✅ Deal structure:');
    console.log(JSON.stringify(deal, null, 2));

    // Save to file
    const fs = require('fs');
    fs.writeFileSync(`deal-${dealId}-structure.json`, JSON.stringify(deal, null, 2));
    console.log(`\n💾 Saved to deal-${dealId}-structure.json`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Debug both deals
debugDeal(28994).then(() => debugDeal(28995));
