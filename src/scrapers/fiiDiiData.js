const axios = require('axios');
const cheerio = require('cheerio');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getFIIDIIData() {
    console.log('📊 Fetching FII/DII data...');

    const strategies = [
        { name: 'StockEdge', fn: fetchFromStockEdge },
        { name: 'MoneyControl', fn: fetchFromMoneyControl },
        { name: 'NSE', fn: fetchFromNSE },
    ];

    for (const strategy of strategies) {
        try {
            const result = await strategy.fn();
            if (result && (Math.abs(result.fii.netValue) > 0 || Math.abs(result.dii.netValue) > 0)) {
                console.log(`✅ FII/DII data fetched (source: ${result.source})`);
                return result;
            }
            console.warn(`⚠️ ${strategy.name}: returned zero values, trying next...`);
        } catch (error) {
            console.warn(`⚠️ ${strategy.name} failed: ${error.message}`);
        }
    }

    console.log('⚠️ FII/DII data unavailable from all sources');
    return {
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        fii: { buyValue: 0, sellValue: 0, netValue: 0 },
        dii: { buyValue: 0, sellValue: 0, netValue: 0 },
        note: 'Data unavailable',
    };
}

// Strategy 1: StockEdge API — with retry logic
async function fetchFromStockEdge() {
    console.log('  🔄 Trying StockEdge API...');

    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 1) {
                console.log(`  🔄 StockEdge retry ${attempt}/${MAX_RETRIES}...`);
                await sleep(2000 * attempt); // increasing delay
            }

            const response = await axios.get(
                'https://api.stockedge.com/Api/FIIDashboardApi/GetLatestFIIActivities?lang=en',
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Referer': 'https://web.stockedge.com/',
                        'Origin': 'https://web.stockedge.com',
                    },
                    timeout: 20000,
                }
            );

            const data = response.data;
            if (!Array.isArray(data) || data.length === 0) throw new Error('StockEdge: empty response');

            const latest = data[0];
            const dateRaw = latest.Date;
            const dateObj = new Date(dateRaw);
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

            const result = {
                date: dateStr,
                fii: { buyValue: 0, sellValue: 0, netValue: 0 },
                dii: { buyValue: 0, sellValue: 0, netValue: 0 },
                source: 'StockEdge',
            };

            for (const item of (latest.FIIDIIData || [])) {
                const name = (item.Name || item.ShortName || '').toUpperCase();
                const value = parseFloat(item.Value) || 0;

                if (name.includes('FII CASH') || name.includes('FII CM')) {
                    result.fii.netValue = value;
                } else if (name.includes('DII CASH') || name.includes('DII CM')) {
                    result.dii.netValue = value;
                }
            }

            return result;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

// Strategy 2: MoneyControl — scrape FII/DII page
async function fetchFromMoneyControl() {
    console.log('  🔄 Trying MoneyControl...');

    const response = await axios.get(
        'https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php',
        {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 20000,
        }
    );

    const $ = cheerio.load(response.data);

    const result = {
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        fii: { buyValue: 0, sellValue: 0, netValue: 0 },
        dii: { buyValue: 0, sellValue: 0, netValue: 0 },
        source: 'MoneyControl',
    };

    // MoneyControl displays FII/DII data in tables
    // Look for tables with FII and DII data
    $('table').each((_, table) => {
        const rows = $(table).find('tr');
        rows.each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 4) {
                const category = $(cells[0]).text().trim().toUpperCase();
                const buyVal = parseFloat($(cells[1]).text().replace(/,/g, '')) || 0;
                const sellVal = parseFloat($(cells[2]).text().replace(/,/g, '')) || 0;
                const netVal = parseFloat($(cells[3]).text().replace(/,/g, '')) || 0;

                if (category.includes('FII') || category.includes('FPI') || category.includes('FOREIGN')) {
                    result.fii = { buyValue: buyVal, sellValue: sellVal, netValue: netVal };
                } else if (category.includes('DII') || category.includes('DOMESTIC')) {
                    result.dii = { buyValue: buyVal, sellValue: sellVal, netValue: netVal };
                }
            }
        });
    });

    // Also try parsing from specific data patterns MoneyControl uses
    const pageText = response.data;
    if (result.fii.netValue === 0 && result.dii.netValue === 0) {
        // Try parsing from inline data/scripts
        const fiiMatch = pageText.match(/FII[^}]*?Net[^:]*?[:=]\s*([-\d,.]+)/i);
        const diiMatch = pageText.match(/DII[^}]*?Net[^:]*?[:=]\s*([-\d,.]+)/i);
        if (fiiMatch) result.fii.netValue = parseFloat(fiiMatch[1].replace(/,/g, '')) || 0;
        if (diiMatch) result.dii.netValue = parseFloat(diiMatch[1].replace(/,/g, '')) || 0;
    }

    // Extract date if available
    const dateMatch = pageText.match(/(\d{1,2}[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]\d{4})/i);
    if (dateMatch) result.date = dateMatch[1];

    return result;
}

// Strategy 3: NSE India API (may fail from cloud IPs)
async function fetchFromNSE() {
    console.log('  🔄 Trying NSE India...');

    const client = axios.create({ timeout: 20000 });
    const headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
    };

    // Get session cookies from homepage
    const homeResp = await client.get('https://www.nseindia.com/', {
        headers: { ...headers, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
    });

    const rawCookies = homeResp.headers['set-cookie'] || [];
    if (!rawCookies.length) throw new Error('NSE: no cookies received');

    const cookieStr = rawCookies.map(c => c.split(';')[0]).join('; ');
    await sleep(2000);

    // Fetch FII/DII data
    const apiResp = await client.get('https://www.nseindia.com/api/fiidiiTradeReact', {
        headers: {
            ...headers,
            Accept: 'application/json',
            Referer: 'https://www.nseindia.com/reports-indices-current-index',
            Cookie: cookieStr,
        },
    });

    const data = apiResp.data;
    if (!Array.isArray(data) || data.length === 0) throw new Error('NSE: empty response');

    const result = {
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        fii: { buyValue: 0, sellValue: 0, netValue: 0 },
        dii: { buyValue: 0, sellValue: 0, netValue: 0 },
        source: 'NSE India',
    };

    for (const entry of data) {
        const category = (entry.category || '').toUpperCase();
        if (category.includes('FII') || category.includes('FPI')) {
            result.fii = {
                buyValue: parseFloat(entry.buyValue) || 0,
                sellValue: parseFloat(entry.sellValue) || 0,
                netValue: parseFloat(entry.netValue) || 0,
            };
            if (entry.date) result.date = entry.date;
        } else if (category.includes('DII')) {
            result.dii = {
                buyValue: parseFloat(entry.buyValue) || 0,
                sellValue: parseFloat(entry.sellValue) || 0,
                netValue: parseFloat(entry.netValue) || 0,
            };
        }
    }

    return result;
}

module.exports = { getFIIDIIData };
