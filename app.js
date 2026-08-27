// Invoicely - Freelance Invoice Generator Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // State
  let currentCurrency = '$';
  let currentAccentColor = '#4f46e5';
  let logoDataUrl = null;

  // DOM Elements
  const itemsTableBody = document.getElementById('itemsTableBody');
  const addItemBtn = document.getElementById('addItemBtn');
  const addPresetItemBtn = document.getElementById('addPresetItemBtn');
  const currencySelector = document.getElementById('currencySelector');
  const statusSelector = document.getElementById('statusSelector');
  const invoiceStatusRibbon = document.getElementById('invoiceStatusRibbon');
  const poweredByToggle = document.getElementById('poweredByToggle');
  const invoiceWatermark = document.getElementById('invoiceWatermark');
  
  // Color elements
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const customColorBtn = document.getElementById('customColorBtn');
  const customColorInput = document.getElementById('customColorInput');

  // Logo upload elements
  const logoUploadBox = document.getElementById('logoUploadBox');
  const logoFileInput = document.getElementById('logoFileInput');
  const logoPreview = document.getElementById('logoPreview');
  const logoPlaceholder = document.getElementById('logoPlaceholder');
  const removeLogoBtn = document.getElementById('removeLogoBtn');

  // Calculation Inputs
  const discountType = document.getElementById('discountType');
  const discountValue = document.getElementById('discountValue');
  const taxRate = document.getElementById('taxRate');
  const extraFee = document.getElementById('extraFee');
  const amountPaid = document.getElementById('amountPaid');

  // Calculation Displays
  const subtotalDisplay = document.getElementById('subtotalDisplay');
  const discountDisplay = document.getElementById('discountDisplay');
  const taxDisplay = document.getElementById('taxDisplay');
  const extraFeeDisplay = document.getElementById('extraFeeDisplay');
  const grandTotalDisplay = document.getElementById('grandTotalDisplay');
  const paidDisplay = document.getElementById('paidDisplay');
  const balanceDueDisplay = document.getElementById('balanceDueDisplay');
  const headerTotalDue = document.getElementById('headerTotalDue');

  // Metadata & Texts
  const invoiceDateInput = document.getElementById('invoiceDate');
  const dueDateInput = document.getElementById('dueDate');
  const senderEmail = document.getElementById('senderEmail');
  const footerEmailText = document.getElementById('footerEmailText');

  // Buttons
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const printBtn = document.getElementById('printBtn');
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const resetFormBtn = document.getElementById('resetFormBtn');
  const saveDraftBtn = document.getElementById('saveDraftBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const historyModalBtn = document.getElementById('historyModalBtn');
  const historyModal = document.getElementById('historyModal');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
  const savedInvoicesList = document.getElementById('savedInvoicesList');
  const savedCount = document.getElementById('savedCount');

  // 1. Initial Setup
  setDefaultDates();
  setAccentColor(currentAccentColor);
  loadInitialOrSavedState();
  updateSavedBadgeCount();

  // 2. Event Listeners for Dynamic Items
  addItemBtn.addEventListener('click', () => {
    addTableRow('', 1, 0);
    calculateTotals();
  });

  addPresetItemBtn.addEventListener('click', showPresetPrompt);

  // Input changes recalculate
  [discountType, discountValue, taxRate, extraFee, amountPaid].forEach(el => {
    el.addEventListener('input', calculateTotals);
  });

  // Currency change
  currencySelector.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      const customSym = prompt('Enter custom currency symbol (e.g. ₺, ₱, ₩, zł):', '$') || '$';
      currentCurrency = customSym;
    } else {
      currentCurrency = e.target.value;
    }
    updateCurrencySymbols();
    calculateTotals();
  });

  // Status Selector change
  statusSelector.addEventListener('change', updateStatusBadge);

  // Powered By Toggle
  poweredByToggle.addEventListener('change', () => {
    invoiceWatermark.style.display = poweredByToggle.checked ? 'flex' : 'none';
  });

  // Sender email sync with footer
  senderEmail.addEventListener('input', () => {
    footerEmailText.textContent = senderEmail.value || 'your email';
  });

  // Color Swatches
  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.getAttribute('data-color');
      setAccentColor(color);
      colorSwatches.forEach(s => s.classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-600'));
      swatch.classList.add('ring-2', 'ring-offset-2', 'ring-indigo-600');
    });
  });

  customColorBtn.addEventListener('click', () => customColorInput.click());
  customColorInput.addEventListener('input', (e) => setAccentColor(e.target.value));

  // Logo Upload
  logoUploadBox.addEventListener('click', (e) => {
    if (e.target !== removeLogoBtn && !removeLogoBtn.contains(e.target)) {
      logoFileInput.click();
    }
  });

  logoFileInput.addEventListener('change', handleLogoUpload);
  removeLogoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeLogo();
  });

  // Actions
  downloadPdfBtn.addEventListener('click', generatePDF);
  printBtn.addEventListener('click', () => window.print());
  loadSampleBtn.addEventListener('click', loadSampleData);
  resetFormBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the invoice to a blank template?')) {
      resetToBlank();
      showToast('Invoice reset to blank', 'info');
    }
  });

  saveDraftBtn.addEventListener('click', () => {
    saveCurrentInvoice();
    showToast('Invoice saved to your local storage!', 'success');
  });

  exportJsonBtn.addEventListener('click', exportInvoiceJson);

  // History Modal
  historyModalBtn.addEventListener('click', openHistoryModal);
  closeHistoryBtn.addEventListener('click', () => historyModal.classList.add('hidden'));
  clearAllHistoryBtn.addEventListener('click', clearAllInvoices);

  // Auto-save debounce on input
  document.getElementById('invoiceCanvas').addEventListener('input', debounce(() => {
    saveAutoDraft();
  }, 1000));

  // --- CORE FUNCTIONS ---

  function setDefaultDates() {
    const today = new Date();
    invoiceDateInput.value = today.toISOString().split('T')[0];

    const due = new Date();
    due.setDate(today.getDate() + 14); // 14 days net
    dueDateInput.value = due.toISOString().split('T')[0];
  }

  function addTableRow(description = '', qty = 1, rate = 0) {
    const row = document.createElement('tr');
    row.className = 'item-row border-b border-slate-100 group';
    row.innerHTML = `
      <td class="py-3 px-2">
        <input type="text" placeholder="Item description / Service rendered" value="${escapeHtml(description)}" class="item-desc w-full text-slate-800 font-medium placeholder-slate-400 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none transition-colors">
      </td>
      <td class="py-3 px-2 text-right">
        <input type="number" min="0" step="any" value="${qty}" class="item-qty w-20 text-right text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
      </td>
      <td class="py-3 px-2 text-right">
        <input type="number" min="0" step="any" value="${rate}" class="item-rate w-24 text-right text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
      </td>
      <td class="py-3 px-2 text-right font-semibold text-slate-800">
        <span class="currency-symbol">${currentCurrency}</span><span class="item-total">0.00</span>
      </td>
      <td class="py-3 px-2 text-center print:hidden">
        <button type="button" class="delete-row-btn opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-all" title="Remove item">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    `;

    // Row input listeners
    const qtyInput = row.querySelector('.item-qty');
    const rateInput = row.querySelector('.item-rate');
    const deleteBtn = row.querySelector('.delete-row-btn');

    const updateRowTotal = () => {
      const q = parseFloat(qtyInput.value) || 0;
      const r = parseFloat(rateInput.value) || 0;
      const tot = (q * r).toFixed(2);
      row.querySelector('.item-total').textContent = formatNumber(tot);
      calculateTotals();
    };

    qtyInput.addEventListener('input', updateRowTotal);
    rateInput.addEventListener('input', updateRowTotal);

    deleteBtn.addEventListener('click', () => {
      if (itemsTableBody.children.length > 1) {
        row.remove();
        calculateTotals();
      } else {
        showToast('Invoice must have at least one line item.', 'info');
      }
    });

    itemsTableBody.appendChild(row);
    if (window.lucide) lucide.createIcons();
    updateRowTotal();
  }

  function calculateTotals() {
    let subtotal = 0;
    const rows = itemsTableBody.querySelectorAll('tr');

    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
      const rate = parseFloat(row.querySelector('.item-rate')?.value) || 0;
      const total = qty * rate;
      subtotal += total;
      if (row.querySelector('.item-total')) {
        row.querySelector('.item-total').textContent = formatNumber(total.toFixed(2));
      }
    });

    // Subtotal
    subtotalDisplay.textContent = formatNumber(subtotal.toFixed(2));

    // Discount
    let discountAmount = 0;
    const discVal = parseFloat(discountValue.value) || 0;
    if (discountType.value === 'percent') {
      discountAmount = (subtotal * discVal) / 100;
    } else {
      discountAmount = discVal;
    }
    discountDisplay.textContent = formatNumber(discountAmount.toFixed(2));

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);

    // Tax
    const taxRateVal = parseFloat(taxRate.value) || 0;
    const taxAmount = (discountedSubtotal * taxRateVal) / 100;
    taxDisplay.textContent = formatNumber(taxAmount.toFixed(2));

    // Extra Fee / Shipping
    const extra = parseFloat(extraFee.value) || 0;
    extraFeeDisplay.textContent = formatNumber(extra.toFixed(2));

    // Grand Total
    const grandTotal = discountedSubtotal + taxAmount + extra;
    grandTotalDisplay.textContent = formatNumber(grandTotal.toFixed(2));

    // Amount Paid & Balance Due
    const paid = parseFloat(amountPaid.value) || 0;
    paidDisplay.textContent = formatNumber(paid.toFixed(2));

    const balanceDue = Math.max(0, grandTotal - paid);
    balanceDueDisplay.textContent = formatNumber(balanceDue.toFixed(2));
    headerTotalDue.textContent = formatNumber(balanceDue.toFixed(2));
  }

  function updateCurrencySymbols() {
    document.querySelectorAll('.currency-symbol').forEach(el => {
      el.textContent = currentCurrency;
    });
  }

  function setAccentColor(colorHex) {
    currentAccentColor = colorHex;
    document.documentElement.style.setProperty('--primary-accent', colorHex);
    
    // Compute RGB for shadows/focus rings
    const r = parseInt(colorHex.slice(1, 3), 16) || 79;
    const g = parseInt(colorHex.slice(3, 5), 16) || 70;
    const b = parseInt(colorHex.slice(5, 7), 16) || 229;
    document.documentElement.style.setProperty('--primary-accent-rgb', `${r}, ${g}, ${b}`);

    // Update dynamic accent elements
    document.getElementById('invoiceHeading').style.color = colorHex;
    document.getElementById('balanceDueBox').style.backgroundColor = colorHex;
  }

  function updateStatusBadge() {
    const status = statusSelector.value;
    invoiceStatusRibbon.className = 'absolute top-6 -right-12 transform rotate-45 text-white text-[11px] font-bold uppercase tracking-wider py-1 px-14 shadow-md text-center';

    if (status === 'DRAFT') {
      invoiceStatusRibbon.classList.remove('hidden');
      invoiceStatusRibbon.classList.add('status-draft');
      invoiceStatusRibbon.textContent = 'Draft';
    } else if (status === 'PENDING') {
      invoiceStatusRibbon.classList.remove('hidden');
      invoiceStatusRibbon.classList.add('status-pending');
      invoiceStatusRibbon.textContent = 'Pending';
    } else if (status === 'PAID') {
      invoiceStatusRibbon.classList.remove('hidden');
      invoiceStatusRibbon.classList.add('status-paid');
      invoiceStatusRibbon.textContent = 'Paid';
    } else if (status === 'OVERDUE') {
      invoiceStatusRibbon.classList.remove('hidden');
      invoiceStatusRibbon.classList.add('status-overdue');
      invoiceStatusRibbon.textContent = 'Overdue';
    } else {
      invoiceStatusRibbon.classList.add('hidden');
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      logoDataUrl = event.target.result;
      logoPreview.src = logoDataUrl;
      logoPreview.classList.remove('hidden');
      logoPlaceholder.classList.add('hidden');
      removeLogoBtn.classList.remove('hidden');
      showToast('Logo uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    logoDataUrl = null;
    logoPreview.src = '';
    logoPreview.classList.add('hidden');
    logoPlaceholder.classList.remove('hidden');
    removeLogoBtn.classList.add('hidden');
    logoFileInput.value = '';
  }

  function showPresetPrompt() {
    const presets = [
      { desc: 'Full-Stack Web Development (Milestone 1)', qty: 40, rate: 65 },
      { desc: 'Brand Identity & UI/UX Design System', qty: 1, rate: 1250 },
      { desc: 'Monthly SEO & Content Marketing Retainer', qty: 1, rate: 850 },
      { desc: 'Cloud Infrastructure Setup & DevOps Consulting', qty: 15, rate: 95 }
    ];

    const pick = prompt(
      "Choose a preset template:\n1. Full-Stack Web Development\n2. UI/UX Design System\n3. Monthly SEO Retainer\n4. Cloud / DevOps Setup\n\nEnter number (1-4):",
      "1"
    );

    const index = parseInt(pick, 10) - 1;
    if (presets[index]) {
      const p = presets[index];
      addTableRow(p.desc, p.qty, p.rate);
      calculateTotals();
      showToast(`Added: ${p.desc}`, 'success');
    }
  }

  // --- SAMPLE DATA & PRESETS ---

  function loadSampleData() {
    document.getElementById('senderName').value = 'Alex Morgan Design Co.';
    document.getElementById('senderTitle').value = 'Digital Product Designer & Consultant';
    document.getElementById('senderEmail').value = 'alex@morgancreatives.com';
    document.getElementById('senderAddress').value = '742 Evergreen Terrace, San Francisco, CA 94107';
    document.getElementById('senderTaxId').value = 'VAT ID: US-987456123';
    footerEmailText.textContent = 'alex@morgancreatives.com';

    document.getElementById('invoiceNumber').value = 'INV-2026-088';
    document.getElementById('poNumber').value = 'PO-9941';

    document.getElementById('clientName').value = 'Acme Global Ventures, Inc.';
    document.getElementById('clientContact').value = 'Attn: Sarah Jenkins (VP of Marketing)';
    document.getElementById('clientEmail').value = 'sarah@acmeglobal.io';
    document.getElementById('clientAddress').value = '100 Innovation Way, Suite 400, New York, NY 10001';

    itemsTableBody.innerHTML = '';
    addTableRow('SaaS Platform UI/UX Redesign (Phase 1 wireframes & user testing)', 35, 75);
    addTableRow('Interactive Design System & Tailwind Component Library in Figma', 1, 950);
    addTableRow('Design-to-Code Consultation & Developer Handoff Support', 8, 80);

    taxRate.value = 8.5;
    discountType.value = 'fixed';
    discountValue.value = 100;
    extraFee.value = 0;
    amountPaid.value = 1000;

    document.getElementById('paymentNotes').value = 
      "Wire Transfer:\nBank: Silicon Valley Bank\nAccount: 9876-5432-1098\nRouting / SWIFT: SVBUS6S\nPayPal: payments@morgancreatives.com";

    document.getElementById('invoiceTerms').value = 
      "Payment due within 14 days of invoice issue date. Thank you for your partnership!";

    document.getElementById('signatureText').value = 'Alex Morgan';

    statusSelector.value = 'PENDING';
    updateStatusBadge();
    calculateTotals();
    showToast('Loaded sample freelance invoice data!', 'success');
  }

  function resetToBlank() {
    document.querySelectorAll('#invoiceCanvas input, #invoiceCanvas textarea').forEach(el => {
      if (el.type !== 'date' && el.id !== 'invoiceNumber') {
        el.value = '';
      }
    });

    removeLogo();
    itemsTableBody.innerHTML = '';
    addTableRow('', 1, 0);

    taxRate.value = 0;
    discountValue.value = 0;
    extraFee.value = 0;
    amountPaid.value = 0;
    document.getElementById('invoiceNumber').value = 'INV-' + new Date().getFullYear() + '-001';
    
    setDefaultDates();
    statusSelector.value = 'PENDING';
    updateStatusBadge();
    calculateTotals();
  }

  // --- STORAGE & EXPORT ---

  function serializeForm() {
    const items = [];
    itemsTableBody.querySelectorAll('tr').forEach(row => {
      items.push({
        desc: row.querySelector('.item-desc')?.value || '',
        qty: row.querySelector('.item-qty')?.value || 1,
        rate: row.querySelector('.item-rate')?.value || 0
      });
    });

    return {
      id: document.getElementById('invoiceNumber').value || 'INV-' + Date.now(),
      savedAt: new Date().toISOString(),
      currency: currentCurrency,
      accentColor: currentAccentColor,
      status: statusSelector.value,
      logoDataUrl: logoDataUrl,
      sender: {
        name: document.getElementById('senderName').value,
        title: document.getElementById('senderTitle').value,
        email: document.getElementById('senderEmail').value,
        address: document.getElementById('senderAddress').value,
        taxId: document.getElementById('senderTaxId').value
      },
      invoice: {
        number: document.getElementById('invoiceNumber').value,
        date: invoiceDateInput.value,
        dueDate: dueDateInput.value,
        poNumber: document.getElementById('poNumber').value
      },
      client: {
        name: document.getElementById('clientName').value,
        contact: document.getElementById('clientContact').value,
        email: document.getElementById('clientEmail').value,
        address: document.getElementById('clientAddress').value
      },
      items: items,
      calculations: {
        discountType: discountType.value,
        discountValue: discountValue.value,
        taxRate: taxRate.value,
        extraFee: extraFee.value,
        amountPaid: amountPaid.value
      },
      paymentNotes: document.getElementById('paymentNotes').value,
      invoiceTerms: document.getElementById('invoiceTerms').value,
      signatureText: document.getElementById('signatureText').value
    };
  }

  function deserializeForm(data) {
    if (!data) return;

    if (data.currency) {
      currentCurrency = data.currency;
      currencySelector.value = data.currency;
      updateCurrencySymbols();
    }

    if (data.accentColor) {
      setAccentColor(data.accentColor);
    }

    if (data.status) {
      statusSelector.value = data.status;
      updateStatusBadge();
    }

    if (data.logoDataUrl) {
      logoDataUrl = data.logoDataUrl;
      logoPreview.src = logoDataUrl;
      logoPreview.classList.remove('hidden');
      logoPlaceholder.classList.add('hidden');
      removeLogoBtn.classList.remove('hidden');
    } else {
      removeLogo();
    }

    if (data.sender) {
      document.getElementById('senderName').value = data.sender.name || '';
      document.getElementById('senderTitle').value = data.sender.title || '';
      document.getElementById('senderEmail').value = data.sender.email || '';
      document.getElementById('senderAddress').value = data.sender.address || '';
      document.getElementById('senderTaxId').value = data.sender.taxId || '';
      footerEmailText.textContent = data.sender.email || 'your email';
    }

    if (data.invoice) {
      document.getElementById('invoiceNumber').value = data.invoice.number || '';
      invoiceDateInput.value = data.invoice.date || '';
      dueDateInput.value = data.invoice.dueDate || '';
      document.getElementById('poNumber').value = data.invoice.poNumber || '';
    }

    if (data.client) {
      document.getElementById('clientName').value = data.client.name || '';
      document.getElementById('clientContact').value = data.client.contact || '';
      document.getElementById('clientEmail').value = data.client.email || '';
      document.getElementById('clientAddress').value = data.client.address || '';
    }

    itemsTableBody.innerHTML = '';
    if (data.items && data.items.length > 0) {
      data.items.forEach(it => addTableRow(it.desc, it.qty, it.rate));
    } else {
      addTableRow('', 1, 0);
    }

    if (data.calculations) {
      discountType.value = data.calculations.discountType || 'percent';
      discountValue.value = data.calculations.discountValue || 0;
      taxRate.value = data.calculations.taxRate || 0;
      extraFee.value = data.calculations.extraFee || 0;
      amountPaid.value = data.calculations.amountPaid || 0;
    }

    document.getElementById('paymentNotes').value = data.paymentNotes || '';
    document.getElementById('invoiceTerms').value = data.invoiceTerms || '';
    document.getElementById('signatureText').value = data.signatureText || '';

    calculateTotals();
  }

  function saveAutoDraft() {
    const data = serializeForm();
    localStorage.setItem('invoicely_autodraft', JSON.stringify(data));
  }

  function loadInitialOrSavedState() {
    const draft = localStorage.getItem('invoicely_autodraft');
    if (draft) {
      try {
        deserializeForm(JSON.parse(draft));
        return;
      } catch (err) {
        console.error('Error loading draft', err);
      }
    }
    // Fallback to sample data for first time visit
    loadSampleData();
  }

  function saveCurrentInvoice() {
    const data = serializeForm();
    let history = getSavedInvoices();
    // Filter out if same ID already exists to update it
    history = history.filter(inv => inv.id !== data.id);
    history.unshift(data);
    localStorage.setItem('invoicely_history', JSON.stringify(history));
    updateSavedBadgeCount();
  }

  function getSavedInvoices() {
    try {
      return JSON.parse(localStorage.getItem('invoicely_history')) || [];
    } catch {
      return [];
    }
  }

  function updateSavedBadgeCount() {
    const list = getSavedInvoices();
    savedCount.textContent = list.length;
  }

  function openHistoryModal() {
    renderHistoryList();
    historyModal.classList.remove('hidden');
  }

  function renderHistoryList() {
    const list = getSavedInvoices();
    savedInvoicesList.innerHTML = '';

    if (list.length === 0) {
      savedInvoicesList.innerHTML = `
        <div class="text-center py-8 text-slate-400 text-xs">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          No saved invoices found yet. Click "Save Copy" to save your work!
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    list.forEach(inv => {
      const itemEl = document.createElement('div');
      itemEl.className = 'p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 transition-colors flex items-center justify-between';
      itemEl.innerHTML = `
        <div>
          <div class="flex items-center space-x-2">
            <span class="font-bold text-sm text-slate-800">${escapeHtml(inv.id)}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold uppercase">${inv.status || 'PENDING'}</span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(inv.client?.name || 'Unnamed Client')} • ${new Date(inv.savedAt).toLocaleDateString()}</p>
        </div>
        <div class="flex items-center space-x-2">
          <button class="load-inv-btn px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-all">
            Load
          </button>
          <button class="del-inv-btn p-1 text-slate-400 hover:text-rose-600 rounded transition-colors" title="Delete">
            <i data-lucide="trash" class="w-4 h-4"></i>
          </button>
        </div>
      `;

      itemEl.querySelector('.load-inv-btn').addEventListener('click', () => {
        deserializeForm(inv);
        historyModal.classList.add('hidden');
        showToast(`Loaded invoice ${inv.id}`, 'success');
      });

      itemEl.querySelector('.del-inv-btn').addEventListener('click', () => {
        let history = getSavedInvoices().filter(i => i.id !== inv.id);
        localStorage.setItem('invoicely_history', JSON.stringify(history));
        renderHistoryList();
        updateSavedBadgeCount();
        showToast('Invoice deleted', 'info');
      });

      savedInvoicesList.appendChild(itemEl);
    });

    if (window.lucide) lucide.createIcons();
  }

  function clearAllInvoices() {
    if (confirm('Clear all saved invoices from this browser?')) {
      localStorage.removeItem('invoicely_history');
      renderHistoryList();
      updateSavedBadgeCount();
      showToast('All saved invoices cleared', 'info');
    }
  }

  function exportInvoiceJson() {
    const data = serializeForm();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.id || 'invoice'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported invoice JSON data file', 'success');
  }

  // --- PDF GENERATION ---

  function generatePDF() {
    showToast('Generating single-page PDF...', 'info');

    const invoiceElement = document.getElementById('invoiceCanvas');
    const invoiceNum = document.getElementById('invoiceNumber').value || 'Invoice';
    const clientName = document.getElementById('clientName').value || 'Client';

    // Apply compact export mode
    invoiceElement.classList.add('exporting-pdf');

    const opt = {
      margin: [6, 6, 6, 6],
      filename: `${invoiceNum}_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true, 
        logging: false,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf()
      .set(opt)
      .from(invoiceElement)
      .save()
      .then(() => {
        showToast('PDF downloaded successfully on 1 page!', 'success');
      })
      .catch(err => {
        console.error(err);
        showToast('Error generating PDF. You can also use the Print button to Save as PDF.', 'error');
      })
      .finally(() => {
        // Revert export styles
        invoiceElement.classList.remove('exporting-pdf');
      });
  }

  // --- TOAST NOTIFICATIONS & HELPERS ---

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white shadow-emerald-200',
      error: 'bg-rose-600 text-white shadow-rose-200',
      info: 'bg-slate-900 text-white shadow-slate-300'
    };

    toast.className = `px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center space-x-2 transition-all transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

    document.getElementById('toastContainer').appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function formatNumber(val) {
    const parts = val.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function escapeHtml(string) {
    if (!string) return '';
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
});
