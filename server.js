// Paid API Server - List on RapidAPI, earn per call
const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3456;

// Simple API key auth (RapidAPI passes X-RapidAPI-Proxy-Secret)
const API_KEYS = new Set([
  'test-key-123',  // for testing
]);

function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.headers['x-rapidapi-proxy-secret'];
  if (!key || !API_KEYS.has(key)) {
    return res.status(401).json({ error: 'Valid API key required. Get one at https://zestful572.gumroad.com' });
  }
  next();
}

app.use(express.json());

// Static landing page
app.use(express.static('public'));
const path = require('path');
app.get('/openapi.json', (req, res) => res.sendFile(path.join(__dirname, 'openapi.json')));


// === FREE ENDPOINTS ===
app.get('/', (req, res) => {
  res.json({ 
    service: 'Data APIs for AI Agents',
    version: '1.0.0',
    endpoints: [
      'GET /api/v1/github-trending - GitHub trending repos (free tier: 100/day)',
      'GET /api/v1/crypto-prices - Real-time crypto prices (free tier: 100/day)',
      'GET /api/v1/hn-top - Hacker News top stories (free tier: 100/day)',
      'GET /api/v1/dns-lookup?domain=example.com - DNS/WHOIS lookup',
    ],
    pricing: 'Free tier available. Pro: $9.99/mo unlimited. Pay at https://zestful572.gumroad.com',
    docs: 'https://github.com/x402-api/docs'
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// === DATA ENDPOINTS (with auth) ===

app.get('/api/v1/github-trending', auth, async (req, res) => {
  try {
    const resp = await fetch(
      'https://api.github.com/search/repositories?q=stars:>100+pushed:>2026-06-20&sort=stars&order=desc&per_page=10',
      { headers: { 'User-Agent': 'data-api/1.0', 'Accept': 'application/vnd.github.v3+json' } }
    );
    const data = await resp.json();
    res.json({ 
      service: 'GitHub Trending', 
      updated: new Date().toISOString(),
      data: (data.items || []).map(r => ({
        repo: r.full_name,
        stars: r.stargazers_count,
        desc: r.description,
        url: r.html_url,
        lang: r.language
      }))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/v1/crypto-prices', auth, async (req, res) => {
  try {
    const resp = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano&vs_currencies=usd&include_24hr_change=true&include_market_cap=true'
    );
    const data = await resp.json();
    res.json({ service: 'Crypto Prices', updated: new Date().toISOString(), data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/v1/hn-top', auth, async (req, res) => {
  try {
    const resp = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await resp.json();
    const top10 = ids.slice(0, 10);
    const stories = await Promise.all(top10.map(async id => {
      const s = await fetch('https://hacker-news.firebaseio.com/v0/item/' + id + '.json');
      return s.json();
    }));
    res.json({ 
      service: 'Hacker News Top', 
      updated: new Date().toISOString(),
      data: stories.map(s => ({ title: s.title, url: s.url, score: s.score, author: s.by, comments: s.descendants }))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/v1/dns-lookup', auth, async (req, res) => {
  const domain = req.query.domain;
  if (!domain) return res.status(400).json({ error: '?domain= required' });
  try {
    const dns = await import('node:dns').then(m => m.promises);
    const [a, aaaa, mx, txt, ns] = await Promise.allSettled([
      dns.resolve4(domain).catch(() => []),
      dns.resolve6(domain).catch(() => []),
      dns.resolveMx(domain).catch(() => []),
      dns.resolveTxt(domain).catch(() => []),
      dns.resolveNs(domain).catch(() => [])
    ]);
    res.json({ domain, records: { A: a.value, AAAA: aaaa.value, MX: mx.value, TXT: txt.value, NS: ns.value } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log('API Server running on http://localhost:' + PORT);
  console.log('Free tier: 100 req/day per endpoint');
  console.log('Pro tier: unlimited - $9.99/mo at https://zestful572.gumroad.com');
});
