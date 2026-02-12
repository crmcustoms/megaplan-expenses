// api/sync.js
// Синхронизирует расходы: вычисляет сумму и обновляет финальную стоимость в основной сделке
// Используется для программного обновления, без отрисовки таблицы

const axios = require('axios');

// ===========================
// CONFIGURATION
// ===========================

const MEGAPLAN_ACCOUNT = process.env.MEGAPLAN_ACCOUNT || 'likhtman';
const MEGAPLAN_API_URL = `https://${MEGAPLAN_ACCOUNT}.megaplan.ru/api/v3`;
const MEGAPLAN_BEARER_TOKEN = process.env.MEGAPLAN_BEARER_TOKEN || '';

// Custom fields mapping for tasks (expenses)
const CUSTOM_FIELDS = {
  finalCost: process.env.FIELD_FINAL_COST || '1008'
};

// Field name for updating main deal (Расходы Сумма Итого)
const FIELD_EXPENSES_TOTAL = 'Category1000061CustomFieldRashodiSummaItogo';

// ===========================
// HELPER FUNCTIONS
// ===========================

// Create axios instance with Bearer token auth
const megaplanAPI = axios.create({
  baseURL: MEGAPLAN_API_URL,
  headers: {
    'Authorization': `Bearer ${MEGAPLAN_BEARER_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

async function megaplanRequest(endpoint, params = {}) {
  try {
    const response = await megaplanAPI.get(endpoint, { params });
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

// Update deal field via POST request (exact same format as api/update-field.js)
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

    const response = await megaplanAPI.post(`/deal/${dealId}`, updatePayload);
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

    // 3. Fetch full data for each linked deal and calculate total
    let totalAmount = 0;

    const linkedDealsFullData = await Promise.all(
      linkedDeals.map(summary => megaplanRequest(`/deal/${summary.id}`))
    );

    const linkedDealsData = linkedDealsFullData
      .map(response => response?.data)
      .filter(d => d !== null && d !== undefined);

    for (const linkedDeal of linkedDealsData) {
      let finalCostValue = 0;

      console.log(`[SYNC DEBUG] ========== Deal ${linkedDeal.id} ==========`);
      console.log(`[SYNC DEBUG] Program: ${linkedDeal.program?.id} (${linkedDeal.program?.name || 'unknown'})`);
      console.log(`[SYNC DEBUG] Name: ${linkedDeal.name}`);

      // Log available custom fields (first 20 keys)
      if (linkedDeal.customFields) {
        const fieldKeys = Object.keys(linkedDeal.customFields).slice(0, 20);
        console.log(`[SYNC DEBUG] Available fields (${Object.keys(linkedDeal.customFields).length} total):`, fieldKeys.join(', '));
      } else {
        console.log(`[SYNC DEBUG] No customFields found!`);
      }

      // Выбираем правильное поле в зависимости от программы подсделки
      if (linkedDeal.program?.id === '36') {
        // Логистика - используем Category1000084CustomFieldFinalnayaStoimost
        finalCostValue = getFieldByPath(linkedDeal, '$.customFields.Category1000084CustomFieldFinalnayaStoimost.valueInMain');
        console.log(`[SYNC DEBUG] Trying Category1000084CustomFieldFinalnayaStoimost.valueInMain: ${finalCostValue}`);

        // Если не найдено, попробуем альтернативный path
        if (!finalCostValue) {
          const altValue = getFieldByPath(linkedDeal, '$.customFields.Category1000084CustomFieldFinalnayaStoimost.value');
          console.log(`[SYNC DEBUG] Trying Category1000084CustomFieldFinalnayaStoimost.value: ${altValue}`);
          finalCostValue = altValue;
        }

      } else if (linkedDeal.program?.id === '35') {
        // Прочие поставщики - используем Category1000083CustomFieldFinalnayaStoimost
        finalCostValue = getFieldByPath(linkedDeal, '$.customFields.Category1000083CustomFieldFinalnayaStoimost.valueInMain');
        console.log(`[SYNC DEBUG] Trying Category1000083CustomFieldFinalnayaStoimost.valueInMain: ${finalCostValue}`);

        // Если не найдено, попробуем альтернативный path
        if (!finalCostValue) {
          const altValue = getFieldByPath(linkedDeal, '$.customFields.Category1000083CustomFieldFinalnayaStoimost.value');
          console.log(`[SYNC DEBUG] Trying Category1000083CustomFieldFinalnayaStoimost.value: ${altValue}`);
          finalCostValue = altValue;
        }

      } else {
        console.log(`[SYNC DEBUG] Unknown program: ${linkedDeal.program?.id}`);
      }

      const amount = finalCostValue ? parseFloat(finalCostValue) : 0;
      console.log(`[SYNC DEBUG] Final amount: ${amount}`);

      if (!isNaN(amount)) {
        totalAmount += amount;
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
