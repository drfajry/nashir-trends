const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// تخزين الترندات في الذاكرة
let cache = {
  tiktok: { trends: [], updatedAt: null },
  instagram: { trends: [], updatedAt: null },
};

// ── جلب TikTok Creative Center ───────────────────
function fetchTikTokTrends() {
  return new Promise((resolve) => {
    // API الداخلي لـ Creative Center (هاشتاقات رائجة - السعودية)
    const url = 'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?period=7&page=1&limit=20&country_code=SA&sort_by=popular';
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en',
      },
    };
    https.get(url, options, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        try {
          const json = JSON.parse(data);
          const list = json?.data?.list || [];
          const trends = list.map(item => ({
            name: '#' + (item.hashtag_name || ''),
            title: item.hashtag_name || '',
            rank: item.rank || null,
            views: item.video_views || null,
          })).filter(t => t.title);
          resolve(trends);
        } catch(e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function updateTikTok() {
  const trends = await fetchTikTokTrends();
  if (trends.length > 0) {
    cache.tiktok = { trends, updatedAt: new Date().toISOString() };
    console.log(`✅ TikTok: ${trends.length} ترند`);
  } else {
    console.log('⚠️ TikTok: فشل الجلب');
  }
}

// ── API ──────────────────────────────────────────
app.get('/api/trends/tiktok', (req, res) => {
  res.json(cache.tiktok);
});

app.get('/api/trends/instagram', (req, res) => {
  res.json(cache.instagram);
});

app.get('/', (req, res) => {
  res.json({
    status: 'ناشر - سيرفر الترندات',
    tiktok: cache.tiktok.updatedAt,
    instagram: cache.instagram.updatedAt,
  });
});

// تحديث يدوي (لتوقظه cron-job.org)
app.get('/api/refresh', async (req, res) => {
  await updateTikTok();
  res.json({ success: true, tiktok: cache.tiktok.trends.length });
});

app.listen(PORT, () => {
  console.log(`✅ سيرفر الترندات يعمل على ${PORT}`);
  updateTikTok(); // جلب أولي
  setInterval(updateTikTok, 60 * 60 * 1000); // كل ساعة
});
