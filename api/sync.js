// api/sync.js
// Синхронизирует расходы: вычисляет сумму и обновляет финальную стоимость в основной сделке

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
  finalCost: process.env.FIELD_FINAL_COST || '1008'
};

// Field name for updating main deal (Расходы Сумма Итого)
const FIELD_EXPENSES_TOTAL = 'Category1000061CustomFieldRashodiSummaItogo';

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

// Update deal field via POST request
async function updateDealField(dealId, fieldValue) {
  try {
    const updatePayload = {
      contentType: 'Deal',
      id: dealId,
      [FIELD_EXPENSES_TOTAL]: {
        contentType: 'Money',
        value: fieldValue
      }
    };

    const axiosInstance = axios.create({
      baseURL: MEGAPLAN_CONFIG.apiUrl,
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    const response = await axiosInstance.post(`/deal/${dealId}`, updatePayload);
    return response.data;
  } catch (error) {
    console.error('Update field error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

// ===========================
// MAIN HANDLER
// ===========================

module.exports = async (req, res) => {
  try {
    const { dealId } = req.query;

    if (!dealId) {
      return res.status(400).json({
        error: 'dealId parameter is required',
        example: '/api/sync-expenses?dealId=28744'
      });
    }

    console.log(`Syncing expenses for deal ${dealId}...`);

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

    if (linkedDealSummaries.length === 0) {
      return res.status(200).json({
        dealId,
        dealName: deal.data.name,
        expensesCount: 0,
        totalAmount: 0,
        message: 'No linked expenses found',
        updated: false
      });
    }

    // 3. Fetch full data for each linked deal (to get custom fields)
    const linkedDealsFullData = await Promise.all(
      linkedDealSummaries.map(summary => megaplanRequest(`/deal/${summary.id}`))
    );

    const linkedDeals = linkedDealsFullData
      .map(response => response?.data)
      .filter(d => d !== null && d !== undefined);

    console.log(`Fetched ${linkedDeals.length} linked deals with full data`);

    // 4. Calculate total from finalCost based on program
    let totalAmount = 0;

    for (const linkedDeal of linkedDeals) {
      let finalCostValue = 0;

      if (linkedDeal.program?.id === '36') {
        finalCostValue = parseFloat(getFieldByPath(linkedDeal, '$.Category1000084CustomFieldFinalnayaStoimost.valueInMain')) || 0;
      } else if (linkedDeal.program?.id === '35') {
        finalCostValue = parseFloat(getFieldByPath(linkedDeal, '$.Category1000083CustomFieldFinalnayaStoimost.valueInMain')) || 0;
      } else {
        finalCostValue = parseFloat(getFieldByPath(linkedDeal, CUSTOM_FIELDS.finalCost)) || 0;
      }

      if (!isNaN(finalCostValue) && finalCostValue > 0) {
        totalAmount += finalCostValue;
      }
    }

    // 5. Update main deal field with total amount
    const roundedTotal = Math.round(totalAmount * 100) / 100;

    try {
      await updateDealField(dealId, roundedTotal);

      return res.status(200).json({
        dealId,
        dealName: deal.data.name,
        expensesCount: linkedDeals.length,
        totalAmount: roundedTotal,
        updated: true,
        message: 'Expenses synced successfully'
      });
    } catch (updateError) {
      return res.status(200).json({
        dealId,
        dealName: deal.data.name,
        expensesCount: linkedDeals.length,
        totalAmount: roundedTotal,
        updated: false,
        message: 'Calculated but failed to update: ' + updateError.message
      });
    }

  } catch (error) {
    console.error('Sync expenses error:', error);
    return res.status(500).json({
      error: 'Ошибка синхронизации расходов',
      details: error.message
    });
  }
};
