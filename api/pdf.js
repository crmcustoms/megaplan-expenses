// api/pdf.js
// API endpoint для генерации PDF через Gotenberg

const axios = require('axios');

// ===========================
// CONFIGURATION
// ===========================

const MEGAPLAN_CONFIG = {
  account: process.env.MEGAPLAN_ACCOUNT || 'likhtman',
  bearerToken: process.env.MEGAPLAN_BEARER_TOKEN || '',
  apiUrl: process.env.MEGAPLAN_API_URL || 'https://likhtman.megaplan.ru/api/v3'
};

const GOTENBERG_URL = process.env.GOTENBERG_URL || 'http://localhost:3001';

// Custom fields mapping
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

function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '0.00';
  const number = parseFloat(num);
  if (isNaN(number)) return '0.00';
  return number.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function stripHtmlTags(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '');
}

function generateStatusBadgeColor(status) {
  if (!status) return '#94A3B8';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('оплачен') || statusLower.includes('paid')) {
    return '#10B981'; // Green
  } else if (statusLower.includes('ожида') || statusLower.includes('pending')) {
    return '#F59E0B'; // Yellow
  } else if (statusLower.includes('отмен') || statusLower.includes('cancel')) {
    return '#EF4444'; // Red
  }
  return '#94A3B8';
}

// ===========================
// PDF HTML GENERATION
// ===========================

function generatePDFHtml(dealName, expenses, total) {
  const statusTextColor = '#FFFFFF';
  const today = new Date().toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const tableRows = expenses.map(exp => `
    <tr style="border-bottom: 1px solid #E2E8F0;">
      <td style="padding: 10px; font-size: 12px; text-align: left; border-right: 1px solid #E2E8F0;">${escapeHtml(exp.deal_id || '')}</td>
      <td style="padding: 10px; font-size: 12px; text-align: left; border-right: 1px solid #E2E8F0;">${escapeHtml(exp.deal_name || '')}</td>
      <td style="padding: 10px; font-size: 12px; text-align: left; border-right: 1px solid #E2E8F0;">${escapeHtml(stripHtmlTags(exp.description || ''))}</td>
      <td style="padding: 10px; font-size: 12px; text-align: center; border-right: 1px solid #E2E8F0;">
        <span style="background-color: ${generateStatusBadgeColor(exp.status)}; color: ${statusTextColor}; padding: 4px 8px; border-radius: 4px; font-weight: 600; display: inline-block;">
          ${escapeHtml(exp.status || '')}
        </span>
      </td>
      <td style="padding: 10px; font-size: 12px; text-align: left; border-right: 1px solid #E2E8F0;">${escapeHtml(exp.category || '')}</td>
      <td style="padding: 10px; font-size: 12px; text-align: left; border-right: 1px solid #E2E8F0;">${escapeHtml(exp.brand || '')}</td>
      <td style="padding: 10px; font-size: 12px; text-align: left; border-right: 1px solid #E2E8F0;">${escapeHtml(exp.contractor || '')}</td>
      <td style="padding: 10px; font-size: 12px; text-align: left; border-right: 1px solid #E2E8F0;">${escapeHtml(exp.paymentType || '')}</td>
      <td style="padding: 10px; font-size: 12px; text-align: left; border-right: 1px solid #E2E8F0;">${escapeHtml(exp.manager || '')}</td>
      <td style="padding: 10px; font-size: 12px; text-align: left; border-right: 1px solid #E2E8F0;">${escapeHtml(exp.creator || '')}</td>
      <td style="padding: 10px; font-size: 12px; text-align: right; border-right: 1px solid #E2E8F0;">${formatNumber(exp.amount || 0)} ${exp.currency || 'RUB'}</td>
      <td style="padding: 10px; font-size: 12px; text-align: right; border-right: 1px solid #E2E8F0;">${formatNumber(exp.additionalCost || 0)}</td>
      <td style="padding: 10px; font-size: 12px; text-align: right; border-right: 1px solid #E2E8F0;">${formatNumber(exp.finalCost || 0)}</td>
      <td style="padding: 10px; font-size: 12px; text-align: right;">${formatNumber(exp.fairCost || 0)}</td>
    </tr>
  `).join('');

  const totalRow = `
    <tr style="background-color: #F1F5F9; border-top: 2px solid #E2E8F0;">
      <td colspan="9" style="padding: 12px; font-size: 14px; text-align: right; font-weight: 700; border-right: 1px solid #E2E8F0;">ИТОГО:</td>
      <td style="padding: 12px; font-size: 14px; text-align: right; border-right: 1px solid #E2E8F0; font-weight: 700;"></td>
      <td style="padding: 12px; font-size: 14px; text-align: right; border-right: 1px solid #E2E8F0; font-weight: 700;"></td>
      <td style="padding: 12px; font-size: 14px; text-align: right; border-right: 1px solid #E2E8F0; font-weight: 700;"></td>
      <td style="padding: 12px; font-size: 14px; text-align: right; font-weight: 700; color: #3B82F6;">${formatNumber(total)}</td>
      <td style="padding: 12px; font-size: 14px; text-align: right; font-weight: 700;"></td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Расходы - ${dealName}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: Arial, sans-serif;
          color: #1E293B;
          background: #FFFFFF;
          padding: 20px;
          line-height: 1.6;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          margin-bottom: 32px;
        }
        .title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #1E293B;
        }
        .subtitle {
          font-size: 14px;
          color: #64748B;
          margin-bottom: 16px;
        }
        .summary {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }
        .summary-card {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          padding: 16px;
        }
        .summary-card-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #64748B;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        .summary-card-value {
          font-size: 20px;
          font-weight: 700;
          color: #1E293B;
        }
        .table-container {
          overflow-x: auto;
          margin-bottom: 32px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: #FFFFFF;
        }
        thead {
          background: #F1F5F9;
          border-bottom: 1px solid #E2E8F0;
        }
        th {
          padding: 12px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          white-space: nowrap;
          border-right: 1px solid #E2E8F0;
        }
        th:last-child {
          border-right: none;
        }
        footer {
          font-size: 12px;
          color: #94A3B8;
          text-align: center;
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #E2E8F0;
        }
        @media print {
          body {
            padding: 0;
          }
          .container {
            max-width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">Расходы по проекту</h1>
          <div class="subtitle">"${escapeHtml(dealName)}"</div>
          <div class="subtitle">Дата отчета: ${today}</div>
        </div>

        <div class="summary">
          <div class="summary-card">
            <div class="summary-card-label">Общая сумма</div>
            <div class="summary-card-value">₽${formatNumber(total)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-card-label">Записей</div>
            <div class="summary-card-value">${expenses.length}</div>
          </div>
          <div class="summary-card">
            <div class="summary-card-label">Средняя сумма</div>
            <div class="summary-card-value">₽${formatNumber(total / Math.max(1, expenses.length))}</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>deal_id</th>
                <th>Название сделки</th>
                <th>Суть</th>
                <th>Статус</th>
                <th>Статья расходов</th>
                <th>Бренд</th>
                <th>Контрагент</th>
                <th>Тип платежа</th>
                <th>Менеджер</th>
                <th>Создатель</th>
                <th>Сумма</th>
                <th>Доп.стоимость</th>
                <th>Финальная стоимость</th>
                <th>Справедливая стоимость</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              ${totalRow}
            </tbody>
          </table>
        </div>

        <footer>
          <p>Этот отчет был сгенерирован автоматически</p>
        </footer>
      </div>
    </body>
    </html>
  `;
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
    const { dealId } = req.query;

    if (!dealId) {
      return res.status(400).json({
        error: 'dealId parameter is required'
      });
    }

    console.log(`Generating PDF for deal ${dealId}...`);

    // 1. Get deal info
    const deal = await megaplanRequest(`/deal/${dealId}`);

    if (!deal || !deal.data) {
      return res.status(404).json({
        error: 'Deal not found'
      });
    }

    // 2. Get linked deals
    const linkedDealsResponse = await megaplanRequest(`/deal/${dealId}/linkedDeals`);
    const linkedDealSummaries = linkedDealsResponse?.data || [];

    // 3. Fetch full data for each linked deal
    const linkedDealsFullData = await Promise.all(
      linkedDealSummaries.map(summary => megaplanRequest(`/deal/${summary.id}`))
    );

    const linkedDeals = linkedDealsFullData
      .map(response => response?.data)
      .filter(d => d !== null && d !== undefined);

    // 4. Map to expense objects (similar to api/expenses.js)
    const getFieldByPath = (obj, path) => {
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
    };

    const expenses = linkedDeals.map(linkedDeal => ({
      deal_id: linkedDeal.id,
      status: getFieldByPath(linkedDeal, CUSTOM_FIELDS.status),
      category: getFieldByPath(linkedDeal, CUSTOM_FIELDS.category),
      brand: getFieldByPath(linkedDeal, CUSTOM_FIELDS.brand),
      contractor: linkedDeal.contractor
        ? (linkedDeal.contractor.firstName || linkedDeal.contractor.lastName
            ? `${linkedDeal.contractor.firstName || ''} ${linkedDeal.contractor.lastName || ''}`.trim()
            : linkedDeal.contractor.name || '')
        : '',
      paymentType: getFieldByPath(linkedDeal, CUSTOM_FIELDS.paymentType),
      amount: parseFloat(getFieldByPath(linkedDeal, CUSTOM_FIELDS.amount)) || 0,
      additionalCost: parseFloat(getFieldByPath(linkedDeal, CUSTOM_FIELDS.additionalCost)) || 0,
      finalCost: parseFloat(getFieldByPath(linkedDeal, CUSTOM_FIELDS.finalCost)) || 0,
      fairCost: parseFloat(getFieldByPath(linkedDeal, CUSTOM_FIELDS.fairCost)) || 0,
      currency: getFieldByPath(linkedDeal, CUSTOM_FIELDS.currency) || 'RUB',
      description: linkedDeal.description || linkedDeal.name || '',
      deal_name: linkedDeal.name || '',
      manager: linkedDeal.manager?.name || linkedDeal.responsible?.name || deal.data.manager?.name || deal.data.responsible?.name || '',
      owner: linkedDeal.owner?.name || linkedDeal.createdBy?.name || '',
      creator: linkedDeal.createdBy?.name || ''
    }));

    // 5. Calculate total
    const total = expenses.reduce((sum, exp) => sum + exp.finalCost, 0);

    // 6. Generate HTML
    const html = generatePDFHtml(deal.data.name, expenses, total);

    // 7. Send to Gotenberg for PDF generation
    console.log(`Sending to Gotenberg for PDF conversion...`);

    const formData = new (require('form-data'))();
    formData.append('files', Buffer.from(html), {
      filename: 'index.html',
      contentType: 'text/html'
    });

    const response = await axios.post(
      `${GOTENBERG_URL}/forms/chromium/convert/html`,
      formData,
      {
        headers: formData.getHeaders(),
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    // 8. Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${dealId}.pdf"`);
    res.send(response.data);

    console.log(`PDF generated successfully for deal ${dealId}`);

  } catch (error) {
    console.error('PDF export error:', error);

    // Check if it's a Gotenberg connection error
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({
        error: 'PDF service unavailable. Please check if Gotenberg is running.'
      });
    }

    res.status(500).json({
      error: 'Ошибка генерации PDF',
      message: error.message
    });
  }
};
