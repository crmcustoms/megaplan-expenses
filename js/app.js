// ===========================
// CONFIGURATION
// ===========================

// API endpoints (змінити на свої)
const API_BASE_URL = '/api'; // Для production
// const API_BASE_URL = 'http://localhost:3000/api'; // Для local dev

const API_ENDPOINTS = {
  getExpenses: `${API_BASE_URL}/expenses`,
  exportCSV: `${API_BASE_URL}/export`,
  exportPDF: `${API_BASE_URL}/pdf`,
  updateDealField: `${API_BASE_URL}/update-deal-field`
};

// Global data storage
let expensesData = [];
let dealsData = {};

// ===========================
// INITIALIZATION
// ===========================

// Отримати dealId з URL параметрів
const urlParams = new URLSearchParams(window.location.search);
const dealId = urlParams.get('dealId');

// Завантажити дані при старті
window.addEventListener('DOMContentLoaded', async () => {
  if (!dealId) {
    showError('Deal ID не найден в URL параметрах');
    return;
  }
  
  await loadExpenses(dealId);
});

// ===========================
// DATA LOADING
// ===========================

async function loadExpenses(dealId) {
  try {
    showLoader(true);
    
    const response = await fetch(`${API_ENDPOINTS.getExpenses}?dealId=${dealId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();

    // Перевірка структури даних
    if (!data.expenses || !Array.isArray(data.expenses)) {
      throw new Error('Неверный формат данных от API');
    }

    // Save data globally for export functions
    expensesData = data.expenses;
    dealsData = {
      dealId: data.dealId,
      dealName: data.dealName,
      total: data.total
    };

    // Відобразити дані
    renderDashboard(data.expenses, data.total);
    renderTable(data.expenses);
    document.getElementById('dealName').textContent = data.dealName || 'Без названия';
    document.getElementById('totalAmount').textContent = formatNumber(data.total || 0);

    showContent(true);

    // Update deal field with total expenses
    await updateDealExpensesTotal(dealId, data.total);

  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    showError(`Не удалось загрузить данные: ${error.message}`);
  }
}

// ===========================
// DEAL UPDATE
// ===========================

async function updateDealExpensesTotal(dealId, totalAmount) {
  try {
    console.log('Updating deal field with total:', { dealId, totalAmount });

    const response = await fetch(API_ENDPOINTS.updateDealField, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dealId: dealId,
        fieldValue: totalAmount
      })
    });

    const data = await response.json();
    console.log('Deal field update response:', data);

    if (!response.ok) {
      console.warn('Не удалось обновить поле сделки:', data);
    } else {
      console.log('✅ Deal field updated successfully');
    }
  } catch (error) {
    console.warn('Ошибка при обновлении поля сделки:', error);
  }
}

// ===========================
// TABLE RENDERING
// ===========================

function renderTable(expenses) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  
  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="16" style="text-align: center; padding: 32px; color: #6B6B6B;">
          Расходов по проекту пока нет
        </td>
      </tr>
    `;
    return;
  }
  
  expenses.forEach(exp => {
    const row = document.createElement('tr');
    const amountWithCurrency = `${formatNumber(exp.amount)} ${exp.currency || 'RUB'}`;
    row.innerHTML = `
      <td>${escapeHtml(exp.deal_id || '')}</td>
      <td>${renderDealLink(exp.dealLink, exp.deal_name)}</td>
      <td class="col-description">${escapeHtml(stripHtmlTags(exp.description || ''))}</td>
      <td>${renderStatus(exp.status)}</td>
      <td>${escapeHtml(exp.category || '')}</td>
      <td>${escapeHtml(exp.brand || '')}</td>
      <td>${escapeHtml(exp.contractor || '')}</td>
      <td>${escapeHtml(exp.paymentType || '')}</td>
      <td>${escapeHtml(exp.manager || '')}</td>
      <td>${escapeHtml(exp.creator || '')}</td>
      <td class="col-number">${amountWithCurrency}</td>
      <td class="col-number">${formatNumber(exp.additionalCost)}</td>
      <td class="col-number">${formatNumber(exp.finalCost)}</td>
      <td class="col-number">${formatNumber(exp.fairCost)}</td>
    `;
    tbody.appendChild(row);
  });
}

// ===========================
// DASHBOARD RENDERING
// ===========================

function renderDashboard(expenses, total) {
  // 1. Общая сумма
  document.getElementById('totalExpenses').textContent = `₽${formatNumber(total)}`;

  // 2. Суммирование по валютам
  const currencyMap = {};
  expenses.forEach(exp => {
    const currency = exp.currency || 'RUB';
    if (!currencyMap[currency]) {
      currencyMap[currency] = 0;
    }
    currencyMap[currency] += exp.finalCost;
  });

  const currencyHtml = Object.entries(currencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([currency, amount]) => `
      <div class="currency-item">
        <span class="currency-label">${currency}</span>
        <span class="currency-value">${formatNumber(amount)}</span>
      </div>
    `)
    .join('');

  document.getElementById('currencySummary').innerHTML = currencyHtml || '<div class="currency-item">Нет данных</div>';

  // 3. Топ категории
  const categoryMap = {};
  expenses.forEach(exp => {
    const category = exp.category || 'Без категории';
    if (!categoryMap[category]) {
      categoryMap[category] = { count: 0, total: 0 };
    }
    categoryMap[category].count += 1;
    categoryMap[category].total += exp.finalCost;
  });

  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);

  const categoriesHtml = topCategories
    .map(([category, data]) => `
      <div class="category-item">
        <span class="category-label">${category}</span>
        <span class="category-value">${formatNumber(data.total)}</span>
      </div>
    `)
    .join('');

  document.getElementById('topCategories').innerHTML = categoriesHtml || '<div class="category-item">Нет данных</div>';
}

// ===========================
// RENDERING HELPERS
// ===========================

function renderStatus(status) {
  if (!status) return '';
  
  const statusLower = status.toLowerCase();
  let className = 'status-badge';
  
  if (statusLower.includes('оплачен') || statusLower.includes('paid')) {
    className += ' paid';
  } else if (statusLower.includes('ожида') || statusLower.includes('pending')) {
    className += ' pending';
  } else if (statusLower.includes('отмен') || statusLower.includes('cancel')) {
    className += ' cancelled';
  }
  
  return `<span class="${className}">${escapeHtml(status)}</span>`;
}

function renderDealLink(url, dealName) {
  if (!url) return '';

  return `<a href="${escapeHtml(url)}" target="_blank" class="deal-link" title="Открыть сделку">${escapeHtml(dealName || 'Сделка')}</a>`;
}

// ===========================
// EXPORT FUNCTIONALITY
// ===========================

async function exportExcel() {
  try {
    // Disable button
    const btn = document.getElementById('exportExcelBtn');
    btn.disabled = true;
    btn.textContent = 'Генерация...';

    if (!expensesData || expensesData.length === 0) {
      throw new Error('Нет данных для экспорта');
    }

    // Prepare headers
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

    // Prepare data rows
    const rows = expensesData.map(exp => [
      exp.deal_id || '',
      exp.deal_name || '',
      stripHtmlTags(exp.description || ''),
      exp.status || '',
      exp.category || '',
      exp.brand || '',
      exp.contractor || '',
      exp.paymentType || '',
      exp.manager || '',
      exp.creator || '',
      exp.amount || 0,
      exp.additionalCost || 0,
      exp.finalCost || 0,
      exp.fairCost || 0
    ]);

    // Calculate total
    const total = expensesData.reduce((sum, exp) => sum + (exp.finalCost || 0), 0);

    // Add total row
    rows.push([
      '', '', '', '', '', '', '', '', '', 'ИТОГО:',
      '', '', total, ''
    ]);

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set column widths
    ws['!cols'] = [
      { wch: 10 },  // deal_id
      { wch: 25 },  // Название сделки
      { wch: 35 },  // Суть
      { wch: 15 },  // Статус
      { wch: 18 },  // Статья расходов
      { wch: 12 },  // Бренд
      { wch: 18 },  // Контрагент
      { wch: 15 },  // Тип платежа
      { wch: 15 },  // Менеджер
      { wch: 15 },  // Создатель
      { wch: 14 },  // Сумма
      { wch: 14 },  // Доп.стоимость
      { wch: 18 },  // Финальная стоимость
      { wch: 18 }   // Справедливая стоимость
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Расходы');

    // Generate filename
    const filename = `expenses_${dealId}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);

    // Restore button
    btn.disabled = false;
    btn.textContent = 'Скачать Excel';

  } catch (error) {
    console.error('Ошибка экспорта Excel:', error);
    alert('Ошибка экспорта файла. Попробуйте еще раз.');

    // Restore button
    const btn = document.getElementById('exportExcelBtn');
    btn.disabled = false;
    btn.textContent = 'Скачать Excel';
  }
}

async function exportPDF() {
  try {
    // Disable button
    const btn = document.getElementById('exportPdfBtn');
    btn.disabled = true;
    btn.textContent = 'Генерация PDF...';

    const url = `${API_ENDPOINTS.exportPDF}?dealId=${dealId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Ошибка генерации PDF`);
    }

    // Get blob
    const blob = await response.blob();

    // Create download link
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `expenses_${dealId}_${new Date().toISOString().split('T')[0]}.pdf`;

    // Trigger download
    document.body.appendChild(a);
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);

    // Restore button
    btn.disabled = false;
    btn.textContent = 'Скачать PDF';

  } catch (error) {
    console.error('Ошибка экспорта PDF:', error);
    alert('Ошибка экспорта PDF. Попробуйте еще раз.');

    // Restore button
    const btn = document.getElementById('exportPdfBtn');
    btn.disabled = false;
    btn.textContent = 'Скачать PDF';
  }
}

// ===========================
// FORMATTING UTILITIES
// ===========================

function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '0.00';
  
  const number = parseFloat(num);
  
  if (isNaN(number)) return '0.00';
  
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}

function escapeHtml(text) {
  if (!text) return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function stripHtmlTags(text) {
  if (!text) return '';

  const div = document.createElement('div');
  div.innerHTML = text;
  return div.textContent || div.innerText || '';
}

// ===========================
// UI STATE MANAGEMENT
// ===========================

function showLoader(show) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
  document.getElementById('content').style.display = 'none';
  document.getElementById('error').style.display = 'none';
}

function showContent(show) {
  document.getElementById('loader').style.display = 'none';
  document.getElementById('content').style.display = show ? 'block' : 'none';
  document.getElementById('error').style.display = 'none';
}

function showError(message) {
  document.getElementById('loader').style.display = 'none';
  document.getElementById('content').style.display = 'none';
  
  const errorDiv = document.getElementById('error');
  errorDiv.querySelector('.error-description').textContent = message;
  errorDiv.style.display = 'flex';
}

// ===========================
// GLOBAL ERROR HANDLER
// ===========================

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});

// ===========================
// DEBUG INFO
// ===========================

console.log('Megaplan Expenses App initialized');
console.log('Deal ID:', dealId);
console.log('API Base URL:', API_BASE_URL);
