const { format } = require('date-fns');

// ===== HELPERS =====
function fmt(value) {
  if (value === null || value === undefined || isNaN(value)) return '0.00';
  return parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(value) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return parseInt(value).toLocaleString('en-IN');
}

function fmtCr(value) {
  if (value === null || value === undefined || isNaN(value)) return '₹0';
  const num = parseFloat(value);
  if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${fmt(num)}`;
}

function changeColor(v) {
  if (!v || isNaN(v)) return '#6b7280';
  return parseFloat(v) >= 0 ? '#10b981' : '#ef4444';
}

function arrow(v) {
  if (!v || isNaN(v)) return '';
  return parseFloat(v) >= 0 ? '▲' : '▼';
}

function sign(v) {
  if (!v || isNaN(v)) return '';
  return parseFloat(v) >= 0 ? '+' : '';
}

const FONT = "'Segoe UI',Arial,sans-serif";
const cardStyle = `background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 12px; overflow: hidden;`;
const sectionHeaderStyle = (bg, color) => `padding: 14px 16px; font-family:${FONT}; font-size: 15px; font-weight: 700; color: ${color}; background: ${bg};`;

// ===== SECTION BUILDERS =====

function buildAISummary(data) {
  if (!data || !data.summary) return '';
  return `
  <tr><td style="padding: 24px 30px 8px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius: 12px; overflow: hidden; border: 1px solid rgba(139,92,246,0.2); background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);">
      <tr><td style="padding: 20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-family:${FONT}; font-size: 15px; font-weight: 700; color: #c4b5fd;">🤖 AI Market Summary</td></tr>
          <tr><td style="padding-top: 12px; font-family:${FONT}; font-size: 14px; color: #e2e8f0; line-height: 1.7;">${data.summary}</td></tr>
          <tr><td style="padding-top: 8px; font-family:${FONT}; font-size: 11px; color: #818cf8;">Source: ${data.source}</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function buildSentimentMeter(sentiment, vix) {
  if (!sentiment) return '';
  const pct = sentiment.score;
  const barColor = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const vixSection = vix ? `
    <tr><td style="padding-top: 14px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:${FONT}; font-size: 13px; color: #94a3b8;">India VIX (Fear Index)</td>
          <td style="text-align: right; font-family:${FONT}; font-size: 16px; font-weight: 700; color: ${changeColor(vix.change)};">${fmt(vix.value)} <span style="font-size: 12px;">(${sign(vix.pChange)}${parseFloat(vix.pChange || 0).toFixed(2)}%)</span></td>
        </tr>
      </table>
    </td></tr>` : '';

  return `
  <tr><td style="padding: 16px 30px 8px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="${cardStyle} padding: 24px;">
      <tr><td style="font-family:${FONT}; font-size: 14px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">MARKET SENTIMENT</td></tr>
      <tr><td style="padding-top: 8px;"><span style="font-family:${FONT}; font-size: 28px; font-weight: 800; color: #fff;">${sentiment.emoji} ${sentiment.label}</span></td></tr>
      <tr><td style="padding-top: 10px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-family:${FONT}; font-size: 11px; color: #ef4444; font-weight: 600;">FEAR</td>
            <td style="text-align: right; font-family:${FONT}; font-size: 11px; color: #10b981; font-weight: 600;">GREED</td>
          </tr>
          <tr><td colspan="2" style="padding-top: 4px;">
            <div style="height: 8px; background: linear-gradient(90deg, #ef4444, #f59e0b, #10b981); border-radius: 4px; position: relative;">
              <div style="position: absolute; top: -4px; left: ${pct}%; width: 16px; height: 16px; background: #fff; border-radius: 50%; border: 3px solid ${barColor}; margin-left: -8px;"></div>
            </div>
          </td></tr>
          <tr><td colspan="2" style="text-align: center; padding-top: 6px; font-family:${FONT}; font-size: 12px; color: #94a3b8;">Score: ${pct}/100</td></tr>
        </table>
      </td></tr>
      ${vixSection}
    </table>
  </td></tr>`;
}

function buildIndexSection(indexData, title) {
  if (!indexData || !indexData.summary) {
    return `<tr><td style="padding:20px; font-family:${FONT}; color:#6b7280;">Data unavailable for ${title}</td></tr>`;
  }
  const s = indexData.summary;
  const cc = changeColor(s.pChange);
  return `
  <tr><td style="padding: 24px 30px 12px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="${cardStyle}">
      <tr><td style="padding: 24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-family:${FONT}; font-size:14px; color:#94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">${title}</td></tr>
          <tr><td style="padding-top: 8px;">
            <span style="font-family:${FONT}; font-size: 32px; font-weight: 700; color: #fff;">${fmt(s.last)}</span>
            <span style="font-family:${FONT}; font-size: 16px; color: ${cc}; margin-left: 12px; font-weight: 600;">
              ${arrow(s.pChange)} ${sign(s.change)}${fmt(s.change)} (${sign(s.pChange)}${parseFloat(s.pChange || 0).toFixed(2)}%)
            </span>
          </td></tr>
          ${s.open ? `<tr><td style="padding-top: 10px; font-family:${FONT}; font-size: 12px; color: #64748b;">O: ${fmt(s.open)} &nbsp; H: ${fmt(s.high)} &nbsp; L: ${fmt(s.low)}</td></tr>` : ''}
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function buildStockTable(stocks, title, type) {
  if (!stocks || stocks.length === 0) return '';
  const isG = type === 'gainer';
  const hc = isG ? '#065f46' : '#7f1d1d';
  const hbg = isG ? '#d1fae5' : '#fee2e2';
  const icon = isG ? '🟢' : '🔴';
  const rows = stocks.map((s, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `<tr style="background:${bg};"><td style="padding:12px 16px;font-family:${FONT};font-size:14px;color:#1e293b;font-weight:500;border-bottom:1px solid #f1f5f9;">${s.symbol}</td><td style="padding:12px 16px;font-family:${FONT};font-size:14px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">₹${fmt(s.price)}</td><td style="padding:12px 16px;font-family:${FONT};font-size:14px;color:${changeColor(s.pChange)};text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${arrow(s.pChange)} ${Math.abs(parseFloat(s.pChange || 0)).toFixed(2)}%</td></tr>`;
  }).join('');
  return `<tr><td style="padding: 16px 30px 8px 30px;"><table width="100%" cellpadding="0" cellspacing="0" style="border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;">
    <tr><td colspan="3" style="${sectionHeaderStyle(hbg, hc)}">${icon} ${title}</td></tr>
    <tr style="background:#f1f5f9;"><td style="padding:10px 16px;font-family:${FONT};font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Stock</td><td style="padding:10px 16px;font-family:${FONT};font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:right;">Price</td><td style="padding:10px 16px;font-family:${FONT};font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:right;">Change</td></tr>
    ${rows}</table></td></tr>`;
}

function buildSectorHeatmap(sectors) {
  if (!sectors || sectors.length === 0) return '';
  const cells = sectors.map(s => {
    const cc = changeColor(s.pChange);
    const bg = (s.pChange || 0) >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';
    return `<td style="padding:10px 12px;text-align:center;background:${bg};border:1px solid #f1f5f9;">
      <div style="font-family:${FONT};font-size:12px;font-weight:700;color:#1e293b;">${s.name}</div>
      <div style="font-family:${FONT};font-size:14px;font-weight:800;color:${cc};margin-top:4px;">${sign(s.pChange)}${parseFloat(s.pChange || 0).toFixed(2)}%</div>
    </td>`;
  });
  // 4 columns layout
  let rowsHtml = '';
  for (let i = 0; i < cells.length; i += 4) {
    rowsHtml += `<tr>${cells.slice(i, i + 4).join('')}${'<td></td>'.repeat(Math.max(0, 4 - cells.slice(i, i + 4).length))}</tr>`;
  }
  return `<tr><td style="padding:24px 30px 8px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td colspan="4" style="${sectionHeaderStyle('#fef3c7', '#92400e')}">📊 Sector Performance</td></tr>
      ${rowsHtml}
    </table></td></tr>`;
}

function buildFIIDIISection(data) {
  if (!data) return '';
  const f = data.fii || {}, d = data.dii || {};
  const fc = changeColor(f.netValue), dc = changeColor(d.netValue);
  const isNetOnly = (!f.buyValue && !f.sellValue && !d.buyValue && !d.sellValue);
  const noteRow = data.note ? `<tr><td colspan="${isNetOnly ? '2' : '4'}" style="padding:8px 16px;font-family:${FONT};font-size:12px;color:#94a3b8;font-style:italic;">⚠️ ${data.note}</td></tr>` : '';
  const netOnlyNote = isNetOnly
    ? `<tr><td colspan="2" style="padding:6px 16px 10px;font-family:${FONT};font-size:11px;color:#94a3b8;font-style:italic;">ℹ️ Buy/Sell breakdown not available from source — showing Net activity only</td></tr>`
    : '';

  let tableContent;
  if (isNetOnly) {
    tableContent = `
      <tr><td colspan="2" style="${sectionHeaderStyle('#dbeafe', '#1e3a5f')}">🏦 FII / DII Activity ${data.date ? `<span style="font-weight:400;font-size:13px;color:#64748b;">(${data.date})</span>` : ''}</td></tr>
      <tr style="background:#f1f5f9;"><td style="padding:10px 16px;font-family:${FONT};font-size:12px;font-weight:600;color:#64748b;">Category</td><td style="padding:10px 16px;font-family:${FONT};font-size:12px;font-weight:600;color:#64748b;text-align:right;">Net (₹ Cr)</td></tr>
      <tr style="background:#fff;"><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;">FII / FPI</td><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:${fc};text-align:right;font-weight:700;border-bottom:1px solid #f1f5f9;">${sign(f.netValue)}${fmt(f.netValue)}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:#1e293b;font-weight:600;">DII</td><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:${dc};text-align:right;font-weight:700;">${sign(d.netValue)}${fmt(d.netValue)}</td></tr>
    `;
  } else {
    tableContent = `
      <tr><td colspan="4" style="${sectionHeaderStyle('#dbeafe', '#1e3a5f')}">🏦 FII / DII Activity ${data.date ? `<span style="font-weight:400;font-size:13px;color:#64748b;">(${data.date})</span>` : ''}</td></tr>
      <tr style="background:#f1f5f9;"><td style="padding:10px 16px;font-family:${FONT};font-size:12px;font-weight:600;color:#64748b;">Category</td><td style="padding:10px 16px;font-family:${FONT};font-size:12px;font-weight:600;color:#64748b;text-align:right;">Buy (₹ Cr)</td><td style="padding:10px 16px;font-family:${FONT};font-size:12px;font-weight:600;color:#64748b;text-align:right;">Sell (₹ Cr)</td><td style="padding:10px 16px;font-family:${FONT};font-size:12px;font-weight:600;color:#64748b;text-align:right;">Net (₹ Cr)</td></tr>
      <tr style="background:#fff;"><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;">FII / FPI</td><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">${f.buyValue ? fmt(f.buyValue) : '—'}</td><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">${f.sellValue ? fmt(f.sellValue) : '—'}</td><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:${fc};text-align:right;font-weight:700;border-bottom:1px solid #f1f5f9;">${sign(f.netValue)}${fmt(f.netValue)}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:#1e293b;font-weight:600;">DII</td><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:#475569;text-align:right;">${d.buyValue ? fmt(d.buyValue) : '—'}</td><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:#475569;text-align:right;">${d.sellValue ? fmt(d.sellValue) : '—'}</td><td style="padding:14px 16px;font-family:${FONT};font-size:14px;color:${dc};text-align:right;font-weight:700;">${sign(d.netValue)}${fmt(d.netValue)}</td></tr>
    `;
  }

  return `<tr><td style="padding:24px 30px 8px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
      ${tableContent}
      ${netOnlyNote}
      ${noteRow}
    </table></td></tr>`;
}

function buildGlobalMarkets(data) {
  if (!data || data.length === 0) return '';
  const rows = data.map((m, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    return `<tr style="background:${bg};"><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#1e293b;font-weight:500;border-bottom:1px solid #f1f5f9;">${m.name}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">${fmt(m.price)}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:${changeColor(m.pChange)};text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${arrow(m.pChange)} ${sign(m.pChange)}${parseFloat(m.pChange || 0).toFixed(2)}%</td></tr>`;
  }).join('');
  return `<tr><td style="padding:24px 30px 8px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td colspan="3" style="${sectionHeaderStyle('#ecfdf5', '#065f46')}">🌍 Global Markets</td></tr>
      <tr style="background:#f1f5f9;"><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;">INDEX</td><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;text-align:right;">PRICE</td><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;text-align:right;">CHANGE</td></tr>
      ${rows}</table></td></tr>`;
}

function buildForexCommodities(forex, commodities) {
  if ((!forex || forex.length === 0) && (!commodities || commodities.length === 0)) return '';
  const allItems = [
    ...(forex || []).map(f => ({ ...f, type: '💱' })),
    ...(commodities || []).map(c => ({ ...c, type: '🛢️' })),
  ];
  const rows = allItems.map((item, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const priceStr = item.name.includes('INR') ? `₹${fmt(item.price)}` : `$${fmt(item.price)}`;
    return `<tr style="background:${bg};"><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#1e293b;font-weight:500;border-bottom:1px solid #f1f5f9;">${item.type} ${item.name}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">${priceStr}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:${changeColor(item.pChange)};text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${arrow(item.pChange)} ${sign(item.pChange)}${parseFloat(item.pChange || 0).toFixed(2)}%</td></tr>`;
  }).join('');
  return `<tr><td style="padding:16px 30px 8px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td colspan="3" style="${sectionHeaderStyle('#fff7ed', '#9a3412')}">💱 Forex & 🛢️ Commodities</td></tr>
      ${rows}</table></td></tr>`;
}

function buildSupportResistance(data) {
  if (!data || data.length === 0) return '';
  const cards = data.map(item => `
    <tr><td style="padding:8px 30px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td colspan="7" style="padding:10px 16px;font-family:${FONT};font-size:13px;font-weight:700;color:#1e293b;background:#f8fafc;">📐 ${item.name} <span style="font-weight:400;color:#64748b;">— Pivot: ${fmt(item.pivot)}</span></td></tr>
        <tr style="background:#fef2f2;"><td style="padding:8px;text-align:center;font-family:${FONT};font-size:11px;color:#64748b;font-weight:600;">S3</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:11px;color:#64748b;font-weight:600;">S2</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:11px;color:#64748b;font-weight:600;">S1</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:11px;color:#3b82f6;font-weight:700;">CURRENT</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:11px;color:#64748b;font-weight:600;">R1</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:11px;color:#64748b;font-weight:600;">R2</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:11px;color:#64748b;font-weight:600;">R3</td></tr>
        <tr><td style="padding:8px;text-align:center;font-family:${FONT};font-size:13px;color:#ef4444;font-weight:600;">${fmt(item.support.s3)}</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:13px;color:#ef4444;font-weight:600;">${fmt(item.support.s2)}</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:13px;color:#f59e0b;font-weight:600;">${fmt(item.support.s1)}</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:14px;color:#3b82f6;font-weight:800;">${fmt(item.currentPrice)}</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:13px;color:#f59e0b;font-weight:600;">${fmt(item.resistance.r1)}</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:13px;color:#10b981;font-weight:600;">${fmt(item.resistance.r2)}</td><td style="padding:8px;text-align:center;font-family:${FONT};font-size:13px;color:#10b981;font-weight:600;">${fmt(item.resistance.r3)}</td></tr>
      </table>
    </td></tr>`).join('');

  return `<tr><td style="padding:16px 30px 0 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#1e3a5f;">📐 Support & Resistance Levels</td></tr>${cards}`;
}

function build52WeekBreakers(data) {
  if (!data || (data.highs.length === 0 && data.lows.length === 0)) return '';
  const buildList = (items, type) => {
    if (items.length === 0) return '';
    const icon = type === 'high' ? '🔝' : '🔻';
    const label = type === 'high' ? '52-Week Highs' : '52-Week Lows';
    const hbg = type === 'high' ? '#d1fae5' : '#fee2e2';
    const hc = type === 'high' ? '#065f46' : '#7f1d1d';
    const rows = items.map((s, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
      return `<tr style="background:${bg};"><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#1e293b;font-weight:500;border-bottom:1px solid #f1f5f9;">${s.symbol}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">₹${fmt(s.price)}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:${changeColor(s.pChange)};text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${sign(s.pChange)}${parseFloat(s.pChange || 0).toFixed(2)}%</td></tr>`;
    }).join('');
    return `<tr><td style="padding:8px 30px;"><table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td colspan="3" style="${sectionHeaderStyle(hbg, hc)}">${icon} ${label}</td></tr>${rows}</table></td></tr>`;
  };
  return buildList(data.highs, 'high') + buildList(data.lows, 'low');
}

function buildMostActive(data) {
  if (!data || data.length === 0) return '';
  const rows = data.map((s, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    return `<tr style="background:${bg};"><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#1e293b;font-weight:500;border-bottom:1px solid #f1f5f9;">${s.symbol}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">₹${fmt(s.price)}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">${fmtInt(s.volume)}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:${changeColor(s.pChange)};text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${sign(s.pChange)}${parseFloat(s.pChange || 0).toFixed(2)}%</td></tr>`;
  }).join('');
  return `<tr><td style="padding:16px 30px 8px 30px;"><table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td colspan="4" style="${sectionHeaderStyle('#fef3c7', '#92400e')}">🔥 Most Active by Volume</td></tr>
    <tr style="background:#f1f5f9;"><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;">STOCK</td><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;text-align:right;">PRICE</td><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;text-align:right;">VOLUME</td><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;text-align:right;">CHANGE</td></tr>
    ${rows}</table></td></tr>`;
}

function buildTrending(data) {
  if (!data || data.length === 0) return '';
  const rows = data.map((s, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    return `<tr style="background:${bg};"><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#1e293b;font-weight:500;border-bottom:1px solid #f1f5f9;">🔥 ${s.symbol}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">₹${fmt(s.price)}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:${changeColor(s.pChange)};text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${sign(s.pChange)}${parseFloat(s.pChange || 0).toFixed(2)}%</td></tr>`;
  }).join('');
  return `<tr><td style="padding:16px 30px 8px 30px;"><table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td colspan="3" style="${sectionHeaderStyle('#fce7f3', '#9d174d')}">🔥 Trending Stocks</td></tr>${rows}</table></td></tr>`;
}

function buildIPOCalendar(data) {
  if (!data || data.length === 0) return '';
  const COLS = 8;
  const colStyle = (align = 'left') => `padding:8px 12px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;text-align:${align};`;
  const cellStyle = (align = 'left', extra = '') => `padding:9px 12px;font-family:${FONT};font-size:12px;color:#475569;text-align:${align};border-bottom:1px solid #f1f5f9;${extra}`;

  const subColor = (val) => {
    const n = parseFloat(val);
    if (isNaN(n) || val === '—') return '#94a3b8';
    return n >= 1 ? '#16a34a' : '#dc2626';
  };

  const headerRow = `<tr style="background:#f1f5f9;">
    <td style="${colStyle()}">IPO NAME</td>
    <td style="${colStyle('center')}">PRICE BAND</td>
    <td style="${colStyle('center')}">GMP</td>
    <td style="${colStyle('center')}">DATES</td>
    <td style="${colStyle('center')}">QIB(x)</td>
    <td style="${colStyle('center')}">NII(x)</td>
    <td style="${colStyle('center')}">RETAIL(x)</td>
    <td style="${colStyle('center')}">TOTAL(x)</td>
  </tr>`;

  const buildRows = (ipos) => ipos.map((ipo, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const nameCell = ipo.link
      ? `<a href="${ipo.link}" target="_blank" style="color:#1e293b;text-decoration:none;font-weight:500;">${ipo.name}</a>`
      : `<span style="color:#1e293b;font-weight:500;">${ipo.name}</span>`;
    const statusBadge = ipo.status === 'Open'
      ? `<span style="background:#dcfce7;color:#16a34a;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;">OPEN</span>`
      : `<span style="background:#e0e7ff;color:#4338ca;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;">SOON</span>`;

    return `<tr style="background:${bg};">
      <td style="${cellStyle()}">${nameCell}${statusBadge}</td>
      <td style="${cellStyle('center')}">${ipo.priceRange || '—'}</td>
      <td style="${cellStyle('center')}">${ipo.gmp || '—'}</td>
      <td style="${cellStyle('center')}">${ipo.dates || '—'}</td>
      <td style="${cellStyle('center')};color:${subColor(ipo.subQIB)};font-weight:600;">${ipo.subQIB}</td>
      <td style="${cellStyle('center')};color:${subColor(ipo.subNII)};font-weight:600;">${ipo.subNII}</td>
      <td style="${cellStyle('center')};color:${subColor(ipo.subRetail)};font-weight:600;">${ipo.subRetail}</td>
      <td style="${cellStyle('center')};color:${subColor(ipo.subTotal)};font-weight:700;">${ipo.subTotal}</td>
    </tr>`;
  }).join('');

  const mainboard = data.filter(i => i.type !== 'SME');
  const sme = data.filter(i => i.type === 'SME');

  const mainboardSection = mainboard.length > 0 ? `
    <tr><td colspan="${COLS}" style="padding:10px 16px 4px;font-family:${FONT};font-size:12px;font-weight:700;color:#5b21b6;background:#f5f3ff;border-top:2px solid #ddd6fe;">🏛️ Mainboard IPOs</td></tr>
    ${headerRow}
    ${buildRows(mainboard)}` : '';

  const smeSection = sme.length > 0 ? `
    <tr><td colspan="${COLS}" style="padding:10px 16px 4px;font-family:${FONT};font-size:12px;font-weight:700;color:#0369a1;background:#e0f2fe;border-top:2px solid #bae6fd;">🏢 SME IPOs</td></tr>
    ${headerRow}
    ${buildRows(sme)}` : '';

  return `<tr><td style="padding:16px 30px 8px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td colspan="${COLS}" style="${sectionHeaderStyle('#ede9fe', '#5b21b6')}">📅 IPO Calendar <span style="font-weight:400;font-size:12px;color:#8b5cf6;">(Live Subscription Data)</span></td></tr>
      ${mainboardSection}
      ${smeSection}
      <tr><td colspan="${COLS}" style="padding:6px 16px;font-family:${FONT};font-size:11px;color:#94a3b8;font-style:italic;">ℹ️ Subscription data live from BSE & NSE. Green = oversubscribed (≥1x), Red = undersubscribed.</td></tr>
    </table></td></tr>`;
}


function buildEarningsCalendar(data) {
  if (!data || data.length === 0) return '';
  const rows = data.map((e, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const nameCell = e.link ? `<a href="${e.link}" target="_blank" style="color:#1e293b;text-decoration:none;font-weight:500;">${e.company}</a>` : e.company;
    return `<tr style="background:${bg};"><td style="padding:10px 16px;font-family:${FONT};font-size:13px;border-bottom:1px solid #f1f5f9;">${nameCell}</td><td style="padding:10px 16px;font-family:${FONT};font-size:12px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9;">📆 ${e.date}</td></tr>`;
  }).join('');
  return `<tr><td style="padding:16px 30px 8px 30px;"><table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td colspan="2" style="${sectionHeaderStyle('#fef9c3', '#854d0e')}">📆 Earnings Calendar</td></tr>${rows}</table></td></tr>`;
}

function buildMutualFunds(data) {
  if (!data || data.length === 0) return '';
  const rows = data.map((f, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    return `<tr style="background:${bg};"><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#1e293b;font-weight:500;border-bottom:1px solid #f1f5f9;">${f.name}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#475569;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">₹${fmt(f.nav)}</td><td style="padding:10px 16px;font-family:${FONT};font-size:12px;color:#64748b;text-align:right;border-bottom:1px solid #f1f5f9;">${f.date}</td></tr>`;
  }).join('');
  return `<tr><td style="padding:16px 30px 8px 30px;"><table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td colspan="3" style="${sectionHeaderStyle('#e0f2fe', '#0c4a6e')}">📈 Popular Mutual Fund NAVs</td></tr>
    <tr style="background:#f1f5f9;"><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;">SCHEME</td><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;text-align:right;">NAV</td><td style="padding:8px 16px;font-family:${FONT};font-size:11px;font-weight:600;color:#64748b;text-align:right;">DATE</td></tr>
    ${rows}</table></td></tr>`;
}

function buildNewsSection(newsData) {
  if (!newsData || newsData.length === 0) return '';
  const newsItems = newsData.map(item => {
    const sourceBadge = item.sourceName ? `<span style="display:inline-block;background:#eef2ff;color:#4338ca;font-family:${FONT};font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;margin-left:8px;">${item.sourceIcon || '📰'} ${item.sourceName}</span>` : '';
    const linkTag = item.link && item.link !== '#' ? `<a href="${item.link}" target="_blank" style="color:#1e293b;text-decoration:none;font-family:${FONT};font-size:14px;line-height:1.6;">${item.title}</a>` : `<span style="font-family:${FONT};font-size:14px;color:#1e293b;line-height:1.6;">${item.title}</span>`;
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="8" valign="top" style="padding-top:8px;"><div style="width:6px;height:6px;background:#3b82f6;border-radius:50%;"></div></td><td style="padding-left:12px;">${linkTag}${sourceBadge}${item.link && item.link !== '#' ? `<br/><a href="${item.link}" target="_blank" style="font-family:${FONT};font-size:12px;color:#3b82f6;text-decoration:underline;margin-top:4px;display:inline-block;">Read Full Article →</a>` : ''}</td></tr></table></td></tr>`;
  }).join('');
  return `<tr><td style="padding:24px 30px 8px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="${sectionHeaderStyle('#e0e7ff', '#1e3a5f')}">📰 Market News <span style="font-weight:400;font-size:12px;color:#64748b;">(click to read)</span></td></tr>
      <tr><td style="padding:8px 16px 16px 16px;"><table width="100%" cellpadding="0" cellspacing="0">${newsItems}</table></td></tr>
    </table></td></tr>`;
}

// ===== MAIN EMAIL GENERATOR =====
function generateEmailHTML(data) {
  const now = new Date();
  const dateStr = format(now, 'EEEE, dd MMMM yyyy');
  const timeStr = format(now, 'hh:mm a');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>FINews - Daily Market Digest</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:${FONT};">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:20px 0;">
<tr><td align="center">
<table width="680" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

<!-- HEADER -->
<tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e40af 50%,#3b82f6 100%);padding:36px 30px;text-align:center;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="text-align:center;"><span style="font-family:${FONT};font-size:28px;font-weight:800;color:#fff;letter-spacing:1px;">📈 FINews</span></td></tr>
    <tr><td style="text-align:center;padding-top:6px;"><span style="font-family:${FONT};font-size:14px;color:#93c5fd;letter-spacing:2px;text-transform:uppercase;">Daily Market Intelligence</span></td></tr>
    <tr><td style="text-align:center;padding-top:12px;"><span style="font-family:${FONT};font-size:14px;color:#bfdbfe;">${dateStr} • ${timeStr}</span></td></tr>
  </table>
</td></tr>

<!-- AI SUMMARY -->
${buildAISummary(data.aiSummary)}

<!-- SENTIMENT + VIX -->
${buildSentimentMeter(data.sentiment, data.vixData)}

<!-- NIFTY 50 -->
${buildIndexSection(data.marketData?.nifty50, 'NIFTY 50')}
${buildStockTable(data.marketData?.nifty50?.gainers, 'Top Gainers — NIFTY 50', 'gainer')}
${buildStockTable(data.marketData?.nifty50?.losers, 'Top Losers — NIFTY 50', 'loser')}

<!-- BANK NIFTY -->
${buildIndexSection(data.marketData?.bankNifty, 'NIFTY BANK')}
${buildStockTable(data.marketData?.bankNifty?.gainers, 'Top Gainers — NIFTY BANK', 'gainer')}
${buildStockTable(data.marketData?.bankNifty?.losers, 'Top Losers — NIFTY BANK', 'loser')}

<!-- SECTOR HEATMAP -->
${buildSectorHeatmap(data.sectorData)}

<!-- FII/DII -->
${buildFIIDIISection(data.fiiDiiData)}

<!-- SUPPORT & RESISTANCE -->
${buildSupportResistance(data.supportResistance)}

<!-- 52-WEEK BREAKERS -->
${build52WeekBreakers(data.fiftyTwoWeek)}

<!-- MOST ACTIVE -->
${buildMostActive(data.mostActive)}

<!-- TRENDING -->
${buildTrending(data.trendingStocks)}

<!-- GLOBAL MARKETS -->
${buildGlobalMarkets(data.globalMarkets)}

<!-- FOREX & COMMODITIES -->
${buildForexCommodities(data.forexData, data.commodityData)}

<!-- IPO CALENDAR -->
${buildIPOCalendar(data.ipoCalendar)}

<!-- EARNINGS CALENDAR -->
${buildEarningsCalendar(data.earningsCalendar)}

<!-- MF NAV -->
${buildMutualFunds(data.mutualFunds)}

<!-- NEWS -->
${buildNewsSection(data.newsData)}

<!-- FOOTER -->
<tr><td style="padding:28px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="text-align:center;font-family:${FONT};font-size:12px;color:#94a3b8;line-height:1.6;"><strong style="color:#64748b;">Disclaimer:</strong> This is auto-generated for informational purposes only. Not financial advice. Consult a certified advisor.</td></tr>
    <tr><td style="text-align:center;padding-top:12px;font-family:${FONT};font-size:11px;color:#cbd5e1;">Powered by FINews Automation • Data: Yahoo Finance, NSE India, AMFI</td></tr>
  </table>
</td></tr>

</table></td></tr></table>
</body></html>`;
}

module.exports = { generateEmailHTML };
