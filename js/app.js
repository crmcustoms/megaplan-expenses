// ===========================
// CONFIGURATION
// ===========================

// API endpoints (змінити на свої)
const API_BASE_URL = '/api'; // Для production
// const API_BASE_URL = 'http://localhost:3000/api'; // Для local dev

const API_ENDPOINTS = {
  getExpenses: `${API_BASE_URL}/expenses`,
  exportCSV: `${API_BASE_URL}/export`
};

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
    
    // Відобразити дані
    renderTable(data.expenses);
    document.getElementById('dealName').textContent = data.dealName || 'Без названия';
    document.getElementById('totalAmount').textContent = formatNumber(data.total || 0);
    
    showContent(true);
    
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    showError(`Не удалось загрузить данные: ${error.message}`);
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
          📭 Расходов по проекту пока нет
        </td>
      </tr>
    `;
    return;
  }
  
  expenses.forEach(exp => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(exp.deal_id || '')}</td>
      <td>${renderStatus(exp.status)}</td>
      <td>${escapeHtml(exp.category || '')}</td>
      <td>${escapeHtml(exp.brand || '')}</td>
      <td>${escapeHtml(exp.contractor || '')}</td>
      <td>${escapeHtml(exp.paymentType || '')}</td>
      <td>${escapeHtml(exp.manager || '')}</td>
      <td class="col-number">${formatNumber(exp.amount)}</td>
      <td class="col-number">${formatNumber(exp.additionalCost)}</td>
      <td class="col-number">${formatNumber(exp.finalCost)}</td>
      <td class="col-number">${formatNumber(exp.fairCost)}</td>
      <td class="col-description">${escapeHtml(exp.description || '')}</td>
      <td>${renderDealLink(exp.dealLink)}</td>
      <td>${escapeHtml(exp.creator || '')}</td>
      <td class="text-center">${escapeHtml(exp.currency || '')}</td>
      <td class="col-deal-name">${escapeHtml(exp.deal_name || '')}</td>
    `;
    tbody.appendChild(row);
  });
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

function renderDealLink(url) {
  if (!url) return '';
  
  return `<a href="${escapeHtml(url)}" target="_blank" class="deal-link" title="Открыть сделку">🔗</a>`;
}

// ===========================
// EXPORT FUNCTIONALITY
// ===========================

async function exportExcel() {
  try {
    // Disable button
    const btn = document.getElementById('exportBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Генерация...';
    
    // Request CSV
    const url = `${API_ENDPOINTS.exportCSV}?dealId=${dealId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Ошибка экспорта');
    }
    
    // Get blob
    const blob = await response.blob();
    
    // Create download link
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    
    // Get filename from header or generate
    const contentDisposition = response.headers.get('Content-Disposition');
    const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
    a.download = filenameMatch?.[1] || `expenses_${dealId}_${Date.now()}.csv`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
    
    // Restore button
    btn.disabled = false;
    btn.innerHTML = '📥 Скачать Excel';
    
  } catch (error) {
    console.error('Ошибка экспорта:', error);
    alert('❌ Ошибка экспорта файла. Попробуйте еще раз.');
    
    // Restore button
    const btn = document.getElementById('exportBtn');
    btn.disabled = false;
    btn.innerHTML = '📥 Скачать Excel';
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
