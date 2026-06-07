const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => { res.header('Access-Control-Allow-Origin', '*'); next(); });

let cache = {
  tiktok: { trends: [], updatedAt: null, source: null },
  instagram: { trends: [], updatedAt: null, source: null },
};

function httpGet(url, headers) {
  return new Promise((resolve) => {
    https.get(url, { headers: headers || {} }, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve({ status: r.statusCode, body: data }));
    }).on('error', () => resolve({ status: 0, body: '' }));
  });
}

// المصدر 1: TikTok Creative Center
async function fromTikTok() {
  const url = 'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?period=7&page=1&limit=20&country_code=SA&sort_by=popular';
  const { status, body } = await httpGet(url, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en',
    'lang': 'en',
    'Timezone': 'Asia/Riyadh',
    'User-Sign': String(Date.now()),
  });
  if (status !== 200) return [];
  try {
    const json = JSON.parse(body);
    const list = json?.data?.list || [];
    return list.map(i => ({ name: '#' + (i.hashtag_name||''), title: i.hashtag_name||'', views: i.video_views||null })).filter(t => t.title);
  } catch(e) { return []; }
}

// المصدر 2: Google Trends السعودية (احتياطي)
async function fromGoogleTrends() {
  const { status, body } = await httpGet('https://trends.google.com/trending/rss?geo=SA', {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  });
  if (status !== 200) return [];
  const titles = [...body.matchAll(/<title>([^<]+)<\/title>/g)].map(m => m[1]);
  // أول عنوان هو عنوان الخلاصة نفسها — نتجاهله
  return titles.slice(1, 16).map(t => ({
    name: '#' + t.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g,'').trim().split(/\s+/).slice(0,3).join('_'),
    title: t.trim(),
    views: null,
  })).filter(t => t.title);
}

async function updateTikTok() {
  let trends = await fromTikTok();
  let source = 'tiktok';
  if (trends.length === 0) {
    trends = await fromGoogleTrends();
    source = 'google-trends';
  }
  if (trends.length > 0) {
    cache.tiktok = { trends, updatedAt: new Date().toISOString(), source };
    console.log(`✅ ${trends.length} ترند من ${source}`);
  } else {
    console.log('⚠️ فشل كل المصادر');
  }
}

app.get('/api/trends/tiktok', (req, res) => res.json(cache.tiktok));
app.get('/api/trends/instagram', (req, res) => res.json(cache.instagram));
app.get('/', (req, res) => res.json({
  status: 'ناشر - سيرفر الترندات',
  tiktok: cache.tiktok.updatedAt,
  tiktok_source: cache.tiktok.source,
  tiktok_count: cache.tiktok.trends.length,
}));
app.get('/api/refresh', async (req, res) => {
  await updateTikTok();
  res.json({ success: true, count: cache.tiktok.trends.length, source: cache.tiktok.source });
});

app.listen(PORT, () => {
  console.log(`✅ سيرفر الترندات على ${PORT}`);
  updateTikTok();
  setInterval(updateTikTok, 60 * 60 * 1000);
});
