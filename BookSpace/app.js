// Backend BookSpace: Express + MySQL. Funciona localmente e como Netlify Function.
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bookspace',
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  enableKeepAlive: true,
  ...(process.env.DB_SSL === 'true' ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {})
});
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function signToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres.');
  }
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ erro: 'Faça login para continuar.' });
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET ausente');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = { id: Number(payload.id) };
    if (!Number.isSafeInteger(req.auth.id)) throw new Error('ID inválido');
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada. Entre novamente.' });
  }
}
function onlyOwnAccount(req, res, next) {
  if (Number(req.params.id) !== req.auth.id) return res.status(403).json({ erro: 'Acesso não autorizado.' });
  next();
}
const api = express.Router();
app.use('/api', api);

api.get('/status', asyncRoute(async (req, res) => {
  await db.query('SELECT 1');
  res.json({ ok: true, message: 'BookSpace conectado ao MySQL' });
}));

api.post('/usuarios', asyncRoute(async (req, res) => {
  const { nome, email, telefone, senha } = req.body || {};
  const n = String(nome || '').trim(), e = String(email || '').trim().toLowerCase();
  const tel = String(telefone || '').replace(/\D/g, '');
  if (n.length < 3 || !/^\S+@\S+\.\S+$/.test(e) || tel.length < 10 || typeof senha !== 'string' || senha.length < 6) {
    return res.status(400).json({ erro: 'Informe nome, e-mail, telefone e senha (mínimo 6 caracteres) válidos.' });
  }
  const hash = await bcrypt.hash(senha, 10);
  try {
    const [r] = await db.execute('INSERT INTO usuarios (nome,email,telefone,senha_hash) VALUES (?,?,?,?)', [n, e, tel, hash]);
    const usuario = { id: r.insertId, nome: n, email: e, telefone: tel };
    res.status(201).json({ ...usuario, token: signToken(usuario) });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
    throw err;
  }
}));

api.post('/login', asyncRoute(async (req, res) => {
  const { email, senha } = req.body || {};
  const [rows] = await db.execute('SELECT id_usuario,nome,email,telefone,senha_hash FROM usuarios WHERE email=?', [String(email || '').trim().toLowerCase()]);
  if (!rows.length || typeof senha !== 'string' || !(await bcrypt.compare(senha, rows[0].senha_hash))) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }
  const u = rows[0];
  const usuario = { id: u.id_usuario, nome: u.nome, email: u.email, telefone: u.telefone };
  res.json({ ...usuario, token: signToken(usuario) });
}));

api.get('/livros', asyncRoute(async (req, res) => {
  const [rows] = await db.query(`
    SELECT l.*, CASE WHEN EXISTS (
      SELECT 1 FROM itens_aluguel i
      JOIN alugueis a ON a.id_aluguel = i.id_aluguel
      WHERE i.id_livro = l.id_livro AND a.status = 'Em andamento'
    ) THEN 0 ELSE 1 END AS disponivel
    FROM livros l WHERE l.ativo = 1 ORDER BY l.id_livro
  `);
  res.json(rows);
}));

api.get('/livros/:id', asyncRoute(async (req, res) => {
  const livroId = Number(req.params.id);
  if (!Number.isSafeInteger(livroId) || livroId < 1) return res.status(400).json({ erro: 'ID do livro inválido.' });
  const [rows] = await db.execute('SELECT * FROM livros WHERE id_livro = ? AND ativo = 1', [livroId]);
  if (!rows.length) return res.status(404).json({ erro: 'Livro não encontrado.' });
  const [r] = await db.execute(`SELECT COUNT(*) AS total FROM itens_aluguel i
    JOIN alugueis a ON a.id_aluguel = i.id_aluguel
    WHERE i.id_livro = ? AND a.status = 'Em andamento'`, [livroId]);
  res.json({ ...rows[0], disponivel: r[0].total === 0 });
}));

api.post('/alugueis', auth, asyncRoute(async (req, res) => {
  const livros = req.body?.livros;
  if (!Array.isArray(livros) || livros.length < 1 || livros.length > 20) {
    return res.status(400).json({ erro: 'Selecione de 1 a 20 livros.' });
  }
  const ids = livros.map(Number);
  if (ids.some(n => !Number.isSafeInteger(n) || n < 1) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ erro: 'A lista de livros contém IDs inválidos ou repetidos.' });
  }
  ids.sort((a, b) => a - b);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Bloqueio das linhas dos livros evita alugueis simultâneos do mesmo exemplar.
    for (const id of ids) {
      const [book] = await conn.execute('SELECT id_livro FROM livros WHERE id_livro = ? AND ativo = 1 FOR UPDATE', [id]);
      if (!book.length) throw new Error('Um dos livros não está disponível.');
      const [used] = await conn.execute(`SELECT i.id_livro FROM itens_aluguel i
        JOIN alugueis a ON a.id_aluguel = i.id_aluguel
        WHERE i.id_livro = ? AND a.status = 'Em andamento' LIMIT 1`, [id]);
      if (used.length) throw new Error('Um dos livros já está alugado.');
    }
    const [r] = await conn.execute(`INSERT INTO alugueis
      (id_usuario,data_retirada,data_devolucao_prevista,status)
      VALUES (?,CURDATE(),DATE_ADD(CURDATE(), INTERVAL 14 DAY),'Em andamento')`, [req.auth.id]);
    for (const id of ids) {
      await conn.execute('INSERT INTO itens_aluguel (id_aluguel,id_livro) VALUES (?,?)', [r.insertId, id]);
    }
    await conn.commit();
    res.status(201).json({ id_aluguel: r.insertId, mensagem: 'Aluguel realizado com sucesso.' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ erro: err.message === 'Um dos livros já está alugado.' || err.message === 'Um dos livros não está disponível.' ? err.message : 'Não foi possível concluir o aluguel.' });
  } finally {
    conn.release();
  }
}));

api.get('/usuarios/:id/alugueis', auth, onlyOwnAccount, asyncRoute(async (req, res) => {
  const [rows] = await db.execute(`SELECT a.id_aluguel,a.data_retirada,
      a.data_devolucao_prevista,a.data_devolucao_real,a.status,
      i.id_livro,l.titulo,l.autor,l.imagem
      FROM alugueis a JOIN itens_aluguel i ON i.id_aluguel = a.id_aluguel
      JOIN livros l ON l.id_livro = i.id_livro
      WHERE a.id_usuario = ? ORDER BY a.id_aluguel DESC`, [req.auth.id]);
  res.json(rows);
}));

api.put('/usuarios/:id', auth, onlyOwnAccount, asyncRoute(async (req, res) => {
  const { nome, email, telefone, senha } = req.body || {};
  const n = String(nome || '').trim(), e = String(email || '').trim().toLowerCase();
  const tel = String(telefone || '').replace(/\D/g, '');
  if (n.length < 3 || !/^\S+@\S+\.\S+$/.test(e) || tel.length < 10) {
    return res.status(400).json({ erro: 'Revise nome, e-mail e telefone.' });
  }
  if (senha && (typeof senha !== 'string' || senha.length < 6)) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
  }
  try {
    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      await db.execute('UPDATE usuarios SET nome=?,email=?,telefone=?,senha_hash=? WHERE id_usuario=?', [n, e, tel, hash, req.auth.id]);
    } else {
      await db.execute('UPDATE usuarios SET nome=?,email=?,telefone=? WHERE id_usuario=?', [n, e, tel, req.auth.id]);
    }
    // Token existente é mantido, vinculado ao id do usuário.
    res.json({ id: req.auth.id, nome: n, email: e, telefone: tel });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'E-mail já usado por outra conta.' });
    throw err;
  }
}));

api.put('/alugueis/:id/devolucao', auth, asyncRoute(async (req, res) => {
  const aluguelId = Number(req.params.id);
  if (!Number.isSafeInteger(aluguelId) || aluguelId < 1) return res.status(400).json({ erro: 'Aluguel inválido.' });
  const [r] = await db.execute(`UPDATE alugueis SET status = 'Devolvido', data_devolucao_real = CURDATE()
    WHERE id_aluguel = ? AND id_usuario = ? AND status = 'Em andamento'`, [aluguelId, req.auth.id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Aluguel não encontrado ou já devolvido.' });
  res.json({ mensagem: 'Devolução registrada.' });
}));

api.use((req, res) => res.status(404).json({ erro: 'Rota da API não encontrada.' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => {
  console.error('[BookSpace API]', err);
  res.status(500).json({ erro: 'Erro interno do servidor. Confira o banco e as variáveis de ambiente.' });
});

module.exports = app;
