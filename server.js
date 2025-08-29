const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASSWORD = 'coca'; // Defina sua senha de admin aqui

// --- Middlewares ---
app.use(express.json());
app.use(express.static(__dirname));
app.use(session({
  secret: 'seu-segredo-super-secreto-aqui-mude-isso',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // Sessão dura 24 horas
}));

const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.status(401).json({ success: false, error: 'Não autorizado' });
};

// --- Funções de Leitura/Escrita e Utilitários ---
const readData = () => {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Erro ao ler data.json:', e); }
  const defaultData = { people: ['Ana Beatriz', 'Lais Dias'], paidDates: {}, chat: [] };
  saveData(defaultData);
  return defaultData;
};
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

const getToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
};

// --- Rotas da API (Frontend) ---
app.get('/api/data', (req, res) => {
  const data = readData();
  res.status(200).json({ people: data.people, paidDates: data.paidDates });
});

app.patch('/api/paid/toggle-today', (req, res) => {
    const data = readData();
    const todayKey = getToday();
    const todayPerson = data.people[(Math.ceil(getDayOfYear(new Date()) / 2) - 1) % data.people.length];

    if (data.paidDates[todayKey]) {
        delete data.paidDates[todayKey];
    } else {
        data.paidDates[todayKey] = todayPerson;
    }

    saveData(data);
    res.status(200).json({ success: true, paidDates: data.paidDates });
});

app.get('/api/chat', (req, res) => {
  const data = readData();
  res.status(200).json(data.chat);
});

app.post('/api/chat/message', (req, res) => {
    const { userName, text } = req.body;
    if (!userName || !text) return res.status(400).json({ error: 'Nome de usuário e mensagem são obrigatórios.' });

    const data = readData();
    data.chat.push({ userName, text, timestamp: new Date().toISOString() });
    saveData(data);
    res.status(201).json({ success: true });
});

// --- Rotas da API (Admin) ---
app.get('/api/admin/data', isAdmin, (req, res) => {
  const data = readData();
  res.status(200).json(data);
});
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.status(200).json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Senha incorreta' });
});
app.post('/api/admin/logout', isAdmin, (req, res) => {
    req.session.destroy(() => res.status(200).json({ success: true }));
});
app.patch('/api/admin/reset', isAdmin, (req, res) => {
  const data = readData();
  data.paidDates = {};
  saveData(data);
  res.status(200).json({ success: true, message: 'Histórico resetado!' });
});
app.post('/api/admin/people', isAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'O nome é obrigatório' });
  const data = readData();
  if (!data.people.includes(name)) data.people.push(name);
  saveData(data);
  res.status(201).json({ success: true, people: data.people });
});
app.delete('/api/admin/people', isAdmin, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'O nome é obrigatório' });
    const data = readData();
    data.people = data.people.filter(p => p !== name);
    // Também remove a pessoa dos pagamentos futuros para evitar inconsistências
    const newPaidDates = {};
    for (const date in data.paidDates) {
        if (data.paidDates[date] !== name) {
            newPaidDates[date] = data.paidDates[date];
        }
    }
    data.paidDates = newPaidDates;
    saveData(data);
    res.status(200).json({ success: true, people: data.people });
});
app.patch('/api/admin/paid', isAdmin, (req, res) => {
    const { date, name } = req.body;
    const data = readData();
    if (name) {
        data.paidDates[date] = name;
    } else {
        delete data.paidDates[date];
    }
    saveData(data);
    res.status(200).json({ success: true, paidDates: data.paidDates });
});

// Serve o arquivo admin.html
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Função para calcular o dia do ano
const getDayOfYear = (d) => {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
};

// Inicia o servidor
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
