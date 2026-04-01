if (typeof Chart !== 'undefined') {
  Chart.defaults.devicePixelRatio = window.devicePixelRatio || 2;
}
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PERSONAL FINANCE TRACKER — script.js
   Part 1: Core Logic + Data Management
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

'use strict';

/* ─── STATE ─── */
let transactions = JSON.parse(localStorage.getItem('pft_transactions')) || [];
let budgets = JSON.parse(localStorage.getItem('pft_budgets')) || [];
let currency = localStorage.getItem('pft_currency') || 'INR';
let editingId = null;

const SYMBOLS = { INR: '₹', USD: '$' };

/* ─── DOM ELEMENTS ─── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const totalBalanceEl   = $('#totalBalance');
const totalIncomeEl    = $('#totalIncome');
const totalExpenseEl   = $('#totalExpense');
const transactionForm  = $('#transactionForm');
const formSubmitBtn    = $('#formSubmitBtn');
const typeSelect       = $('#type');
const categorySelect   = $('#category');
const amountInput      = $('#amount');
const dateInput        = $('#date');
const notesInput       = $('#notes');
const historyBody      = $('#historyBody');
const tableEmpty       = $('#tableEmpty');
const searchInput      = $('#searchInput');
const filterType       = $('#filterType');
const budgetForm       = $('#budgetForm');
const budgetBarsEl     = $('#budgetBars');
const budgetEmpty      = $('#budgetEmpty');
const pieEmpty         = $('#pieEmpty');
const barEmpty         = $('#barEmpty');
const exportCSVBtn     = $('#exportCSV');
const exportPDFBtn     = $('#exportPDF');
const resetAllBtn      = $('#resetAll');

/* ─── TOAST SYSTEM ─── */
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

/* ─── UTILITY FUNCTIONS ─── */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getSymbol() {
  return SYMBOLS[currency];
}

function formatAmount(amount) {
  return `${getSymbol()}${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function saveData() {
  localStorage.setItem('pft_transactions', JSON.stringify(transactions));
  localStorage.setItem('pft_budgets', JSON.stringify(budgets));
  localStorage.setItem('pft_currency', currency);
}

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.setAttribute('value', `${yyyy}-${mm}-${dd}`);
  dateInput.value = `${yyyy}-${mm}-${dd}`;
}

/* ─── CURRENCY TOGGLE ─── */
$$('.currency-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.currency-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currency = btn.dataset.currency;
    saveData();
    updateAll();
    showToast(`Currency changed to ${currency}`, 'info');
  });
});

function initCurrency() {
  $$('.currency-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.currency === currency);
  });
}

/* ─── CATEGORY SWITCHING ─── */
typeSelect.addEventListener('change', () => {
  updateCategoryOptions();
});

const INCOME_CATEGORIES = [
  { value: 'Salary',       label: '💼 Salary' },
  { value: 'Freelance',    label: '💻 Freelance' },
  { value: 'Investment',   label: '📈 Investment' },
  { value: 'Gift',         label: '🎁 Gift' },
  { value: 'Other Income', label: '📦 Other' }
];

const EXPENSE_CATEGORIES = [
  { value: 'Food',              label: '🍔 Food' },
  { value: 'Rent',              label: '🏠 Rent' },
  { value: 'Transport',         label: '🚗 Transport' },
  { value: 'Shopping',          label: '🛒 Shopping' },
  { value: 'Entertainment',     label: '🎬 Entertainment' },
  { value: 'Bills & Utilities', label: '💡 Bills & Utilities' },
  { value: 'Recharge',          label: '📱 Recharge' },
  { value: 'Health',            label: '💊 Health' },
  { value: 'Education',         label: '📚 Education' },
  { value: 'Other Expense',     label: '📦 Other' }
];

function updateCategoryOptions(selectedValue) {
  const type = typeSelect.value;
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  categorySelect.innerHTML = cats.map(c =>
    `<option value="${c.value}">${c.label}</option>`
  ).join('');

  if (selectedValue && cats.some(c => c.value === selectedValue)) {
    categorySelect.value = selectedValue;
  } else {
    categorySelect.value = cats[0].value;
  }
}

/* ─── SUMMARY CARDS ─── */
function updateSummary() {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = income - expense;

  totalBalanceEl.innerHTML = formatAmount(balance);
  totalIncomeEl.innerHTML = formatAmount(income);
  totalExpenseEl.innerHTML = formatAmount(expense);

  // Dynamic glow based on balance
  const balanceCard = document.querySelector('.balance-card');
  if (balance < 0) {
    balanceCard.style.borderColor = 'rgba(239,68,68,0.4)';
    totalBalanceEl.style.color = 'var(--red)';
  } else {
    balanceCard.style.borderColor = '';
    totalBalanceEl.style.color = 'var(--neon-purple)';
  }
}

/* ─── ADD / EDIT TRANSACTION ─── */
transactionForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const type     = typeSelect.value;
  const category = categorySelect.value;
  const amount   = parseFloat(amountInput.value);
  const date     = dateInput.value;
  const notes    = notesInput.value.trim();

  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount!', 'error');
    return;
  }
  if (!date) {
    showToast('Please select a date!', 'error');
    return;
  }

  if (editingId) {
    // Edit mode
    const index = transactions.findIndex(t => t.id === editingId);
    if (index !== -1) {
      transactions[index] = { ...transactions[index], type, category, amount, date, notes };
    }
    editingId = null;
    formSubmitBtn.querySelector('.btn-text').textContent = 'Add Transaction';
    formSubmitBtn.querySelector('.btn-icon').textContent = '+';
    showToast('Transaction updated! ✏️');
  } else {
    // Add mode
    const transaction = {
      id: generateId(),
      type,
      category,
      amount,
      date,
      notes,
      createdAt: new Date().toISOString()
    };
    transactions.unshift(transaction);
    showToast('Transaction added! 🎉');
  }

  saveData();
  updateAll();
  transactionForm.reset();
  setDefaultDate();
  updateCategoryOptions();
});

/* ─── EDIT TRANSACTION ─── */
function editTransaction(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  editingId = id;
  typeSelect.value = t.type;
  updateCategoryOptions(t.category);
  amountInput.value = t.amount;
  dateInput.value = t.date;
  notesInput.value = t.notes || '';

  formSubmitBtn.querySelector('.btn-text').textContent = 'Update Transaction';
  formSubmitBtn.querySelector('.btn-icon').textContent = '✓';

  // Scroll to form
  document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
  showToast('Editing transaction...', 'info');
}

/* ─── DELETE TRANSACTION ─── */
function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;
  transactions = transactions.filter(t => t.id !== id);
  saveData();
  updateAll();
  showToast('Transaction deleted! 🗑️');
}

/* ─── TRANSACTION HISTORY TABLE ─── */
function updateHistory() {
  const search = searchInput.value.toLowerCase();
  const filter = filterType.value;

  let filtered = transactions.filter(t => {
    const matchSearch = t.category.toLowerCase().includes(search) ||
                        (t.notes && t.notes.toLowerCase().includes(search)) ||
                        t.amount.toString().includes(search);
    const matchFilter = filter === 'all' || t.type === filter;
    return matchSearch && matchFilter;
  });

  if (filtered.length === 0) {
    historyBody.innerHTML = '';
    tableEmpty.style.display = 'block';
    document.querySelector('.history-table').style.display = 'none';
    return;
  }

  tableEmpty.style.display = 'none';
  document.querySelector('.history-table').style.display = 'table';

  historyBody.innerHTML = filtered.map(t => `
    <tr class="row-enter">
      <td>${new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td><span class="type-badge ${t.type}">${t.type === 'income' ? '💚 Income' : '❤️ Expense'}</span></td>
      <td>${t.category}</td>
      <td class="amount-${t.type}">${t.type === 'income' ? '+' : '-'}${formatAmount(t.amount)}</td>
      <td><span class="notes-text">${t.notes || '—'}</span></td>
      <td>
        <button class="action-btn edit" onclick="editTransaction('${t.id}')" title="Edit">✏️</button>
        <button class="action-btn delete" onclick="deleteTransaction('${t.id}')" title="Delete">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// Search & Filter listeners
searchInput.addEventListener('input', updateHistory);
filterType.addEventListener('change', updateHistory);


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Part 2: Charts, Budget, Export & Init
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ─── CHARTS ─── */
let pieChart = null;
let barChart = null;

const chartColors = [
  '#a855f7', '#3b82f6', '#06b6d4', '#22c55e',
  '#eab308', '#ef4444', '#f97316', '#ec4899',
  '#8b5cf6', '#14b8a6'
];

function updatePieChart() {
  const expenses = transactions.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    pieEmpty.style.display = 'block';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }
  pieEmpty.style.display = 'none';

  const categoryTotals = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  const ctx = document.getElementById('pieChart').getContext('2d');

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: chartColors.slice(0, labels.length),
        borderColor: '#080b12',
        borderWidth: 3,
        hoverBorderColor: '#a855f7',
        hoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            padding: 15,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#e2e8f0',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(168,85,247,0.3)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              const total = data.reduce((a, b) => a + b, 0);
              const percent = ((context.parsed / total) * 100).toFixed(1);
              return ` ${context.label}: ${formatAmount(context.parsed)} (${percent}%)`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

function updateBarChart() {
  if (transactions.length === 0) {
    barEmpty.style.display = 'block';
    if (barChart) { barChart.destroy(); barChart = null; }
    return;
  }
  barEmpty.style.display = 'none';

  const monthlyData = {};
  transactions.forEach(t => {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    monthlyData[key][t.type] += Number(t.amount);
  });

  const sortedKeys = Object.keys(monthlyData).sort();
  const labels = sortedKeys.map(k => {
    const [y, m] = k.split('-');
    return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  });

  const incomeData = sortedKeys.map(k => monthlyData[k].income);
  const expenseData = sortedKeys.map(k => monthlyData[k].expense);
  const ctx = document.getElementById('barChart').getContext('2d');

  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: 'rgba(34,197,94,1)',
          borderColor: '#22c55e',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Expense',
          data: expenseData,
          backgroundColor: 'rgba(239,68,68,1)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#e2e8f0',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(168,85,247,0.3)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatAmount(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            callback: function(value) { return getSymbol() + value; }
          },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });
}

/* ─── BUDGET MANAGER ─── */
budgetForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const category = $('#budgetCategory').value;
  const amount = parseFloat($('#budgetAmount').value);

  if (!amount || amount <= 0) {
    showToast('Enter a valid budget amount!', 'error');
    return;
  }

  const existingIndex = budgets.findIndex(b => b.category === category);
  if (existingIndex !== -1) {
    budgets[existingIndex].amount = amount;
    showToast(`Budget updated for ${category}! 🎯`);
  } else {
    budgets.push({ category, amount });
    showToast(`Budget set for ${category}! 🎯`);
  }

  saveData();
  updateBudgets();
  budgetForm.reset();
});

function updateBudgets() {
  if (budgets.length === 0) {
    budgetBarsEl.innerHTML = '';
    budgetEmpty.style.display = 'block';
    budgetBarsEl.appendChild(budgetEmpty);
    return;
  }

  budgetEmpty.style.display = 'none';
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  budgetBarsEl.innerHTML = budgets.map(budget => {
    const spent = transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' &&
               t.category === budget.category &&
               d.getMonth() === currentMonth &&
               d.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const percent = Math.min((spent / budget.amount) * 100, 100);
    let barClass = 'safe';
    let warningText = '';

    if (percent >= 100) {
      barClass = 'danger';
      warningText = `🔥 Over budget by ${formatAmount(spent - budget.amount)}!`;
    } else if (percent >= 75) {
      barClass = 'warning';
      warningText = '⚠️ Almost at limit!';
    }

    return `
      <div class="budget-bar-item fade-in">
        <div class="budget-bar-header">
          <span class="budget-bar-label">${budget.category}</span>
          <div>
            <span class="budget-bar-amount">${formatAmount(spent)} / ${formatAmount(budget.amount)}</span>
            <button class="budget-bar-delete" onclick="deleteBudget('${budget.category}')" title="Remove">✕</button>
          </div>
        </div>
        <div class="budget-bar-track">
          <div class="budget-bar-fill ${barClass}" style="width: ${percent}%"></div>
        </div>
        <div class="budget-bar-status">
          <span class="budget-bar-percent">${percent.toFixed(1)}% used</span>
          ${warningText ? `<span class="budget-bar-warning">${warningText}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function deleteBudget(category) {
  budgets = budgets.filter(b => b.category !== category);
  saveData();
  updateBudgets();
  showToast(`Budget removed for ${category}!`);
}

/* ─── EXPORT CSV ─── */
exportCSVBtn.addEventListener('click', () => {
  if (transactions.length === 0) {
    showToast('No transactions to export!', 'error');
    return;
  }

  const headers = ['Date', 'Type', 'Category', 'Amount', 'Notes'];
  const rows = transactions.map(t => [
    t.date,
    t.type,
    t.category,
    t.amount,
    `"${t.notes || ''}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-tracker-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported! 📥');
});

/* ─── EXPORT PDF ─── */
exportPDFBtn.addEventListener('click', () => {
  if (transactions.length === 0) {
    showToast('No transactions to export!', 'error');
    return;
  }

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  let html = `
    <html><head><title>Finance Report</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
      h1 { color: #a855f7; border-bottom: 2px solid #a855f7; padding-bottom: 10px; }
      .summary { display: flex; gap: 30px; margin: 20px 0; }
      .summary div { padding: 15px; background: #f8f9fa; border-radius: 8px; flex: 1; text-align: center; }
      .summary .label { font-size: 12px; color: #666; }
      .summary .amount { font-size: 20px; font-weight: bold; margin-top: 5px; }
      .income { color: #22c55e; }
      .expense { color: #ef4444; }
      .balance { color: #a855f7; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 12px; color: #64748b; }
      td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
      .footer { margin-top: 30px; font-size: 11px; color: #94a3b8; text-align: center; }
    </style></head><body>
    <h1>💰 Personal Finance Report</h1>
    <p>Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
    <div class="summary">
      <div><div class="label">BALANCE</div><div class="amount balance">${formatAmount(balance)}</div></div>
      <div><div class="label">INCOME</div><div class="amount income">${formatAmount(income)}</div></div>
      <div><div class="label">EXPENSE</div><div class="amount expense">${formatAmount(expense)}</div></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Notes</th></tr></thead>
      <tbody>
        ${transactions.map(t => `
          <tr>
            <td>${new Date(t.date).toLocaleDateString('en-IN')}</td>
            <td>${t.type}</td>
            <td>${t.category}</td>
            <td class="${t.type}">${t.type === 'income' ? '+' : '-'}${formatAmount(t.amount)}</td>
            <td>${t.notes || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="footer">Generated by Personal Finance Tracker | buildwithaman-lab</div>
    </body></html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
  showToast('PDF ready to print! 📄');
});

/* ─── RESET ALL ─── */
resetAllBtn.addEventListener('click', () => {
  if (!confirm('⚠️ Are you sure? This will delete ALL your data permanently!')) return;
  if (!confirm('🚨 Last chance! This cannot be undone. Continue?')) return;

  transactions = [];
  budgets = [];
  saveData();
  updateAll();
  showToast('All data has been reset!', 'info');
});

/* ─── UPDATE ALL ─── */
function updateAll() {
  updateSummary();
  updateHistory();
  updatePieChart();
  updateBarChart();
  updateBudgets();
}

/* ─── INIT ─── */
function init() {
  setDefaultDate();
  initCurrency();
  updateCategoryOptions();
  updateAll();
}

init();