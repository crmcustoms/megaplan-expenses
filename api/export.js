// api/export.js
// API endpoint для экспорта расходов в CSV

const axios = require('axios');

// ===========================
// CONFIGURATION
// ===========================

const MEGAPLAN_CONFIG = {
  account: process.env.MEGAPLAN_ACCOUNT || 'likhtman',
  bearerToken: process.env.MEGAPLAN_BEARER_TOKEN || '',
  apiUrl: process.env.MEGAPLAN_API_URL || 'https://likhtman.megaplan.ru/api/v3'
};

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
    manager: expenseDeal.manager?.name || expenseDeal.responsible?.name || '',
    owner: expenseDeal.manager?.name || expenseDeal.responsible?.name || '',
    deal_name: expenseDeal.name || ''
  };
}

// ===========================
// CSV GENERATION
// ===========================

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  // Если есть запятая, кавычка или перенос - оборачиваем в кавычки
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

function generateCSV(expenses, total) {
  const headers = [
    'deal_id',
    'Название сделки',
    'Суть',
    'Статус',
    'Статья расходов',
    'Бренд',
    'Контрагент',
    'Тип платежа',
    'Менеджер',
    'Создатель',
    'Сумма',
    'Доп.стоимость',
    'Финальная стоимость',
    'Справедливая стоимость'
  ];

  const csvRows = [];

  // Header row
  csvRows.push(headers.map(h => escapeCSV(h)).join(','));

  // Data rows
  expenses.forEach(exp => {
    const amountWithCurrency = `${exp.amount.toFixed(2)} ${exp.currency}`;
    const row = [
      exp.deal_id,
      exp.dealLink + ' | ' + exp.deal_name,
      exp.description,
      exp.status,
      exp.category,
      exp.brand,
      exp.contractor,
      exp.paymentType,
      exp.manager,
      exp.owner,
      amountWithCurrency,
      exp.additionalCost.toFixed(2),
      exp.finalCost.toFixed(2),
      exp.fairCost.toFixed(2)
    ];

    csvRows.push(row.map(v => escapeCSV(v)).join(','));
  });

  // Total row
  const totalRow = [
    '', '', '', '', '', '', '', '', '', '', // Empty columns
    'ИТОГО:',
    total.toFixed(2),
    '', '' // Rest empty
  ];

  csvRows.push(totalRow.map(v => escapeCSV(v)).join(','));

  // Join with newlines
  const csvContent = csvRows.join('\n');

  // КРИТИЧНО! UTF-8 BOM для Excel
  const BOM = '\uFEFF';

  return BOM + csvContent;
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

    console.log(`[${new Date().toISOString()}] 📊 Exporting expenses for deal ${dealId} - webhook deployment active`);
    
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
    
    // 6. Generate CSV
    const csvContent = generateCSV(mappedExpenses, total);
    
    // 7. Generate filename
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `expenses_${dealId}_${timestamp}.csv`;
    
    // 8. Set headers and send
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    return res.status(200).send(csvContent);
    
  } catch (error) {
    console.error('Export Error:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};
