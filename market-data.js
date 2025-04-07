// --- Configuration ---
const WEBSOCKET_URL = "wss://api.hyperliquid.xyz/ws";
let currentLogCoin = "ETH";
const L2_LOG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const KEY_TICKERS = ["BTC", "ETH", "SOL"]; // Coins to subscribe to ticker channel for

// --- Get HTML Elements ---
const statusDiv = document.getElementById('status');
const dataContainer = document.getElementById('data-container');
const filterInput = document.getElementById('filterInput');
const coinInput = document.getElementById('coinInput');
const changeCoinBtn = document.getElementById('changeCoinBtn');
// Overview List Elements
const fundingPositiveList = document.getElementById('funding-positive-list');
const fundingNegativeList = document.getElementById('funding-negative-list');
const gainersList = document.getElementById('gainers-list'); // New
const losersList = document.getElementById('losers-list'); // New
const oiList = document.getElementById('oi-list');
const volumeList = document.getElementById('volume-list');
// Key Ticker Elements (Store references for quick updates)
const tickerElements = {};
KEY_TICKERS.forEach(coin => {
    tickerElements[coin] = {
        container: document.getElementById(`ticker-${coin}`),
        price: document.getElementById(`ticker-${coin}`)?.querySelector('.price'),
        change: document.getElementById(`ticker-${coin}`)?.querySelector('.change')
    };
});


// --- Data Storage ---
let assetContexts = {};
let lastUpdateTime = null;
let overviewUpdateInterval;
let lastL2LogTime = 0;
let tickerData = {}; // Store latest { markPx, dayChg } for key tickers

// --- WebSocket Logic ---
let socket;
let messageCounter = 0;
const MAX_MESSAGES_LOG = 250;

// --- Helper Functions ---
function formatLargeNumber(num) { /* ... no changes ... */ }
function formatFundingRate(rate) { /* ... no changes ... */ }
function formatTimestamp(timestamp) { /* ... no changes ... */ }
function formatPercent(num) {
    if (num === null || num === undefined || isNaN(num)) return '--%';
    return (Number(num) * 100).toFixed(2) + '%';
}


// --- Overview Display Logic ---
function updateOverviewDisplay() {
    console.log("[Overview] Attempting update. Context keys:", Object.keys(assetContexts).length);
    lastUpdateTime = new Date();

    if (Object.keys(assetContexts).length === 0) { return; } // Keep loading placeholders

    const allCoinsData = Object.entries(assetContexts).map(([coin, ctx]) => {
        const funding = parseFloat(ctx?.funding);
        const volume = parseFloat(ctx?.dayNtlVlm);
        // *** ASSUMPTION: Using 'dayChg' for 24h change percentage ***
        const dailyChange = parseFloat(ctx?.dayChg);
        return {
            coin: coin,
            fundingRate: !isNaN(funding) ? funding : NaN,
            volume24h: !isNaN(volume) ? volume : NaN,
            dayChangePercent: !isNaN(dailyChange) ? dailyChange : NaN // Store parsed change
        };
        // Filter out coins missing essential data needed for ANY list
    }).filter(d => d.coin && (!isNaN(d.volume24h) && d.volume24h > 0) && !isNaN(d.fundingRate) && !isNaN(d.dayChangePercent));

    console.log(`[Overview] Filtered ${allCoinsData.length} valid coins.`);

    if (allCoinsData.length === 0) {
         renderList(fundingPositiveList, [], item => ({}), "Top 5 Positive Funding", "No Valid Data");
         renderList(fundingNegativeList, [], item => ({}), "Top 5 Negative Funding", "No Valid Data");
         renderList(gainersList, [], item => ({}), "Top 5 Gainers (24h)", "No Valid Data"); // Update placeholder
         renderList(losersList, [], item => ({}), "Top 5 Losers (24h)", "No Valid Data");   // Update placeholder
         renderList(oiList, [], item => ({}), "Top 5 Volume (OI Placeholder)", "No Valid Data");
         renderList(volumeList, [], item => ({}), "Top 5 Volume (24h USD)", "No Valid Data");
         return;
    }

    // --- Funding Rate ---
    const sortedByFunding = [...allCoinsData].sort((a, b) => b.fundingRate - a.fundingRate);
    renderList(fundingPositiveList, sortedByFunding.filter(d => d.fundingRate > 0).slice(0, 5), item => ({ coin: item.coin, value: formatFundingRate(item.fundingRate), valueClass: 'positive' }), "Top 5 Positive Funding");
    renderList(fundingNegativeList, sortedByFunding.filter(d => d.fundingRate < 0).reverse().slice(0, 5), item => ({ coin: item.coin, value: formatFundingRate(item.fundingRate), valueClass: 'negative' }), "Top 5 Negative Funding");

    // --- Gainers / Losers (Based on dayChangePercent) ---
    const sortedByChange = [...allCoinsData].sort((a, b) => b.dayChangePercent - a.dayChangePercent); // Highest change first
    renderList(gainersList, sortedByChange.slice(0, 5), item => ({ coin: item.coin, value: formatPercent(item.dayChangePercent), valueClass: 'positive' }), "Top 5 Gainers (24h)");
    renderList(losersList, sortedByChange.filter(d => d.dayChangePercent < 0).reverse().slice(0, 5), item => ({ coin: item.coin, value: formatPercent(item.dayChangePercent), valueClass: 'negative' }), "Top 5 Losers (24h)");


    // --- Volume (24h USD) ---
    const sortedByVolume = [...allCoinsData].sort((a, b) => b.volume24h - a.volume24h);
    renderList(volumeList, sortedByVolume.slice(0, 5), item => ({ coin: item.coin, value: '$' + formatLargeNumber(item.volume24h) }), "Top 5 Volume (24h USD)");
    renderList(oiList, sortedByVolume.slice(0, 5), item => ({ coin: item.coin, value: '$' + formatLargeNumber(item.volume24h) }), "Top 5 Volume (OI Placeholder)"); // Keep OI placeholder using volume sort
}


// Renders data into a specific <ul> list
function renderList(listElement, data, formatter, titleOverride = null, placeholder = "No Data Available") { /* ... no changes ... */ }


// --- Raw Log Display Logic ---
function addMessageToLog(rawMessageData, messageType = 'log-other') { /* ... no changes from previous version ... */ }
function scrollToBottomIfNeeded() { /* ... no changes ... */ }

// --- Key Ticker Update Logic ---
function updateTickerDisplay(coin, data) {
    if (!tickerElements[coin] || !tickerElements[coin].container) return; // Element doesn't exist

    const priceEl = tickerElements[coin].price;
    const changeEl = tickerElements[coin].change;

    if (priceEl && data.markPx != null) { // Use mark price if available
        priceEl.textContent = '$' + parseFloat(data.markPx).toFixed(2); // Format price
    }

    if (changeEl && data.dayChg != null) {
        const change = parseFloat(data.dayChg);
        changeEl.textContent = formatPercent(change);
        changeEl.className = 'change ' + (change >= 0 ? 'positive' : 'negative'); // Set class for color
    }
}


// --- WebSocket Connection & Subscription ---
function subscribeToLogCoin(coin) { /* ... no changes ... */ }
function unsubscribeFromLogCoin(coin) { /* ... no changes ... */ }

function connectWebSocket() {
    console.log("[WS] Attempting Connection...");
    // ... (Reset variables, set initial placeholders including new lists) ...
    statusDiv.textContent = "Connecting...";
    statusDiv.className = 'status connecting';
    dataContainer.innerHTML = '<div class="message log-info" style="text-align: center; padding: 20px;">Connecting...</div>';
    messageCounter = 0; coinInput.value = currentLogCoin;
    assetContexts = {}; lastUpdateTime = null; lastL2LogTime = 0; tickerData = {};
    if (overviewUpdateInterval) clearInterval(overviewUpdateInterval);

    // Reset placeholders
    const listsToReset = [fundingPositiveList, fundingNegativeList, gainersList, losersList, oiList, volumeList];
    listsToReset.forEach(list => renderList(list, [], item => ({}), null, "Loading...")); // Title set in HTML/updateOverview
    Object.values(tickerElements).forEach(el => {
        if (el.price) el.price.textContent = 'Loading...';
        if (el.change) { el.change.textContent = '--%'; el.change.className = 'change'; }
    });


    try { socket = new WebSocket(WEBSOCKET_URL); }
    catch (e) { console.error("[WS] WebSocket creation failed:", e); /* ... */ return; }

    socket.addEventListener('open', function (event) {
        console.log('[WS] Connection Opened.');
        statusDiv.textContent = "Connected! Subscribing...";
        statusDiv.className = 'status connected';

        // Subscribe to overview data
        const overviewSubscription = { method: "subscribe", subscription: { type: "webData2" }};
        try { socket.send(JSON.stringify(overviewSubscription)); console.log("[WS] Sent overview subscribe"); }
        catch (e) { console.error("[WS] Error sending overview subscribe:", e); }

        // Subscribe to initial log coin
        subscribeToLogCoin(currentLogCoin);

        // Subscribe to Key Tickers
        KEY_TICKERS.forEach(coin => {
            const tickerSubscription = { method: "subscribe", subscription: { type: "ticker", coin: coin }};
             try { socket.send(JSON.stringify(tickerSubscription)); console.log(`[WS] Sent ticker subscribe for ${coin}`); }
             catch (e) { console.error(`[WS] Error sending ticker subscribe for ${coin}:`, e); }
        });

        overviewUpdateInterval = setInterval(checkOverviewDataReceived, 7000);
    });

    socket.addEventListener('message', function (event) {
        try {
            const messageData = JSON.parse(event.data);

            // --- webData2 Processing ---
            if (messageData.channel === 'webData2' && messageData.data) {
                 console.log("[WS] Received webData2 (structure log follows):", JSON.stringify(messageData.data, null, 2));
                 if (Array.isArray(messageData.data.assetCtxs)) {
                     // ... (process assetCtxs as before) ...
                     updateOverviewDisplay();
                 } else { /* ... error handling ... */ }
            }
            // --- Ticker Processing ---
            else if (messageData.channel === 'ticker' && messageData.data) {
                const coin = messageData.data.coin;
                if (KEY_TICKERS.includes(coin)) { // Is it one we care about?
                     // Store latest ticker info & update display immediately
                     tickerData[coin] = messageData.data;
                     updateTickerDisplay(coin, messageData.data);
                     // console.log(`[WS] Ticker update for ${coin}:`, messageData.data); // Optional debug
                }
            }
            // --- L2Book Processing ---
            else if (messageData.channel === 'l2Book' && messageData.data?.coin === currentLogCoin) {
                 addMessageToLog(event.data, 'log-l2');
            }
            // --- Trades Processing ---
            else if (messageData.channel === 'trades' && messageData.data?.coin === currentLogCoin) {
                 addMessageToLog(event.data, 'log-trade');
            }

        } catch (e) { /* ... error handling ... */ }
    });

    // ... (error and close listeners remain the same) ...
    socket.addEventListener('error', function (event) { /* ... */ });
    socket.addEventListener('close', function (event) { /* ... */ });
}


// ... (Keep checkOverviewDataReceived function as is) ...
function checkOverviewDataReceived() { /* ... */ }

// --- Event Listeners for Controls ---
filterInput.addEventListener('input', function() { /* ... no changes ... */ });
changeCoinBtn.addEventListener('click', function() { /* ... no changes ... */ });

// --- Initial Connection ---
connectWebSocket();
