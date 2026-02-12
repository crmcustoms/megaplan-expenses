// api/sync.js
// Синхронизирует расходы: вычисляет сумму и обновляет финальную стоимость в основной сделке
// Используется для программного обновления, без отрисовки таблицы

const axios = require('axios');

// ===========================
// CONFIGURATION
// ===========================

const MEGAPLAN_CONFIG = {
  account: process.env.MEGAPLAN_ACCOUNT || 'likhtman',
  bearerToken: process.env.MEGAPLAN_BEARER_TOKEN || '',
  apiUrl: process.env.MEGAPLAN_API_URL || 'https://likhtman.megaplan.ru/api/v3'
};

// Custom fields mapping
const CUSTOM_FIELDS = {
  finalCost: process.env.FIELD_FINAL_COST || '1008'
};

// Field ID для обновления финальной стоимости в основной сделке
const FINAL_COST_FIELD_ID = process.env.MEGAPLAN_FINAL_COST_FIELD_ID || 'final-cost-field-id';

// ===========================
// HELPER FUNCTIONS
// ===========================

function getAuthHeader() {
  if (!MEGAPLAN_CONFIG.bearerToken) {
    throw new Error('MEGAPLAN_BEARER_TOKEN is not configured');
  }
  return `Bearer ${MEGAPLAN_CONFIG.bearerToken}`;
}

async function megaplanRequest(endpoint, params = {}) {
  try {
    const response = await axios.get(`${MEGAPLAN_CONFIG.apiUrl}${endpoint}`, {
      params,
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error('Megaplan API Error:', error.message);
    throw error;
  }
}

function getFieldByPath(obj, path) {
  if (!path) return '';

  if (path.startsWith('$.')) {
    const pathParts = path.slice(2).split('.');
    let value = obj;

    for (const part of pathParts) {
      if (value === null || value === undefined) return '';
      value = value[part];
    }

    if (value && typeof value === 'object' && 'value' in value) {
      return value.value;
    }

    return value || '';
  }

  return obj.customFields?.[path] || '';
}

// Update deal field via POST request
async function updateDealField(dealId, fieldValue) {
  try {
    const response = await axios.post(
      `${MEGAPLAN_CONFIG.apiUrl}/deal/${dealId}`,
      {
        customFields: {
          [CUSTOM_FIELDS.finalCost]: fieldValue
        }
      },
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    return response.data;
  } catch (error) {
    console.error('Update field error:', error.message);
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

    // 1. Fetch deal info
    const dealResponse = await megaplanRequest(`/deal/${dealId}`);
    const deal = dealResponse?.data;

    if (!deal) {
      return res.status(404).json({
        error: 'Deal not found'
      });
    }

    // 2. Fetch linked deals (expenses)
    const linkedDealsResponse = await megaplanRequest(`/deal/${dealId}/linkedDeals`);
    const linkedDeals = linkedDealsResponse?.data || [];

    if (linkedDeals.length === 0) {
      return res.status(200).json({
        dealId,
        dealName: deal.name,
        expensesCount: 0,
        totalAmount: 0,
        message: 'No linked expenses found',
        updated: false
      });
    }

    // 3. Fetch all tasks for each linked deal and calculate total
    let totalAmount = 0;

    for (const linkedDeal of linkedDeals) {
      try {
        const tasksResponse = await megaplanRequest(`/task`, {
          deal: linkedDeal.id,
          limit: 1000
        });

        const tasks = tasksResponse?.data || [];

        for (const task of tasks) {
          const finalCost = getFieldByPath(task, `$.customFields.${CUSTOM_FIELDS.finalCost}`);
          const amount = finalCost ? parseFloat(finalCost) : 0;
          if (!isNaN(amount)) {
            totalAmount += amount;
          }
        }
      } catch (error) {
        console.error(`Failed to fetch tasks for deal ${linkedDeal.id}:`, error.message);
      }
    }

    // 4. Update main deal field with total amount
    const roundedTotal = Math.round(totalAmount * 100) / 100;

    try {
      await updateDealField(dealId, roundedTotal);

      return res.status(200).json({
        dealId,
        dealName: deal.name,
        expensesCount: linkedDeals.length,
        totalAmount: roundedTotal,
        updated: true,
        message: 'Expenses synced successfully'
      });
    } catch (updateError) {
      return res.status(200).json({
        dealId,
        dealName: deal.name,
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
