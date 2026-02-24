const axios = require('axios');
const cheerio = require('cheerio');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ============================
// FEATURE 6: Support & Resistance
// ============================
async function getSupportResistance() {
    console.log('📐 Calculating support & resistance levels...');
    try {
        const symbols = [
            { symbol: '^NSEI', name: 'NIFTY 50' },
            { symbol: '^NSEBANK', name: 'BANK NIFTY' },
        ];

        const results = [];

        for (const { symbol, name } of symbols) {
            try {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);

                const history = await yahooFinance.chart(symbol, {
                    period1: startDate,
                    period2: endDate,
                    interval: '1d',
                });

                const quotes = history.quotes || [];
                if (quotes.length < 5) continue;

                const closes = quotes.map(q => q.close).filter(Boolean);
                const highs = quotes.map(q => q.high).filter(Boolean);
                const lows = quotes.map(q => q.low).filter(Boolean);

                const currentPrice = closes[closes.length - 1];
                const recentHigh = Math.max(...highs.slice(-10));
                const recentLow = Math.min(...lows.slice(-10));

                // Pivot Point calculation (Classic)
                const lastHigh = highs[highs.length - 1];
                const lastLow = lows[lows.length - 1];
                const lastClose = closes[closes.length - 1];
                const pivot = (lastHigh + lastLow + lastClose) / 3;

                const r1 = (2 * pivot) - lastLow;
                const r2 = pivot + (lastHigh - lastLow);
                const r3 = lastHigh + 2 * (pivot - lastLow);
                const s1 = (2 * pivot) - lastHigh;
                const s2 = pivot - (lastHigh - lastLow);
                const s3 = lastLow - 2 * (lastHigh - pivot);

                results.push({
                    name,
                    currentPrice: Math.round(currentPrice * 100) / 100,
                    pivot: Math.round(pivot * 100) / 100,
                    resistance: {
                        r1: Math.round(r1 * 100) / 100,
                        r2: Math.round(r2 * 100) / 100,
                        r3: Math.round(r3 * 100) / 100,
                    },
                    support: {
                        s1: Math.round(s1 * 100) / 100,
                        s2: Math.round(s2 * 100) / 100,
                        s3: Math.round(s3 * 100) / 100,
                    },
                    recentHigh: Math.round(recentHigh * 100) / 100,
                    recentLow: Math.round(recentLow * 100) / 100,
                });
            } catch (err) {
                console.warn(`  ⚠️ S/R for ${name}: ${err.message}`);
            }
        }

        console.log(`✅ Support/Resistance: ${results.length} indices`);
        return results;
    } catch (error) {
        console.error('❌ S/R error:', error.message);
        return [];
    }
}

// ============================
// FEATURE 11: Trending Stocks
// ============================
async function getTrendingStocks(niftyStockQuotes) {
    console.log('🔥 Fetching trending stocks...');
    try {
        // Use already-fetched Nifty stock data to find high-move, high-volume stocks
        // This avoids the broken Yahoo trendingSymbols API
        if (niftyStockQuotes && niftyStockQuotes.length > 0) {
            // Score = abs(% change) * log(volume) — finds big movers with high interest
            const scored = niftyStockQuotes
                .filter(s => s.price && s.pChange && s.volume)
                .map(s => ({
                    ...s,
                    score: Math.abs(s.pChange) * Math.log10(s.volume + 1),
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 8);

            console.log(`✅ Trending (top movers): ${scored.length} stocks`);
            return scored;
        }

        // Fallback: fetch a fixed set of key Nifty stocks
        const symbols = [
            'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
            'SBIN.NS', 'TATAMOTORS.NS', 'ADANIENT.NS', 'BAJFINANCE.NS', 'AXISBANK.NS',
        ];
        const results = [];
        for (const symbol of symbols) {
            try {
                const quote = await yahooFinance.quote(symbol);
                results.push({
                    symbol: symbol.replace('.NS', ''),
                    price: quote.regularMarketPrice,
                    change: quote.regularMarketChange,
                    pChange: quote.regularMarketChangePercent,
                    volume: quote.regularMarketVolume,
                    score: Math.abs(quote.regularMarketChangePercent || 0) * Math.log10((quote.regularMarketVolume || 1) + 1),
                });
            } catch (err) { /* skip */ }
        }
        const sorted = results.sort((a, b) => b.score - a.score).slice(0, 8);
        console.log(`✅ Trending (fallback movers): ${sorted.length} stocks`);
        return sorted;
    } catch (error) {
        console.warn('  ⚠️ Trending error:', error.message);
        return [];
    }
}

// ============================
// FEATURE 12: IPO Calendar
// ============================
async function getIPOCalendar() {
    console.log('📅 Fetching IPO calendar...');
    try {
        const HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html',
        };

        // Fetch both pages in parallel
        const [gmpResp, subResp] = await Promise.allSettled([
            axios.get('https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/', { headers: HEADERS, timeout: 15000 }),
            axios.get('https://ipowatch.in/ipo-subscription-status-today/', { headers: HEADERS, timeout: 15000 }),
        ]);

        // --- Parse subscription data into a lookup map ---
        const subMap = {}; // name -> { type, qib, nii, retail, total }
        if (subResp.status === 'fulfilled') {
            const $s = cheerio.load(subResp.value.data);
            $s('table').first().find('tr').each((i, row) => {
                if (i === 0) return;
                const cells = $s(row).find('td');
                if (cells.length >= 8) {
                    const name = $s(cells[0]).text().trim();
                    const type = $s(cells[1]).text().trim(); // SME or Mainboard
                    const qib = $s(cells[4]).text().trim();
                    const nii = $s(cells[5]).text().trim();
                    const retail = $s(cells[6]).text().trim();
                    const total = $s(cells[7]).text().trim();
                    if (name) subMap[name.toLowerCase()] = { type, qib, nii, retail, total };
                }
            });
        }

        // --- Helper to look up subscription by fuzzy name match ---
        const getSub = (name) => {
            const key = name.toLowerCase();
            if (subMap[key]) return subMap[key];
            // partial match
            for (const k of Object.keys(subMap)) {
                if (k.includes(key.slice(0, 12)) || key.includes(k.slice(0, 12))) return subMap[k];
            }
            return null;
        };

        // --- Parse GMP/dates page ---
        const ipos = [];
        const seen = new Set();

        if (gmpResp.status === 'fulfilled') {
            const $ = cheerio.load(gmpResp.value.data);

            $('table').slice(0, 2).each((ti, table) => {
                const openStatus = ti === 0 ? 'Open' : 'Upcoming';
                $(table).find('tr').each((i, row) => {
                    if (i === 0) return;
                    const cells = $(row).find('td');
                    if (cells.length >= 4) {
                        const name = $(cells[0]).text().trim();
                        const gmp = $(cells[1]).text().trim();
                        const priceRange = $(cells[2]).text().trim();
                        const dates = cells.length >= 5 ? $(cells[4]).text().trim() : '';
                        const link = $(cells[0]).find('a').attr('href') || '';

                        if (name && name.length > 2 && !seen.has(name)) {
                            seen.add(name);
                            const sub = getSub(name);
                            ipos.push({
                                name: name.substring(0, 60),
                                type: sub?.type || 'Mainboard', // SME or Mainboard
                                priceRange: priceRange.substring(0, 30),
                                gmp: gmp.substring(0, 15),
                                dates: dates.substring(0, 40),
                                link: link.startsWith('http') ? link : '',
                                status: openStatus,
                                // Subscription data (empty string = not yet started)
                                subQIB: sub?.qib || '—',
                                subNII: sub?.nii || '—',
                                subRetail: sub?.retail || '—',
                                subTotal: sub?.total || '—',
                            });
                        }
                    }
                });
            });
        }

        console.log(`✅ IPOs: ${ipos.length} found (${ipos.filter(i => i.type === 'Mainboard').length} Mainboard, ${ipos.filter(i => i.type === 'SME').length} SME)`);
        return ipos.slice(0, 12);
    } catch (error) {
        console.error('❌ IPO error:', error.message);
        return [];
    }
}

// ============================
// FEATURE 14: Earnings Calendar
// ============================
async function getEarningsCalendar() {
    console.log('📆 Fetching earnings calendar...');
    try {
        // Chittorgarh corporate results — server-rendered with proper date range
        const today = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 7); // next 7 days
        const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

        const response = await axios.get(
            `https://www.chittorgarh.com/report/board_meeting_agenda_result_dividend_income_tax_india/11/?from_date=${fmt(today)}&to_date=${fmt(end)}&sub_type=all`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html',
                },
                timeout: 15000,
            }
        );

        const $ = cheerio.load(response.data);
        const earnings = [];
        const seen = new Set();

        $('table tbody tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 3) {
                const company = $(cells[0]).text().trim();
                const date = $(cells[1]).text().trim();
                const purpose = $(cells[2]).text().trim();
                const link = $(cells[0]).find('a').attr('href') || '';

                // Only show result/earnings announcements
                const purposeLower = purpose.toLowerCase();
                if (company && company.length > 2 && !seen.has(company) &&
                    (purposeLower.includes('result') || purposeLower.includes('financial') || purposeLower.includes('q1') || purposeLower.includes('q2') || purposeLower.includes('q3') || purposeLower.includes('q4') || purposeLower.includes('annual'))) {
                    seen.add(company);
                    earnings.push({
                        company: company.substring(0, 50),
                        date: date.trim().substring(0, 30),
                        purpose: purpose.substring(0, 50),
                        link: link.startsWith('http') ? link : (link ? `https://www.chittorgarh.com${link}` : ''),
                    });
                }
            }
        });

        if (earnings.length > 0) {
            console.log(`✅ Earnings: ${earnings.length} companies`);
            return earnings.slice(0, 8);
        }

        // Fallback: NSE corporate actions page
        return await getEarningsFromNSE();
    } catch (error) {
        console.warn('⚠️ Earnings error:', error.message);
        return await getEarningsFromNSE();
    }
}

async function getEarningsFromNSE() {
    try {
        // NSE corporate board meetings for results
        const today = new Date();
        const end = new Date(); end.setDate(end.getDate() + 7);
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        // Get session cookie first
        const home = await axios.get('https://www.nseindia.com/', {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' }, timeout: 10000
        });
        const cookies = (home.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

        const r = await axios.get(
            `https://www.nseindia.com/api/merged-daily-reports?key=favCapital&toDate=${fmt(end)}&fromDate=${fmt(today)}`,
            {
                headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', Cookie: cookies, Referer: 'https://www.nseindia.com/' },
                timeout: 12000,
            }
        );

        const data = r.data;
        const earnings = [];
        const seen = new Set();
        const items = Array.isArray(data) ? data : (data?.data || []);

        for (const item of items) {
            const company = item.symbol || item.company || item.companyName || '';
            const date = item.bm_date || item.date || item.meetingDate || '';
            const purpose = (item.bm_purpose || item.purpose || '').toLowerCase();

            if (company && !seen.has(company) &&
                (purpose.includes('result') || purpose.includes('financial') || purpose.includes('quarterly'))) {
                seen.add(company);
                earnings.push({
                    company: company.substring(0, 50),
                    date: date.substring(0, 20),
                    link: '',
                });
            }
        }

        console.log(`✅ Earnings (NSE): ${earnings.length} companies`);
        return earnings.slice(0, 8);
    } catch (err) {
        console.warn('  ⚠️ NSE earnings failed:', err.message);
        return [];
    }
}

// ============================
// FEATURE 13: Mutual Fund NAV
// ============================
async function getMutualFundNAV() {
    console.log('📈 Fetching mutual fund NAVs...');
    try {
        // Popular MF scheme codes from AMFI
        const popularFunds = [
            { code: '120503', name: 'SBI Blue Chip Fund' },
            { code: '119598', name: 'Axis Bluechip Fund' },
            { code: '118989', name: 'Mirae Asset Large Cap' },
            { code: '120505', name: 'SBI Small Cap Fund' },
            { code: '125494', name: 'Parag Parikh Flexi Cap' },
            { code: '120586', name: 'SBI Equity Hybrid' },
        ];

        const response = await axios.get('https://www.amfiindia.com/spages/NAVAll.txt', {
            timeout: 15000,
        });

        const lines = response.data.split('\n');
        const results = [];

        for (const fund of popularFunds) {
            const line = lines.find(l => l.startsWith(fund.code + ';'));
            if (line) {
                const parts = line.split(';');
                if (parts.length >= 5) {
                    results.push({
                        name: fund.name,
                        code: fund.code,
                        nav: parseFloat(parts[4]) || 0,
                        date: parts[5]?.trim() || '',
                        category: parts[1]?.trim() || '',
                    });
                }
            }
        }

        console.log(`✅ MF NAVs: ${results.length} funds`);
        return results;
    } catch (error) {
        console.error('❌ MF NAV error:', error.message);
        return [];
    }
}

// ============================
// FEATURE 10: AI Market Summary
// ============================
async function generateAISummary(allData) {
    console.log('🤖 Generating AI market summary...');

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.log('  ⚠️ No GEMINI_API_KEY — generating rule-based summary');
            return generateRuleBasedSummary(allData);
        }

        const { marketData, fiiDiiData, sectorData, globalMarkets, vixData } = allData;
        const nifty = marketData?.nifty50?.summary;
        const bankNifty = marketData?.bankNifty?.summary;

        const prompt = `You are a professional Indian stock market analyst. Write a brief 3-4 sentence market summary for today's trading session based on this data:

- Nifty 50: ${nifty?.last || 'N/A'} (${nifty?.pChange >= 0 ? '+' : ''}${nifty?.pChange?.toFixed(2) || 0}%)
- Bank Nifty: ${bankNifty?.last || 'N/A'} (${bankNifty?.pChange >= 0 ? '+' : ''}${bankNifty?.pChange?.toFixed(2) || 0}%)
- India VIX: ${vixData?.value || 'N/A'}
- Top gaining sectors: ${(sectorData || []).filter(s => s.pChange > 0).slice(0, 3).map(s => `${s.name} (+${s.pChange?.toFixed(1)}%)`).join(', ') || 'N/A'}
- Top losing sectors: ${(sectorData || []).filter(s => s.pChange < 0).slice(0, 3).map(s => `${s.name} (${s.pChange?.toFixed(1)}%)`).join(', ') || 'N/A'}
- FII Net: ₹${fiiDiiData?.fii?.netValue || 0} Cr | DII Net: ₹${fiiDiiData?.dii?.netValue || 0} Cr
- Global markets: ${(globalMarkets || []).slice(0, 3).map(g => `${g.name}: ${g.pChange >= 0 ? '+' : ''}${g.pChange?.toFixed(1)}%`).join(', ') || 'N/A'}

Keep it professional, concise, and factual. Focus on key takeaways. Do not use bullet points.`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
            },
            { timeout: 15000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            console.log('✅ AI summary generated');
            return { summary: text.trim(), source: 'Gemini AI' };
        }

        return generateRuleBasedSummary(allData);
    } catch (error) {
        console.warn('⚠️ AI summary error:', error.message);
        return generateRuleBasedSummary(allData);
    }
}

function generateRuleBasedSummary(allData) {
    const { marketData, fiiDiiData, sectorData, vixData } = allData;
    const nifty = marketData?.nifty50?.summary;
    const bankNifty = marketData?.bankNifty?.summary;

    if (!nifty) return { summary: 'Market data unavailable for summary generation.', source: 'System' };

    const niftyDir = (nifty.pChange || 0) >= 0 ? 'gained' : 'declined';
    const bankDir = (bankNifty?.pChange || 0) >= 0 ? 'rose' : 'fell';

    const topSector = (sectorData || []).filter(s => s.pChange).sort((a, b) => Math.abs(b.pChange) - Math.abs(a.pChange))[0];
    const sectorNote = topSector
        ? ` ${topSector.name} was the most active sector, ${topSector.pChange >= 0 ? 'gaining' : 'shedding'} ${Math.abs(topSector.pChange).toFixed(1)}%.`
        : '';

    const vixNote = vixData?.value
        ? ` India VIX stands at ${vixData.value.toFixed(2)}, indicating ${vixData.value < 15 ? 'low volatility and calm markets' : vixData.value < 20 ? 'moderate volatility' : 'heightened volatility and caution among traders'}.`
        : '';

    const fiiNote = fiiDiiData?.fii?.netValue
        ? ` FIIs were net ${fiiDiiData.fii.netValue >= 0 ? 'buyers' : 'sellers'} at ₹${Math.abs(fiiDiiData.fii.netValue).toFixed(0)} Cr while DIIs were net ${(fiiDiiData.dii?.netValue || 0) >= 0 ? 'buyers' : 'sellers'} at ₹${Math.abs(fiiDiiData.dii?.netValue || 0).toFixed(0)} Cr.`
        : '';

    const summary = `Nifty 50 ${niftyDir} ${Math.abs(nifty.pChange).toFixed(2)}% to close at ${nifty.last?.toLocaleString()}, while Bank Nifty ${bankDir} ${Math.abs(bankNifty?.pChange || 0).toFixed(2)}%.${sectorNote}${vixNote}${fiiNote}`;

    return { summary, source: 'Auto-generated' };
}

module.exports = {
    getSupportResistance,
    getTrendingStocks,
    getIPOCalendar,
    getEarningsCalendar,
    getMutualFundNAV,
    generateAISummary,
};
