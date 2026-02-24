const axios = require('axios');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getFIIDIIData() {
    console.log('📊 Fetching FII/DII data...');

    const strategies = [
        fetchFromStockEdge,
        fetchFromNSE,
    ];

    for (const strategy of strategies) {
        try {
            const result = await strategy();
            if (result && (Math.abs(result.fii.netValue) > 0 || Math.abs(result.dii.netValue) > 0)) {
                console.log(`✅ FII/DII data fetched (source: ${result.source})`);
                return result;
            }
        } catch (error) {
            console.warn(`⚠️ FII/DII strategy failed: ${error.message}`);
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

// Strategy 1: StockEdge API — returns net values for FII/DII cash market
async function fetchFromStockEdge() {
    console.log('  🔄 Trying StockEdge API...');

    const response = await axios.get(
        'https://api.stockedge.com/Api/FIIDashboardApi/GetLatestFIIActivities?lang=en',
        {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://web.stockedge.com/',
                'Origin': 'https://web.stockedge.com',
            },
            timeout: 15000,
        }
    );

    const data = response.data;
    if (!Array.isArray(data) || data.length === 0) throw new Error('StockEdge: empty response');

    // Get the most recent entry (first in the array)
    const latest = data[0];
    const dateRaw = latest.Date; // e.g. "2026-02-23T00:00:00"
    const dateObj = new Date(dateRaw);
    const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const result = {
        date: dateStr,
        fii: { buyValue: 0, sellValue: 0, netValue: 0 },
        dii: { buyValue: 0, sellValue: 0, netValue: 0 },
        source: 'StockEdge',
    };

    // FIIDIIData is an array of { Name, ShortName, Value }
    // "FII Cash Market*" → FII net
    // "DII Cash Market*" → DII net
    // Note: StockEdge only provides net values (not buy/sell breakdown)
    for (const item of (latest.FIIDIIData || [])) {
        const name = (item.Name || item.ShortName || '').toUpperCase();
        const value = parseFloat(item.Value) || 0;

        if (name.includes('FII CASH') || name.includes('FII CM')) {
            result.fii.netValue = value;
            // Estimate buy/sell: if net positive, bought more than sold
            // We'll leave buy/sell as 0 since only net is available
        } else if (name.includes('DII CASH') || name.includes('DII CM')) {
            result.dii.netValue = value;
        }
    }

    return result;
}

// Strategy 2: NSE India API (works from cloud IPs, may fail on residential IPs)
async function fetchFromNSE() {
    console.log('  🔄 Trying NSE India...');

    const client = axios.create({ timeout: 20000 });
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
    await sleep(1500);

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
