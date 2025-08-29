// --- Variáveis Globais ---
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let state = { people: [], paidDates: {} };
let selectedDateForPayment = null;
let statsChart = null;

// --- Seletores do DOM ---
const el = id => document.getElementById(id);

// --- Funções de API ---
const api = async (endpoint, options = {}) => {
  try {
    const res = await fetch(endpoint, options);
    if (res.status === 401) {
      // Em vez de recarregar infinitamente, mostra login
      el('loginModal').style.display = 'flex';
      el('adminContent').classList.add('hidden');
      return null;
    }
    if (!res.ok) throw new Error(`Erro: ${res.statusText}`);
    return res.json();
  } catch (e) {
    console.error(`Erro API (${endpoint}):`, e);
    return null;
  }
};

// --- Estatísticas ---
const renderStats = () => {
  const dates = Object.keys(state.paidDates || {});
  el('totalPurchasesStat').textContent = dates.length;

  if (dates.length > 0) {
    const lastPurchase = dates.sort().reverse()[0];
    el('lastPurchaseStat').textContent = new Date(lastPurchase + 'T12:00:00').toLocaleDateString('pt-BR');
  } else {
    el('lastPurchaseStat').textContent = '—';
  }
};

const renderChart = () => {
  const canvas = el('statsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const counts = {};
  for (const date in state.paidDates) {
    const person = state.paidDates[date];
    counts[person] = (counts[person] || 0) + 1;
  }

  const labels = state.people || [];
  const data = labels.map(p => counts[p] || 0);

  if (statsChart) statsChart.destroy();

  if (labels.length === 0) return;

  statsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Compras',
        data,
        backgroundColor: labels.map(() => 'rgba(34,197,94,0.6)'),
        borderColor: labels.map(() => 'rgba(34,197,94,1)'),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
};

// --- Pessoas ---
const renderPeopleList = () => {
  const peopleList = el('peopleList');
  peopleList.innerHTML = '';

  if (!state.people || state.people.length === 0) {
    peopleList.innerHTML = '<p class="empty-state">Nenhuma pessoa cadastrada.</p>';
    return;
  }

  state.people.forEach(person => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <span class="person">${person}</span>
      <button class="btn danger remove-btn" data-name="${person}">&times;</button>
    `;
    peopleList.appendChild(item);
  });

  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const name = e.target.dataset.name;
      const res = await api('/api/admin/people', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res?.success) {
        state.people = res.people;
        initializeAdminPanel();
      }
    });
  });
};

// --- Calendário ---
const renderCalendar = () => {
  const calendarGrid = el('calendarGrid');
  calendarGrid.innerHTML = `
    <div class="day-header">Dom</div>
    <div class="day-header">Seg</div>
    <div class="day-header">Ter</div>
    <div class="day-header">Qua</div>
    <div class="day-header">Qui</div>
    <div class="day-header">Sex</div>
    <div class="day-header">Sáb</div>
  `;

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startingDayOfWeek = firstDay.getDay();

  el('monthYear').textContent = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarGrid.innerHTML += '<div></div>';
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(currentYear, currentMonth, day);
    const dateKey = date.toISOString().slice(0, 10);
    const person = state.paidDates[dateKey];
    const isPaid = !!person;

    const dayDiv = document.createElement('div');
    dayDiv.className = `day ${isPaid ? 'paid' : ''}`;
    dayDiv.dataset.date = dateKey;
    dayDiv.innerHTML = `
      <span>${day}</span>
      ${isPaid ? `<span class="payer-badge">${person}</span>` : ''}
    `;

    dayDiv.addEventListener('click', () => openPaymentModal(dateKey));
    calendarGrid.appendChild(dayDiv);
  }
};

// --- Modal Pagamento ---
const openPaymentModal = (dateKey) => {
  selectedDateForPayment = dateKey;
  const date = new Date(dateKey + 'T12:00:00');
  el('paymentModalTitle').textContent = `Pagamento para ${date.toLocaleDateString('pt-BR')}`;

  const paymentList = el('paymentPeopleList');
  paymentList.innerHTML = '';

  state.people.forEach(person => {
    const btn = document.createElement('button');
    btn.className = 'btn person-btn primary';
    btn.textContent = person;
    btn.dataset.name = person;
    btn.addEventListener('click', async () => {
      const res = await api('/api/admin/paid', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDateForPayment, name: person })
      });
      if (res?.success) {
        el('paymentModal').style.display = 'none';
        state.paidDates = res.paidDates;
        renderCalendar();
        renderStats();
        renderChart();
      }
    });
    paymentList.appendChild(btn);
  });

  const unpayBtn = document.createElement('button');
  unpayBtn.className = 'btn danger person-btn';
  unpayBtn.textContent = 'Marcar como NÃO PAGO';
  unpayBtn.addEventListener('click', async () => {
    const res = await api('/api/admin/paid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDateForPayment, name: null })
    });
    if (res?.success) {
      el('paymentModal').style.display = 'none';
      state.paidDates = res.paidDates;
      renderCalendar();
      renderStats();
      renderChart();
    }
  });
  paymentList.appendChild(unpayBtn);

  el('paymentModal').style.display = 'flex';
};

// --- Inicialização ---
const initializeAdminPanel = async () => {
  const data = await api('/api/admin/data');
  if (data) {
    state = data;
    renderStats();
    renderPeopleList();
    renderCalendar();
    renderChart();
    el('loginModal').style.display = 'none';
    el('adminContent').classList.remove('hidden');
  }
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  el('closePaymentModal').addEventListener('click', () => el('paymentModal').style.display = 'none');

  el('prevMonthBtn').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });

  el('nextMonthBtn').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });

  el('addPersonBtn').addEventListener('click', async () => {
    const name = el('addPersonInput').value.trim();
    if (!name) return;
    const res = await api('/api/admin/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res?.success) {
      state.people = res.people;
      el('addPersonInput').value = '';
      renderPeopleList();
      renderChart();
    }
  });

  el('resetHistoryBtn').addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja resetar TODO o histórico?')) return;
    const res = await api('/api/admin/reset', { method: 'DELETE' });
    if (res?.success) {
      state.paidDates = {};
      renderCalendar();
      renderStats();
      renderChart();
    }
  });

  // botão de login
  el('loginBtn').addEventListener('click', async () => {
    const password = el('passwordInput').value.trim();
    if (!password) return;
    const res = await api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res?.success) {
      initializeAdminPanel();
    } else {
      el('errorMsg').textContent = 'Senha incorreta!';
    }
  });

  initializeAdminPanel();
});
