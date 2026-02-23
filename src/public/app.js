// ===== FINews Dashboard — app.js =====
const fmt = v => v == null || isNaN(v) ? '—' : parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = v => v == null || isNaN(v) ? '—' : parseInt(v).toLocaleString('en-IN');
const cc = v => !v || isNaN(v) ? '#6b7280' : parseFloat(v) >= 0 ? '#10b981' : '#ef4444';
const arrow = v => !v || isNaN(v) ? '' : parseFloat(v) >= 0 ? '▲' : '▼';
const sign = v => !v || isNaN(v) ? '' : parseFloat(v) >= 0 ? '+' : '';

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    document.getElementById('refreshBtn').addEventListener('click', fetchData);
});

async function fetchData() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('hidden');
    try {
        const res = await fetch('/api/market-data');
        const data = await res.json();
        if (data.success) render(data);
    } catch (e) { console.error('Fetch error:', e); }
    setTimeout(() => overlay.classList.add('hidden'), 800);
}

function render(d) {
    document.getElementById('timestamp').textContent = new Date(d.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

    renderAISummary(d.aiSummary);
    renderSentiment(d.sentiment, d.vixData);
    renderIndex(d.marketData?.nifty50, 'nifty50');
    renderIndex(d.marketData?.bankNifty, 'bankNifty');
    renderMovers(d.marketData?.nifty50?.gainers, 'niftyGainersList');
    renderMovers(d.marketData?.nifty50?.losers, 'niftyLosersList');
    renderMovers(d.marketData?.bankNifty?.gainers, 'bankGainersList');
    renderMovers(d.marketData?.bankNifty?.losers, 'bankLosersList');
    renderSectors(d.sectorData);
    renderFIIDII(d.fiiDiiData);
    renderSR(d.supportResistance);
    renderCompactList(d.fiftyTwoWeek?.highs, 'weekHighsList', 'stock');
    renderCompactList(d.fiftyTwoWeek?.lows, 'weekLowsList', 'stock');
    renderCompactList(d.mostActive, 'mostActiveList', 'volume');
    renderGlobal(d.globalMarkets);
    renderForexCommodity(d.forexData, d.commodityData);
    renderCompactList(d.ipoCalendar, 'ipoList', 'ipo');
    renderCompactList(d.earningsCalendar, 'earningsList', 'earnings');
    renderCompactList(d.mutualFunds, 'mfList', 'mf');
    renderNews(d.newsData);
}

// ===== AI Summary =====
function renderAISummary(data) {
    const card = document.getElementById('aiSummaryCard');
    if (!data?.summary) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    document.getElementById('aiSummaryText').textContent = data.summary;
    document.getElementById('aiSummarySource').textContent = `Source: ${data.source}`;
}

// ===== Sentiment + VIX =====
function renderSentiment(s, vix) {
    if (s) {
        document.getElementById('sentimentValue').textContent = `${s.emoji} ${s.label}`;
        document.getElementById('sentimentDot').style.left = `calc(${s.score}% - 9px)`;
        document.getElementById('sentimentScore').textContent = `Score: ${s.score}/100`;
    }
    if (vix) {
        document.getElementById('vixValue').textContent = fmt(vix.value);
        document.getElementById('vixValue').style.color = cc(vix.change);
        const el = document.getElementById('vixChange');
        el.textContent = `${arrow(vix.pChange)} ${sign(vix.pChange)}${parseFloat(vix.pChange || 0).toFixed(2)}%`;
        el.style.color = cc(vix.pChange);
    }
}

// ===== Index Cards =====
function renderIndex(data, prefix) {
    if (!data?.summary) return;
    const s = data.summary;
    animateValue(`${prefix}Value`, s.last);
    const changeEl = document.getElementById(`${prefix}Change`);
    changeEl.style.color = cc(s.pChange);
    document.getElementById(`${prefix}Arrow`).textContent = arrow(s.pChange);
    document.getElementById(`${prefix}ChangeVal`).textContent = `${sign(s.change)}${fmt(s.change)}`;
    document.getElementById(`${prefix}ChangePct`).textContent = `(${sign(s.pChange)}${parseFloat(s.pChange || 0).toFixed(2)}%)`;
    if (s.low && s.high) {
        document.getElementById(`${prefix}Low`).textContent = `L: ${fmt(s.low)}`;
        document.getElementById(`${prefix}High`).textContent = `H: ${fmt(s.high)}`;
        const pct = ((s.last - s.low) / (s.high - s.low) * 100).toFixed(1);
        document.getElementById(`${prefix}Bar`).style.width = `${pct}%`;
        document.getElementById(`${prefix}Bar`).style.background = cc(s.pChange);
    }
}

function animateValue(id, target) {
    const el = document.getElementById(id); if (!el || !target) return;
    let start = 0; const duration = 1200; const startTime = performance.now();
    function step(now) {
        const p = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(start + (target - start) * ease);
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ===== Movers =====
function renderMovers(stocks, containerId) {
    const c = document.getElementById(containerId); if (!c) return;
    if (!stocks?.length) { c.innerHTML = '<div style="padding:16px;color:#64748b;font-size:13px;">No data</div>'; return; }
    c.innerHTML = stocks.map((s, i) => `
    <div class="mover-row" style="animation-delay:${i * 0.08}s;">
      <span class="mover-name">${s.symbol || s.name}</span>
      <span class="mover-price">₹${fmt(s.price)}</span>
      <span class="mover-change" style="color:${cc(s.pChange)}">${arrow(s.pChange)} ${Math.abs(s.pChange || 0).toFixed(2)}%</span>
    </div>`).join('');
}

// ===== Sectors =====
function renderSectors(sectors) {
    const g = document.getElementById('sectorGrid'); if (!g) return;
    if (!sectors?.length) { g.innerHTML = ''; return; }
    g.innerHTML = sectors.map(s => `
    <div class="sector-chip">
      <div class="sector-name">${s.name}</div>
      <div class="sector-change" style="color:${cc(s.pChange)}">${sign(s.pChange)}${parseFloat(s.pChange || 0).toFixed(2)}%</div>
    </div>`).join('');
}

// ===== FII/DII =====
function renderFIIDII(data) {
    if (!data) return;
    const f = data.fii || {}, d = data.dii || {};
    const maxVal = Math.max(f.buyValue || 1, f.sellValue || 1, d.buyValue || 1, d.sellValue || 1);
    // FII
    document.getElementById('fiiNet').textContent = `Net: ${sign(f.netValue)}₹${fmt(Math.abs(f.netValue || 0))} Cr`;
    document.getElementById('fiiNet').style.color = cc(f.netValue);
    document.getElementById('fiiBuyBar').style.width = `${((f.buyValue || 0) / maxVal) * 100}%`;
    document.getElementById('fiiSellBar').style.width = `${((f.sellValue || 0) / maxVal) * 100}%`;
    document.getElementById('fiiBuyVal').textContent = `₹${fmt(f.buyValue)} Cr`;
    document.getElementById('fiiSellVal').textContent = `₹${fmt(f.sellValue)} Cr`;
    // DII
    document.getElementById('diiNet').textContent = `Net: ${sign(d.netValue)}₹${fmt(Math.abs(d.netValue || 0))} Cr`;
    document.getElementById('diiNet').style.color = cc(d.netValue);
    document.getElementById('diiBuyBar').style.width = `${((d.buyValue || 0) / maxVal) * 100}%`;
    document.getElementById('diiSellBar').style.width = `${((d.sellValue || 0) / maxVal) * 100}%`;
    document.getElementById('diiBuyVal').textContent = `₹${fmt(d.buyValue)} Cr`;
    document.getElementById('diiSellVal').textContent = `₹${fmt(d.sellValue)} Cr`;
}

// ===== Support & Resistance =====
function renderSR(data) {
    const c = document.getElementById('srContainer'); if (!c) return;
    if (!data?.length) { c.innerHTML = '<div class="glass-card" style="padding:16px;color:#64748b;">No S/R data available</div>'; return; }
    c.innerHTML = data.map(item => `
    <div class="sr-card">
      <div class="sr-title">${item.name} <span>— Pivot: ${fmt(item.pivot)}</span></div>
      <div class="sr-levels">
        <div class="sr-level"><div class="sr-level-label">S3</div><div class="sr-level-value sr-support">${fmt(item.support.s3)}</div></div>
        <div class="sr-level"><div class="sr-level-label">S2</div><div class="sr-level-value sr-support">${fmt(item.support.s2)}</div></div>
        <div class="sr-level"><div class="sr-level-label">S1</div><div class="sr-level-value sr-support">${fmt(item.support.s1)}</div></div>
        <div class="sr-level"><div class="sr-level-label">CURRENT</div><div class="sr-level-value sr-current">${fmt(item.currentPrice)}</div></div>
        <div class="sr-level"><div class="sr-level-label">R1</div><div class="sr-level-value sr-resistance">${fmt(item.resistance.r1)}</div></div>
        <div class="sr-level"><div class="sr-level-label">R2</div><div class="sr-level-value sr-resistance">${fmt(item.resistance.r2)}</div></div>
        <div class="sr-level"><div class="sr-level-label">R3</div><div class="sr-level-value sr-resistance">${fmt(item.resistance.r3)}</div></div>
      </div>
    </div>`).join('');
}

// ===== Compact Lists (52-week, Active, IPO, Earnings, MF) =====
function renderCompactList(items, containerId, type) {
    const c = document.getElementById(containerId); if (!c) return;
    if (!items?.length) { c.innerHTML = '<div class="compact-row" style="color:#64748b;">No data</div>'; return; }
    c.innerHTML = items.map(item => {
        let name = '', value = '';
        switch (type) {
            case 'stock':
                name = item.symbol || item.name;
                value = `<span style="color:${cc(item.pChange)}">${sign(item.pChange)}${parseFloat(item.pChange || 0).toFixed(2)}%</span>`;
                break;
            case 'volume':
                name = item.symbol || item.name;
                value = fmtInt(item.volume);
                break;
            case 'ipo':
                name = item.name;
                value = `<span style="font-size:11px;color:#94a3b8;">${item.dates || item.priceRange || ''}</span>`;
                break;
            case 'earnings':
                name = item.company;
                value = `<span style="font-size:11px;color:#94a3b8;">${item.date || ''}</span>`;
                break;
            case 'mf':
                name = item.name;
                value = `₹${fmt(item.nav)}`;
                break;
        }
        return `<div class="compact-row"><span class="compact-name">${name}</span><span class="compact-value">${value}</span></div>`;
    }).join('');
}

// ===== Global Markets =====
function renderGlobal(data) {
    const g = document.getElementById('globalGrid'); if (!g) return;
    if (!data?.length) return;
    g.innerHTML = data.map(m => `
    <div class="global-chip">
      <div class="global-name">${m.name}</div>
      <div class="global-price">${fmt(m.price)}</div>
      <div class="global-change" style="color:${cc(m.pChange)}">${arrow(m.pChange)} ${sign(m.pChange)}${parseFloat(m.pChange || 0).toFixed(2)}%</div>
    </div>`).join('');
}

// ===== Forex & Commodities =====
function renderForexCommodity(forex, commodities) {
    const g = document.getElementById('forexCommodityGrid'); if (!g) return;
    const items = [...(forex || []).map(f => ({ ...f, icon: '💱' })), ...(commodities || []).map(c => ({ ...c, icon: '🛢️' }))];
    if (!items.length) return;
    g.innerHTML = items.map(item => {
        const priceStr = item.name?.includes('INR') ? `₹${fmt(item.price)}` : `$${fmt(item.price)}`;
        return `
    <div class="fc-chip">
      <div class="fc-name">${item.icon} ${item.name}</div>
      <div class="fc-price">${priceStr}</div>
      <div class="fc-change" style="color:${cc(item.pChange)}">${arrow(item.pChange)} ${sign(item.pChange)}${parseFloat(item.pChange || 0).toFixed(2)}%</div>
    </div>`;
    }).join('');
}

// ===== News =====
function renderNews(news) {
    const c = document.getElementById('newsList'); if (!c) return;
    if (!news?.length) { c.innerHTML = '<div style="padding:16px;color:#64748b;">No news available</div>'; return; }
    c.innerHTML = news.map(item => `
    <div class="news-item">
      <div class="news-dot"></div>
      <div class="news-content">
        <a class="news-title" href="${item.link || '#'}" target="_blank" rel="noopener">${item.title}</a>
        <div class="news-meta">
          ${item.sourceName ? `<span class="news-source">${item.sourceIcon || '📰'} ${item.sourceName}</span>` : ''}
          ${item.link && item.link !== '#' ? `<a class="news-read-more" href="${item.link}" target="_blank">Read →</a>` : ''}
        </div>
      </div>
    </div>`).join('');
}
