// api/expenses.js
// API endpoint для получения расходов из Megaplan

const axios = require('axios');

// ===========================
// CONFIGURATION
// ===========================

const MEGAPLAN_CONFIG = {
  account: process.env.MEGAPLAN_ACCOUNT || 'likhtman',
  bearerToken: process.env.MEGAPLAN_BEARER_TOKEN || '',
  apiUrl: process.env.MEGAPLAN_API_URL || 'https://likhtman.megaplan.ru/api/v3'
};

// Custom fields mapping (из .env)
const CUSTOM_FIELDS = {
  status: process.env.FIELD_STATUS || '1001',
  category: process.env.FIELD_CATEGORY || '1002',
  brand: process.env.FIELD_BRAND || '1003',
  contractor: process.env.FIELD_CONTRACTOR || '1004',
  paymentType: process.env.FIELD_PAYMENT_TYPE || '1005',
  amount: process.env.FIELD_AMOUNT || '1006',
  additionalCost: process.env.FIELD_ADDITIONAL_COST || '1007',
  finalCost: process.env.FIELD_FINAL_COST || '1008',
  fairCost: process.env.FIELD_FAIR_COST || '1009',
  currency: process.env.FIELD_CURRENCY || '1010'
};

// ===========================
// HELPER FUNCTIONS
// ===========================

// Get Bearer token header
function getAuthHeader() {
  if (!MEGAPLAN_CONFIG.bearerToken) {
    throw new Error('MEGAPLAN_BEARER_TOKEN is not configured');
  }
  return `Bearer ${MEGAPLAN_CONFIG.bearerToken}`;
}

// Make Megaplan API request
async function megaplanRequest(endpoint, params = {}) {
  try {
    const response = await axios.get(`${MEGAPLAN_CONFIG.apiUrl}${endpoint}`, {
      params,
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds
    });
    
    return response.data;
  } catch (error) {
    console.error('Megaplan API Error:', error.message);
    throw error;
  }
}

// Get field value by JSON path or direct property
function getFieldByPath(obj, path) {
  if (!path) return '';

  // Если это JSON path (начинается с $)
  if (path.startsWith('$.')) {
    const pathParts = path.slice(2).split('.');
    let value = obj;

    for (const part of pathParts) {
      if (value === null || value === undefined) return '';
      value = value[part];
    }

    // If result is object with 'value' property (like monetary amounts), extract it
    if (value && typeof value === 'object' && 'value' in value) {
      return value.value;
    }

    return value || '';
  }

  // Иначе это простой ID кастомного поля
  return obj.customFields?.[path] || '';
}

// Map linked deal (expense) to expense object
async function mapExpense(expenseDeal, parentDeal) {
  return {
    deal_id: expenseDeal.id,
    status: getFieldByPath(expenseDeal, CUSTOM_FIELDS.status),
    category: getFieldByPath(expenseDeal, CUSTOM_FIELDS.category),
    brand: getFieldByPath(expenseDeal, CUSTOM_FIELDS.brand),
    contractor: (() => {
      if (!expenseDeal.contractor) return '';
      // For ContractorHuman: combine firstName and lastName
      if (expenseDeal.contractor.firstName || expenseDeal.contractor.lastName) {
        const firstName = expenseDeal.contractor.firstName || '';
        const lastName = expenseDeal.contractor.lastName || '';
        return `${firstName} ${lastName}`.trim();
      }
      // For ContractorCompany: use name
      return expenseDeal.contractor.name || '';
    })(),
    paymentType: getFieldByPath(expenseDeal, CUSTOM_FIELDS.paymentType),
    amount: parseFloat(getFieldByPath(expenseDeal, CUSTOM_FIELDS.amount)) || 0,
    additionalCost: parseFloat(getFieldByPath(expenseDeal, CUSTOM_FIELDS.additionalCost)) || 0,
    finalCost: parseFloat(getFieldByPath(expenseDeal, CUSTOM_FIELDS.finalCost)) || 0,
    fairCost: parseFloat(getFieldByPath(expenseDeal, CUSTOM_FIELDS.fairCost)) || 0,
    currency: getFieldByPath(expenseDeal, CUSTOM_FIELDS.currency) || 'RUB',
    description: expenseDeal.description || expenseDeal.name || '',
    dealLink: `https://${MEGAPLAN_CONFIG.account}.megaplan.ru/deals/${expenseDeal.id}/card/`,
    manager: expenseDeal.manager?.name || expenseDeal.responsible?.name || parentDeal.manager?.name || parentDeal.responsible?.name || '',
    owner: expenseDeal.owner?.name || expenseDeal.createdBy?.name || '',
    deal_name: expenseDeal.name || ''
  };
}

// ===========================
// MAIN HANDLER
// ===========================

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Validate method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get dealId from query
    const { dealId } = req.query;
    
    if (!dealId) {
      return res.status(400).json({ 
        error: 'dealId parameter is required' 
      });
    }
    
    console.log(`Fetching expenses for deal ${dealId}...`);
    
    // 1. Get deal info
    const deal = await megaplanRequest(`/deal/${dealId}`);

    if (!deal || !deal.data) {
      return res.status(404).json({
        error: 'Deal not found'
      });
    }

    // 2. Get linked deals for this deal
    console.log(`Requesting linked deals for ${dealId}...`);
    const linkedDealsResponse = await megaplanRequest(`/deal/${dealId}/linkedDeals`);

    const linkedDealSummaries = linkedDealsResponse?.data || [];
    console.log(`Found ${linkedDealSummaries.length} linked deals`);

    // 3. Fetch full data for each linked deal (to get custom fields)
    const linkedDealsFullData = await Promise.all(
      linkedDealSummaries.map(summary => megaplanRequest(`/deal/${summary.id}`))
    );

    const linkedDeals = linkedDealsFullData
      .map(response => response?.data)
      .filter(d => d !== null && d !== undefined);

    console.log(`Fetched ${linkedDeals.length} linked deals with full data`);

    // 4. Map linked deals to expense objects (await all async operations)
    const mappedExpenses = await Promise.all(
      linkedDeals.map(linkedDeal => mapExpense(linkedDeal, deal.data))
    );
    
    // 5. Calculate total
    const total = mappedExpenses.reduce((sum, exp) => sum + exp.finalCost, 0);
    
    // 6. Return response
    return res.status(200).json({
      dealId: deal.data.id,
      dealName: deal.data.name,
      expenses: mappedExpenses,
      total: total
    });
    
  } catch (error) {
    console.error('API Error:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};
