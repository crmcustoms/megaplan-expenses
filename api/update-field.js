// api/update-field.js
// Обновление поля финальной стоимости в исходной сделке

const axios = require('axios');

// Custom field name for "Расходы Сумма Итого"
const FIELD_EXPENSES_TOTAL = 'Category1000061CustomFieldRashodiSummaItogo';

// Megaplan API configuration
const MEGAPLAN_ACCOUNT = process.env.MEGAPLAN_ACCOUNT || 'likhtman';
const MEGAPLAN_API_URL = `https://${MEGAPLAN_ACCOUNT}.megaplan.ru/api/v3`;
const MEGAPLAN_BEARER_TOKEN = process.env.MEGAPLAN_BEARER_TOKEN || '';

// Create axios instance with Bearer token auth
const megaplanAPI = axios.create({
  baseURL: MEGAPLAN_API_URL,
  headers: {
    'Authorization': `Bearer ${MEGAPLAN_BEARER_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

module.exports = async (req, res) => {
  try {
    const { dealId, fieldValue } = req.body;

    if (!dealId || fieldValue === undefined) {
      return res.status(400).json({
        error: 'Missing required parameters: dealId, fieldValue'
      });
    }

    // Log configuration for debugging
    if (!MEGAPLAN_BEARER_TOKEN) {
      console.warn('⚠️  WARNING: MEGAPLAN_BEARER_TOKEN is not configured!');
      console.log('Make sure MEGAPLAN_BEARER_TOKEN is set in .env file');
    }

    console.log(`Updating deal ${dealId} with expenses total: ${fieldValue}`);

    // Prepare the update payload
    const updatePayload = {
      contentType: 'Deal',
      id: dealId,
      [FIELD_EXPENSES_TOTAL]: {
        contentType: 'Money',
        value: fieldValue
      }
    };

    // Make API request to update deal
    const response = await megaplanAPI.put(`/deal/${dealId}`, updatePayload);

    console.log(`✅ Successfully updated deal ${dealId}`, {
      status: response.status,
      dealId: dealId,
      fieldValue: fieldValue
    });

    res.json({
      success: true,
      dealId: dealId,
      fieldValue: fieldValue,
      message: 'Deal field updated successfully'
    });

  } catch (error) {
    console.error('Error updating deal field:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      code: error.code
    });

    // Don't fail the whole request if update fails - it's not critical
    res.status(200).json({
      success: false,
      error: error.message,
      apiError: error.response?.data,
      note: 'Field update failed but request continues'
    });
  }
};
