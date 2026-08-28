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


  // ─── PDF GENERATION — Professional Balanced Layout ───────────────────────

  async function generatePDF() {
    showToast('Generating PDF...', 'info');

    const invoiceNum    = document.getElementById('invoiceNumber').value  || 'Invoice';
    const clientName    = document.getElementById('clientName').value     || 'Client';
    const filename      = `${invoiceNum}_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const accent        = currentAccentColor;

    const senderName    = document.getElementById('senderName').value;
    const senderTitle   = document.getElementById('senderTitle').value;
    const senderEmailV  = document.getElementById('senderEmail').value;
    const senderAddress = document.getElementById('senderAddress').value;
    const senderTaxId   = document.getElementById('senderTaxId').value;
    const invDate       = document.getElementById('invoiceDate').value;
    const dueDate       = document.getElementById('dueDate').value;
    const poNumber      = document.getElementById('poNumber').value;
    const clientContact = document.getElementById('clientContact').value;
    const clientEmail   = document.getElementById('clientEmail').value;
    const clientAddress = document.getElementById('clientAddress').value;
    const paymentNotes  = document.getElementById('paymentNotes').value;
    const invoiceTerms  = document.getElementById('invoiceTerms').value;
    const signatureText = document.getElementById('signatureText').value;
    const showWatermark = document.getElementById('poweredByToggle').checked;
    const statusLabel   = document.getElementById('statusSelector').value;

    let itemsHTML = '';
    let subtotal = 0;
    let rowIdx = 0;
    document.querySelectorAll('#itemsTableBody tr').forEach(row => {
      const desc  = row.querySelector('.item-desc')?.value  || '';
      const qty   = parseFloat(row.querySelector('.item-qty')?.value)  || 0;
      const rate  = parseFloat(row.querySelector('.item-rate')?.value) || 0;
      const total = qty * rate;
      subtotal += total;
      const bg = rowIdx % 2 === 0 ? '#ffffff' : '#fafbfc';
      rowIdx++;
      itemsHTML += `<tr style="background:${bg};border-bottom:1px solid #f1f5f9;">
        <td style="padding:9px 12px;font-size:10.5px;color:#0f172a;font-weight:500;word-wrap:break-word;word-break:break-word;width:50%;">${escapeHtml(desc)}</td>
        <td style="padding:9px 10px;font-size:10.5px;color:#475569;text-align:right;white-space:nowrap;width:12%;">${qty}</td>
        <td style="padding:9px 10px;font-size:10.5px;color:#475569;text-align:right;white-space:nowrap;width:18%;">${currentCurrency}${formatNumber(rate.toFixed(2))}</td>
        <td style="padding:9px 12px;font-size:10.5px;color:#0f172a;font-weight:700;text-align:right;white-space:nowrap;width:20%;">${currentCurrency}${formatNumber(total.toFixed(2))}</td>
      </tr>`;
    });

    const discType    = document.getElementById('discountType').value;
    const discVal     = parseFloat(document.getElementById('discountValue').value) || 0;
    const taxRateV    = parseFloat(document.getElementById('taxRate').value) || 0;
    const extraFeeV   = parseFloat(document.getElementById('extraFee').value) || 0;
    const paidAmt     = parseFloat(document.getElementById('amountPaid').value) || 0;
    const discountAmt = discType === 'percent' ? subtotal * discVal / 100 : discVal;
    const discounted  = Math.max(0, subtotal - discountAmt);
    const taxAmt      = discounted * taxRateV / 100;
    const grandTotal  = discounted + taxAmt + extraFeeV;
    const balanceDue  = Math.max(0, grandTotal - paidAmt);

    const logoHTML = logoDataUrl
      ? `<img src="${logoDataUrl}" style="max-width:95px;max-height:48px;object-fit:contain;display:block;margin-bottom:10px;" alt="Logo">`
      : '';

    const senderLines    = [senderTitle, senderEmailV, senderAddress, senderTaxId].filter(Boolean).map(v => escapeHtml(v)).join('<br>');
    const clientLines    = [clientContact, clientEmail, clientAddress].filter(Boolean).map(v => escapeHtml(v)).join('<br>');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;width:794px;}
.page{display:flex;}
.sidebar{width:5px;background:${accent};flex-shrink:0;}
.content{flex:1;padding:30px 32px 24px 28px;}

.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;margin-bottom:18px;border-bottom:1.5px solid #e2e8f0;}
.sn{font-size:16px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;margin-bottom:4px;}
.sm{font-size:9.5px;color:#64748b;line-height:1.8;}
.hr{text-align:right;}
.iw{font-size:34px;font-weight:900;color:${accent};text-transform:uppercase;letter-spacing:-1.5px;line-height:1;margin-bottom:4px;}
.sb{display:inline-block;padding:3px 12px;border-radius:20px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;background:#f0f0ff;color:${accent};border:1px solid #c7c7ff;margin-bottom:6px;}
.im{display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
.mr{display:flex;gap:12px;font-size:10px;}
.ml{color:#94a3b8;min-width:70px;text-align:right;}
.mv{font-weight:700;color:#0f172a;min-width:115px;text-align:right;}

.ir{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;gap:18px;}
.bb{flex:1;}
.slbl{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:6px;}
.cn{font-size:14px;font-weight:800;color:#0f172a;margin-bottom:3px;}
.cs{font-size:10px;color:#64748b;line-height:1.7;}
.bx{width:188px;flex-shrink:0;background:${accent};border-radius:10px;padding:14px 16px;color:#fff;text-align:right;}
.bxl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;opacity:0.8;margin-bottom:5px;}
.bxa{font-size:21px;font-weight:900;letter-spacing:-0.5px;line-height:1;}
.bxd{font-size:9px;opacity:0.75;margin-top:5px;}

table.it{width:100%;border-collapse:collapse;margin-bottom:14px;}
table.it thead tr{background:#f8fafc;}
table.it thead th{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;padding:8px 10px;text-align:right;}
table.it thead th:first-child{text-align:left;padding-left:12px;border-radius:6px 0 0 6px;}
table.it thead th:last-child{padding-right:12px;border-radius:0 6px 6px 0;}
table.it tbody tr:last-child{border-bottom:2px solid #e2e8f0;}

.br{display:flex;gap:26px;align-items:flex-start;}
.nc{flex:1;min-width:0;}
.nl{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:5px;display:flex;align-items:center;gap:6px;}
.nlbar{display:inline-block;width:3px;height:11px;background:${accent};border-radius:2px;flex-shrink:0;vertical-align:middle;}
.nt{font-size:9.5px;color:#475569;line-height:1.8;white-space:pre-wrap;word-wrap:break-word;}
.ng{height:11px;}

.tc{width:215px;flex-shrink:0;}
.tl{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#64748b;padding:4px 0;border-bottom:1px solid #f1f5f9;}
.tnb{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#64748b;padding:4px 0;}
.tv{font-weight:600;color:#1e293b;}
.tg{font-weight:600;color:#059669;}
.tt{display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#0f172a;padding:6px 0;border-bottom:2px solid #e2e8f0;}
.tb{background:${accent};color:#fff;border-radius:8px;padding:10px 13px;margin-top:9px;text-align:center;}
.tbl{display:block;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;opacity:0.8;margin-bottom:3px;}
.tbv{display:block;font-size:16px;font-weight:900;}

.ft{margin-top:16px;padding-top:14px;border-top:1.5px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;}
.fn{font-size:9px;color:#94a3b8;line-height:1.7;}
.fn strong{color:#64748b;}
.sw{text-align:right;}
.ssn{font-family:Georgia,serif;font-style:italic;font-size:21px;color:${accent};font-weight:600;line-height:1;}
.sigline{width:148px;height:1px;background:#cbd5e1;margin:5px 0 3px auto;}
.siglbl{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;}
.wm{text-align:center;font-size:8px;color:#d1d5db;padding-top:9px;}
</style></head>
<body><div class="page"><div class="sidebar"></div><div class="content">

<div class="hdr">
  <div>${logoHTML}<div class="sn">${escapeHtml(senderName)||'Your Business'}</div><div class="sm">${senderLines}</div></div>
  <div class="hr">
    <div class="iw">Invoice</div>
    <div class="sb">${escapeHtml(statusLabel)}</div>
    <div class="im">
      <div class="mr"><span class="ml">Invoice&nbsp;#</span><span class="mv">${escapeHtml(invoiceNum)}</span></div>
      ${invDate  ? `<div class="mr"><span class="ml">Issue&nbsp;Date</span><span class="mv">${escapeHtml(invDate)}</span></div>`     : ''}
      ${dueDate  ? `<div class="mr"><span class="ml">Due&nbsp;Date</span><span class="mv">${escapeHtml(dueDate)}</span></div>`       : ''}
      ${poNumber ? `<div class="mr"><span class="ml">PO&nbsp;/&nbsp;Ref</span><span class="mv">${escapeHtml(poNumber)}</span></div>` : ''}
    </div>
  </div>
</div>

<div class="ir">
  <div class="bb">
    <div class="slbl">Billed To</div>
    <div class="cn">${escapeHtml(clientName)}</div>
    <div class="cs">${clientLines}</div>
  </div>
  <div class="bx">
    <div class="bxl">Balance Due</div>
    <div class="bxa">${currentCurrency}${formatNumber(balanceDue.toFixed(2))}</div>
    ${dueDate ? `<div class="bxd">Due ${escapeHtml(dueDate)}</div>` : ''}
  </div>
</div>

<table class="it">
  <thead><tr>
    <th>Description</th>
    <th style="width:12%;">Qty / Hrs</th>
    <th style="width:18%;">Rate (${escapeHtml(currentCurrency)})</th>
    <th style="width:20%;">Amount (${escapeHtml(currentCurrency)})</th>
  </tr></thead>
  <tbody>${itemsHTML}</tbody>
</table>

<div class="br">
  <div class="nc">
    ${paymentNotes ? `<div class="nl"><span class="nlbar"></span>Payment Instructions</div><div class="nt">${escapeHtml(paymentNotes)}</div>` : ''}
    ${paymentNotes && invoiceTerms ? '<div class="ng"></div>' : ''}
    ${invoiceTerms ? `<div class="nl"><span class="nlbar"></span>Terms &amp; Notes</div><div class="nt">${escapeHtml(invoiceTerms)}</div>` : ''}
  </div>
  <div class="tc">
    <div class="tl"><span>Subtotal</span><span class="tv">${currentCurrency}${formatNumber(subtotal.toFixed(2))}</span></div>
    ${discountAmt>0 ? `<div class="tl"><span>Discount</span><span class="tg">&#8722;&thinsp;${currentCurrency}${formatNumber(discountAmt.toFixed(2))}</span></div>` : ''}
    ${taxAmt>0      ? `<div class="tl"><span>Tax / VAT (${taxRateV}%)</span><span class="tv">${currentCurrency}${formatNumber(taxAmt.toFixed(2))}</span></div>` : ''}
    ${extraFeeV>0   ? `<div class="tl"><span>Shipping / Extra</span><span class="tv">${currentCurrency}${formatNumber(extraFeeV.toFixed(2))}</span></div>` : ''}
    <div class="tt"><span>Total</span><span>${currentCurrency}${formatNumber(grandTotal.toFixed(2))}</span></div>
    ${paidAmt>0     ? `<div class="tnb"><span>Amount Paid</span><span class="tg">&#8722;&thinsp;${currentCurrency}${formatNumber(paidAmt.toFixed(2))}</span></div>` : ''}
    <div class="tb"><span class="tbl">Balance Due</span><span class="tbv">${currentCurrency}${formatNumber(balanceDue.toFixed(2))}</span></div>
  </div>
</div>

<div class="ft">
  <div class="fn">
    ${senderEmailV ? `Questions?&nbsp;<strong>${escapeHtml(senderEmailV)}</strong>` : ''}
    ${senderName   ? `<br><strong>${escapeHtml(senderName)}</strong>` : ''}
  </div>
  ${signatureText ? `<div class="sw"><div class="ssn">${escapeHtml(signatureText)}</div><div class="sigline"></div><div class="siglbl">Authorized Signature</div></div>` : ''}
</div>
${showWatermark ? `<div class="wm">Generated by <strong style="color:#818cf8;">Invoicely</strong>&nbsp;&middot;&nbsp;Free Professional Invoice Generator</div>` : ''}

</div></div></body></html>`;

    try {
      const iframe = document.createElement('iframe');
      // Give iframe a generous height so nothing is clipped
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;height:4000px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
      // Wait for layout to settle
      await new Promise(r => setTimeout(r, 800));

      // Capture the FULL content height, not the viewport height
      const fullHeight = iframe.contentDocument.body.scrollHeight || 1123;
      const canvas = await html2canvas(iframe.contentDocument.body, {
        scale: 2, useCORS: true, logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: fullHeight,
        windowWidth: 794,
        windowHeight: fullHeight,
        scrollX: 0,
        scrollY: 0
      });
      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL('image/jpeg', 0.97);
      const { jsPDF } = window.jspdf || window;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();   // 210mm
      const pdfH = pdf.internal.pageSize.getHeight();  // 297mm

      // Always scale to fit exactly 1 page — no matter the content height
      const ratio = canvas.height / canvas.width;
      let imgW = pdfW;
      let imgH = pdfW * ratio;
      if (imgH > pdfH) { imgH = pdfH; imgW = pdfH / ratio; }
      const xOff = (pdfW - imgW) / 2;
      const yOff = (pdfH - imgH) / 2;

      pdf.addImage(imgData, 'JPEG', xOff, yOff, imgW, imgH, '', 'FAST');
      pdf.save(filename);
      showToast('PDF downloaded — single page!', 'success');
    } catch (err) {
      console.error('PDF error:', err);
      showToast('PDF failed. Try the Print button instead.', 'error');
    }
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
