// api/update-field.js
// Обновление поля финальной стоимости в исходной сделке

const axios = require('axios');

// Custom field ID для "Расходы Сумма Итого"
const FIELD_EXPENSES_TOTAL = process.env.FIELD_EXPENSES_TOTAL || '1000061';

// Megaplan API base URL
const MEGAPLAN_ACCOUNT = process.env.MEGAPLAN_ACCOUNT || 'likhtman';
const MEGAPLAN_API_URL = `https://${MEGAPLAN_ACCOUNT}.megaplan.ru/api/v3`;

// Credentials for Megaplan API
const MEGAPLAN_LOGIN = process.env.MEGAPLAN_LOGIN;
const MEGAPLAN_PASSWORD = process.env.MEGAPLAN_PASSWORD;

// Create axios instance with auth
const megaplanAPI = axios.create({
  baseURL: MEGAPLAN_API_URL,
  auth: {
    username: MEGAPLAN_LOGIN,
    password: MEGAPLAN_PASSWORD
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

    console.log(`✅ Successfully updated deal ${dealId}`);

    res.json({
      success: true,
      dealId: dealId,
      fieldValue: fieldValue,
      message: 'Deal field updated successfully'
    });

  } catch (error) {
    console.error('Error updating deal field:', error.message);

    // Don't fail the whole request if update fails - it's not critical
    res.status(200).json({
      success: false,
      error: error.message,
      note: 'Field update failed but request continues'
    });
  }
};
