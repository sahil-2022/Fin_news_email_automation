const axios = require('axios');
const cheerio = require('cheerio');

async function getFIIDIIData() {
    console.log('📊 Fetching FII/DII data...');

    const strategies = [
        fetchFromTrendlyne,
        fetchFromMoneyControl,
        fetchFromNSEDirect,
    ];

    for (const strategy of strategies) {
        try {
            const result = await strategy();
            if (result && (result.fii.buyValue > 0 || result.dii.buyValue > 0)) {
                console.log('✅ FII/DII data fetched successfully');
                return result;
            }
        } catch (error) {
            console.warn(`⚠️ FII/DII strategy failed: ${error.message}`);
        }
    }

    console.log('⚠️ FII/DII data unavailable (market may be closed)');
    return {
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        fii: { buyValue: 0, sellValue: 0, netValue: 0 },
        dii: { buyValue: 0, sellValue: 0, netValue: 0 },
        note: 'Data unavailable — market closed today',
    };
}

// Strategy 1: Trendlyne (most reliable for FII/DII)
async function fetchFromTrendlyne() {
    console.log('  🔄 Trying Trendlyne...');

    const response = await axios.get('https://trendlyne.com/equity/fiidii/', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const result = {
        date: '',
        fii: { buyValue: 0, sellValue: 0, netValue: 0 },
        dii: { buyValue: 0, sellValue: 0, netValue: 0 },
    };

    // Search for FII/DII data in tables and structured elements
    const allText = $('body').text();

    // Try to extract date
    const datePatterns = [
        /(\d{1,2}\s+\w{3}\s+\d{4})/,
        /(\d{1,2}[-\/]\w{3}[-\/]\d{4})/,
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/,
    ];
    for (const pattern of datePatterns) {
        const match = allText.match(pattern);
        if (match) {
            result.date = match[1];
            break;
        }
    }

    // Parse table rows for FII/DII values
    $('table tr, .table-row, [class*="fii"], [class*="dii"]').each((i, el) => {
        const rowText = $(el).text().toUpperCase();
        const numbers = $(el).find('td, .cell, span').map((j, cell) => {
            const text = $(cell).text().trim().replace(/,/g, '').replace(/[₹\s]/g, '');
            const num = parseFloat(text);
            return isNaN(num) ? null : num;
        }).get().filter(n => n !== null);

        if (numbers.length >= 3) {
            if (rowText.includes('FII') || rowText.includes('FPI') || rowText.includes('FOREIGN')) {
                result.fii.buyValue = numbers[0];
                result.fii.sellValue = numbers[1];
                result.fii.netValue = numbers[2];
            } else if (rowText.includes('DII') || rowText.includes('DOMESTIC')) {
                result.dii.buyValue = numbers[0];
                result.dii.sellValue = numbers[1];
                result.dii.netValue = numbers[2];
            }
        }
    });

    if (!result.date) {
        result.date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    return result;
}

// Strategy 2: MoneyControl
async function fetchFromMoneyControl() {
    console.log('  🔄 Trying MoneyControl...');

    const response = await axios.get('https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html',
        },
        timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const result = {
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        fii: { buyValue: 0, sellValue: 0, netValue: 0 },
        dii: { buyValue: 0, sellValue: 0, netValue: 0 },
    };

    $('table').each((i, table) => {
        const text = $(table).text().toLowerCase();
        if (text.includes('fii') || text.includes('dii') || text.includes('fpi')) {
            $(table).find('tr').each((j, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 4) {
                    const category = $(cells[0]).text().trim().toUpperCase();
                    const val1 = parseFloat($(cells[1]).text().replace(/,/g, '')) || 0;
                    const val2 = parseFloat($(cells[2]).text().replace(/,/g, '')) || 0;
                    const val3 = parseFloat($(cells[3]).text().replace(/,/g, '')) || 0;

                    if (category.includes('FII') || category.includes('FPI')) {
                        result.fii = { buyValue: val1, sellValue: val2, netValue: val3 };
                    } else if (category.includes('DII')) {
                        result.dii = { buyValue: val1, sellValue: val2, netValue: val3 };
                    }
                }
            });
        }
    });

    const dateMatch = $('body').text().match(/(\d{1,2}[-\/]\w{3}[-\/]\d{4})/);
    if (dateMatch) result.date = dateMatch[1];

    return result;
}

// Strategy 3: NSE Direct API
async function fetchFromNSEDirect() {
    console.log('  🔄 Trying NSE India...');

    const mainPage = await axios.get('https://www.nseindia.com/', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html',
        },
        timeout: 10000,
    });

    const cookies = mainPage.headers['set-cookie'];
    const cookieStr = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

    const response = await axios.get('https://www.nseindia.com/api/fiidiiTradeReact', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.nseindia.com/',
            'Cookie': cookieStr,
        },
        timeout: 10000,
    });

    const data = response.data;
    const result = {
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        fii: { buyValue: 0, sellValue: 0, netValue: 0 },
        dii: { buyValue: 0, sellValue: 0, netValue: 0 },
    };

    if (Array.isArray(data)) {
        for (const entry of data) {
            const category = entry.category?.toUpperCase() || '';
            if (category.includes('FII') || category.includes('FPI')) {
                result.fii = {
                    buyValue: parseFloat(entry.buyValue) || 0,
                    sellValue: parseFloat(entry.sellValue) || 0,
                    netValue: parseFloat(entry.netValue) || 0,
                };
                result.date = entry.date || result.date;
            } else if (category.includes('DII')) {
                result.dii = {
                    buyValue: parseFloat(entry.buyValue) || 0,
                    sellValue: parseFloat(entry.sellValue) || 0,
                    netValue: parseFloat(entry.netValue) || 0,
                };
            }
        }
    }

    return result;
}

module.exports = { getFIIDIIData };
