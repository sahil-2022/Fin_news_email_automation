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
async function getTrendingStocks() {
    console.log('🔥 Fetching trending stocks...');
    try {
        // Use Yahoo Finance trending tickers for India
        const trending = await yahooFinance.trendingSymbols('IN', { count: 10 });
        const symbols = (trending.quotes || [])
            .map(q => q.symbol)
            .filter(s => s && s.endsWith('.NS'))
            .slice(0, 8);

        if (symbols.length === 0) {
            console.log('  ⚠️ No trending IN symbols, trying manual approach');
            return await getTrendingFromSearch();
        }

        const results = [];
        for (const symbol of symbols) {
            try {
                const quote = await yahooFinance.quote(symbol);
                results.push({
                    symbol: quote.symbol?.replace('.NS', '') || symbol.replace('.NS', ''),
                    name: quote.shortName || quote.longName || symbol,
                    price: quote.regularMarketPrice,
                    change: quote.regularMarketChange,
                    pChange: quote.regularMarketChangePercent,
                    volume: quote.regularMarketVolume,
                });
            } catch (err) {
                // skip
            }
        }

        console.log(`✅ Trending: ${results.length} stocks`);
        return results;
    } catch (error) {
        console.warn('  ⚠️ Trending symbols fallback:', error.message);
        return await getTrendingFromSearch();
    }
}

async function getTrendingFromSearch() {
    try {
        const response = await axios.get('https://trendlyne.com/stock-screeners/most-popular-stocks/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data);
        const stocks = [];

        $('table tbody tr').slice(0, 8).each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 3) {
                const name = $(cells[0]).text().trim();
                const price = parseFloat($(cells[1]).text().replace(/,/g, '')) || 0;
                if (name && price) {
                    stocks.push({ symbol: name, name, price, pChange: 0, volume: 0 });
                }
            }
        });

        return stocks;
    } catch (err) {
        console.warn('  ⚠️ Trendlyne fallback failed:', err.message);
        return [];
    }
}

// ============================
// FEATURE 12: IPO Calendar
// ============================
async function getIPOCalendar() {
    console.log('📅 Fetching IPO calendar...');
    try {
        const response = await axios.get('https://www.chittorgarh.com/ipo/ipo-dashboard/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            timeout: 15000,
        });

        const $ = cheerio.load(response.data);
        const ipos = [];

        // Look for IPO tables
        $('table').each((ti, table) => {
            const headerText = $(table).prev('h2, h3, h4, .heading').text().toLowerCase();
            const tableText = $(table).text().toLowerCase();

            if (tableText.includes('open') || tableText.includes('upcoming') || tableText.includes('ipo') || headerText.includes('ipo')) {
                $(table).find('tbody tr').each((i, row) => {
                    const cells = $(row).find('td');
                    if (cells.length >= 3) {
                        const name = $(cells[0]).text().trim();
                        const dates = $(cells[1]).text().trim();
                        const priceRange = $(cells[2]).text().trim();
                        const link = $(cells[0]).find('a').attr('href') || '';

                        if (name && !name.includes('No data') && name.length > 2) {
                            ipos.push({
                                name: name.substring(0, 60),
                                dates: dates.substring(0, 40),
                                priceRange: priceRange.substring(0, 30),
                                link: link.startsWith('http') ? link : (link ? `https://www.chittorgarh.com${link}` : ''),
                                status: tableText.includes('open') ? 'Open' : 'Upcoming',
                            });
                        }
                    }
                });
            }
        });

        console.log(`✅ IPOs: ${ipos.length} found`);
        return ipos.slice(0, 8);
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
        const response = await axios.get('https://www.moneycontrol.com/markets/earnings/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            timeout: 15000,
        });

        const $ = cheerio.load(response.data);
        const earnings = [];

        $('table').each((ti, table) => {
            const text = $(table).text().toLowerCase();
            if (text.includes('company') && (text.includes('result') || text.includes('earning') || text.includes('date'))) {
                $(table).find('tbody tr').slice(0, 10).each((i, row) => {
                    const cells = $(row).find('td');
                    if (cells.length >= 2) {
                        const company = $(cells[0]).text().trim();
                        const date = $(cells[1]).text().trim();
                        const link = $(cells[0]).find('a').attr('href') || '';

                        if (company && company.length > 2) {
                            earnings.push({
                                company: company.substring(0, 50),
                                date: date.substring(0, 30),
                                link: link.startsWith('http') ? link : (link ? `https://www.moneycontrol.com${link}` : ''),
                            });
                        }
                    }
                });
            }
        });

        // If moneycontrol fails, try Trendlyne
        if (earnings.length === 0) {
            return await getEarningsFromTrendlyne();
        }

        console.log(`✅ Earnings: ${earnings.length} companies`);
        return earnings.slice(0, 8);
    } catch (error) {
        console.warn('⚠️ Earnings error:', error.message);
        return await getEarningsFromTrendlyne();
    }
}

async function getEarningsFromTrendlyne() {
    try {
        const response = await axios.get('https://trendlyne.com/equity/results-calendar/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data);
        const earnings = [];

        $('table tbody tr').slice(0, 8).each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const company = $(cells[0]).text().trim();
                const date = $(cells[1]).text().trim();
                if (company && company.length > 2) {
                    earnings.push({
                        company: company.substring(0, 50),
                        date: date.substring(0, 30),
                        link: '',
                    });
                }
            }
        });

        console.log(`✅ Earnings (Trendlyne): ${earnings.length} companies`);
        return earnings;
    } catch (err) {
        console.warn('  ⚠️ Trendlyne earnings failed:', err.message);
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
