// --- Variáveis Globais ---
let userName = null;
let state = {
    people: [],
    paidDates: {}
};
const funMessages = [
    "Hoje a Coca do(a) [NOME] está garantida!",
    "O(A) [NOME] está salvando o dia da sede!",
    "Alguém viu a Coca? Ah, foi o(a) [NOME] que comprou!",
    "Aguardando ansiosamente a Coca do(a) [NOME]...",
    "Se a vida te der sede, peça a Coca do(a) [NOME]!",
    "Um brinde à generosidade do(a) [NOME]!",
    "Que a Coca do(a) [NOME] nos revigore!",
    "Missão dada é missão cumprida: Coca do(a) [NOME]!",
    "O(A) [NOME] é nosso(a) herói(na) da hidratação!",
    "Preparem os copos, a Coca do(a) [NOME] chegou (ou vai chegar)! "
];

// --- Seletores do DOM ---
const $ = (s) => document.querySelector(s);
const el = (id) => document.getElementById(id);

// --- Funções Utilitárias ---
const getDayOfYear = (d) => {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
};
const isPurchaseDay = (d) => getDayOfYear(d) % 2 === 1;
const getPurchaseDayIndex = (d) => Math.ceil(getDayOfYear(d) / 2);
const getPersonResponsible = (d, peopleList) => {
    if (!peopleList || peopleList.length === 0) return "Ninguém";
    const purchaseIndex = getPurchaseDayIndex(d);
    const personIndex = (purchaseIndex - 1) % peopleList.length;
    return peopleList?.[personIndex] || "Alguém";
};
const formatDate = (date) => date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

const displayFunMessage = () => {
    const messageEl = el('funMessage');
    if (state.people && state.people.length > 0) {
        const randomIndex = Math.floor(Math.random() * funMessages.length);
        const randomPerson = state.people?.[Math.floor(Math.random() * state.people.length)] || "alguém";
        const message = funMessages?.[randomIndex]?.replace('[NOME]', randomPerson) || "";
        
        messageEl.classList.remove('show');
        setTimeout(() => {
            messageEl.textContent = message;
            messageEl.classList.add('show');
        }, 1000);
        
        messageEl.classList.remove('hidden');
    } else {
        messageEl.classList.add('hidden');
    }
};

// --- Funções da UI ---
const renderToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);

    if (isPurchaseDay(today)) {
        const responsible = getPersonResponsible(today, state.people);
        const payer = state.paidDates?.[todayKey];
        const isPaid = !!payer;

        el('todayPanel').classList.toggle('paid', isPaid);
        el('todayName').textContent = isPaid ? payer : responsible;
        el('todayDate').textContent = formatDate(today);
        el('togglePaidBtn').textContent = isPaid ? 'Compra Realizada ✓' : 'Marcar como Pago';

        el('todayAlert').textContent = isPaid
            ? `Compra registrada por ${payer}!`
            : `Hoje é a vez de ${responsible} comprar a Coca!`;
        el('todayAlert').className = isPaid ? 'alert success' : 'alert';
        el('todayCard').style.display = 'flex';
        el('todayAlert').style.display = 'block';

    } else {
        el('todayCard').style.display = 'none';
        el('todayAlert').textContent = 'Hoje não é dia de compra. Aproveite a folga!';
        el('todayAlert').className = 'alert';
        el('todayAlert').style.display = 'block';
    }
};

const renderHistory = () => {
    const historyList = el('historyList');
    historyList.innerHTML = '';
    const sortedDates = Object.keys(state.paidDates || {}).sort((a, b) => new Date(b) - new Date(a));

    if (sortedDates.length === 0) {
        historyList.innerHTML = '<p class="empty-state">Nenhum registro de compra.</p>';
        return;
    }

    sortedDates.slice(0, 5).forEach(dateStr => {
        const date = new Date(dateStr + 'T12:00:00');
        const person = state.paidDates?.[dateStr];
        const item = document.createElement('div');
        item.className = 'list-item paid';
        item.innerHTML = `
            <span class="person">${person}</span>
            <span class="date">${formatDate(date)}</span>
        `;
        historyList.appendChild(item);
    });
};

const renderUpcoming = () => {
    const futureList = el('futureList');
    futureList.innerHTML = '';
    let upcomingCount = 0;
    let currentDate = new Date();

    while (upcomingCount < 5) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (isPurchaseDay(currentDate)) {
            const person = getPersonResponsible(currentDate, state.people);
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <span class="person">${person}</span>
                <span class="date">${formatDate(new Date(currentDate))}</span>
            `;
            futureList.appendChild(item);
            upcomingCount++;
        }
    }
};

const renderRanking = () => {
    const rankingList = el('rankingList');
    if (!rankingList) return;
    rankingList.innerHTML = '';

    const counts = {};
    for (const date in state.paidDates) {
        const person = state.paidDates[date];
        counts[person] = (counts[person] || 0) + 1;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
        rankingList.innerHTML = '<p class="empty-state">Nenhum pagamento registrado.</p>';
        return;
    }

    sorted.forEach(([person, total], i) => {
        const item = document.createElement('div');
        item.className = 'list-item ranking-item';
        item.innerHTML = `
            <span class="person">${i + 1}º - ${person}</span>
            <span class="badge">${total}</span>
        `;
        rankingList.appendChild(item);
    });
};

const updateUI = () => {
    renderToday();
    renderHistory();
    renderUpcoming();
    renderRanking();
};

const fetchData = async () => {
    try {
        const res = await fetch('/api/data', { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao buscar dados da API.');
        state = await res.json();
        updateUI();
    } catch (e) {
        console.error('Erro de rede ao buscar dados:', e);
        console.log('Erro ao conectar com o servidor. Tente novamente.');
    }
};

// --- Lógica do Chat ---
const setupChat = () => {
    const sendMessage = async () => {
        const text = el('messageInput').value.trim();
        if (!text || !userName) return;

        try {
            await fetch('/api/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName, text })
            });
            el('messageInput').value = '';
            fetchChatMessages();
        } catch (e) {
            console.error("Erro ao enviar mensagem:", e);
            console.log("Falha ao enviar a mensagem. Tente novamente.");
        }
    };
    
    const fetchChatMessages = async () => {
        try {
            const res = await fetch('/api/chat', { cache: 'no-store' });
            if (!res.ok) throw new Error('Falha ao buscar mensagens do chat.');
            const messages = await res.json();
            el('chatMessages').innerHTML = '';
            messages.forEach(msg => {
                const p = document.createElement('p');
                p.className = 'other-message';
                p.innerHTML = `<strong>${msg.userName}:</strong> ${msg.text}`;
                el('chatMessages').appendChild(p);
            });
            el('chatMessages').scrollTop = el('chatMessages').scrollHeight;
        } catch (e) {
            console.error("Erro ao carregar chat:", e);
        }
    };

    el('sendBtn').addEventListener('click', sendMessage);
    el('messageInput').addEventListener('keypress', e => e.key === 'Enter' && sendMessage());

    el('enterChatBtn').addEventListener('click', () => {
        userName = el('nameInput').value.trim();
        if (!userName) return;
        localStorage.setItem('userName', userName);
        el('nameInputContainer').classList.add('hidden');
        el('chatContent').classList.remove('hidden');
        el('userIdDisplay').textContent = `Conectado como: ${userName}`;
        fetchChatMessages();
    });

    userName = localStorage.getItem('userName');
    if (userName) {
        el('nameInputContainer').classList.add('hidden');
        el('chatContent').classList.remove('hidden');
        el('userIdDisplay').textContent = `Conectado como: ${userName}`;
        fetchChatMessages();
    }
};

// --- Inicialização e Event Listeners ---
const initApp = () => {
    el('togglePaidBtn').addEventListener('click', async () => {
        const today = new Date();
        if (!isPurchaseDay(today)) {
            console.log('Hoje não é dia de compra.');
            return;
        }
        const todayKey = today.toISOString().slice(0, 10);
        
        try {
            const res = await fetch(`/api/paid/toggle-today?date=${todayKey}`, { method: 'PATCH' });
            if (res.ok) {
                const data = await res.json();
                state.paidDates = data.paidDates;
                updateUI();
            }
        } catch (e) {
            console.error('Falha ao comunicar com o servidor.', e);
        }
    });

    const setupModals = () => {
        const openModal = (modal) => modal.style.display = 'flex';
        const closeModal = (modal) => modal.style.display = 'none';
        
        el('settingsBtn').addEventListener('click', () => openModal(el('settingsModal')));
        el('chatBtn').addEventListener('click', () => openModal(el('chatModal')));

        el('closeSettingsModal').addEventListener('click', () => closeModal(el('settingsModal')));
        el('closeChatModal').addEventListener('click', () => closeModal(el('chatModal')));
    };
    setupModals();

    const setupThemeAndBackground = () => {
        const applyTheme = (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        };
        const applyBackground = (url) => {
            document.body.style.backgroundImage = url ? `url(${url})` : 'none';
            localStorage.setItem('backgroundUrl', url);
        };

        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
        });

        el('applyBackgroundBtn').addEventListener('click', () => {
            const url = el('backgroundInput').value.trim();
            if (url) {
                applyBackground(url);
            } else {
                applyBackground('');
            }
        });

        const savedTheme = localStorage.getItem('theme') || 'dark';
        applyTheme(savedTheme);
        const savedBackground = localStorage.getItem('backgroundUrl') || '';
        if (savedBackground) el('backgroundInput').value = savedBackground;
        applyBackground(savedBackground);
    };
    setupThemeAndBackground();

    setInterval(displayFunMessage, 5000);
    fetchData();
    setupChat();
};

document.addEventListener('DOMContentLoaded', initApp);
