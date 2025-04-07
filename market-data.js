// --- Configuration ---
const WEBSOCKET_URL = "wss://api.hyperliquid.xyz/ws";
let currentLogCoin = "ETH"; // Still needed for display logic, even if not subscribing initially
const L2_LOG_INTERVAL_MS = 5 * 60 * 1000;
const KEY_TICKERS = ["BTC", "ETH", "SOL"]; // Still needed for display logic
const SUBSCRIBE_DELAY_MS = 200;

// --- Get HTML Elements ---
const statusDiv = document.getElementById('status');
const dataContainer = document.getElementById('data-container');
const filterInput = document.getElementById('filterInput');
const coinInput = document.getElementById('coinInput');
const changeCoinBtn = document.getElementById('changeCoinBtn');
const fundingPositiveList = document.getElementById('funding-positive-list');
const fundingNegativeList = document.getElementById('funding-negative-list');
const gainersList = document.getElementById('gainers-list');
const losersList = document.getElementById('losers-list');
const oiList = document.getElementById('oi-list');
const volumeList = document.getElementById('volume-list');
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
let tickerData = {};

// --- WebSocket Logic ---
let socket;
let messageCounter = 0;
const MAX_MESSAGES_LOG = 250;

// --- Helper Functions ---
function formatLargeNumber(num) { if (num === null || num === undefined || isNaN(num)) return 'N/A'; num = Number(num); if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B'; if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M'; if (num >= 1e3) return (num / 1e3).toFixed(1) + ' K'; return num.toFixed(0); }
function formatFundingRate(rate) { if (rate === null || rate === undefined || isNaN(rate)) return 'N/A'; return (Number(rate) * 100).toFixed(4) + '%'; }
function formatTimestamp(timestamp) { if (!timestamp) return ''; const date = new Date(timestamp); return date.toLocaleTimeString(); }
function formatPercent(num) { if (num === null || num === undefined || isNaN(num)) return '--%'; return (Number(num) * 100).toFixed(2) + '%'; }

// --- Overview Display Logic ---
function updateOverviewDisplay() { console.log("[Overview] Attempting update. Context keys:", Object.keys(assetContexts).length); lastUpdateTime = new Date(); if (Object.keys(assetContexts).length === 0) { return; } const allCoinsData = Object.entries(assetContexts).map(([coin, ctx]) => { const funding = parseFloat(ctx?.funding); const volume = parseFloat(ctx?.dayNtlVlm); const dailyChange = parseFloat(ctx?.dayChg); return { coin: coin, fundingRate: !isNaN(funding) ? funding : NaN, volume24h: !isNaN(volume) ? volume : NaN, dayChangePercent: !isNaN(dailyChange) ? dailyChange : NaN }; }).filter(d => d.coin && (!isNaN(d.volume24h) && d.volume24h > 0) && !isNaN(d.fundingRate) && !isNaN(d.dayChangePercent)); console.log(`[Overview] Filtered ${allCoinsData.length} valid coins.`); if (allCoinsData.length === 0) { renderList(fundingPositiveList, [], item => ({}), "Top 5 Positive Funding", "No Valid Data"); renderList(fundingNegativeList, [], item => ({}), "Top 5 Negative Funding", "No Valid Data"); renderList(gainersList, [], item => ({}), "Top 5 Gainers (24h)", "No Valid Data"); renderList(losersList, [], item => ({}), "Top 5 Losers (24h)", "No Valid Data"); renderList(oiList, [], item => ({}), "Top 5 Volume (OI Placeholder)", "No Valid Data"); renderList(volumeList, [], item => ({}), "Top 5 Volume (24h USD)", "No Valid Data"); return; } const sortedByFunding = [...allCoinsData].sort((a, b) => b.fundingRate - a.fundingRate); renderList(fundingPositiveList, sortedByFunding.filter(d => d.fundingRate > 0).slice(0, 5), item => ({ coin: item.coin, value: formatFundingRate(item.fundingRate), valueClass: 'positive' }), "Top 5 Positive Funding"); renderList(fundingNegativeList, sortedByFunding.filter(d => d.fundingRate < 0).reverse().slice(0, 5), item => ({ coin: item.coin, value: formatFundingRate(item.fundingRate), valueClass: 'negative' }), "Top 5 Negative Funding"); const sortedByChange = [...allCoinsData].sort((a, b) => b.dayChangePercent - a.dayChangePercent); renderList(gainersList, sortedByChange.slice(0, 5), item => ({ coin: item.coin, value: formatPercent(item.dayChangePercent), valueClass: 'positive' }), "Top 5 Gainers (24h)"); renderList(losersList, sortedByChange.filter(d => d.dayChangePercent < 0).reverse().slice(0, 5), item => ({ coin: item.coin, value: formatPercent(item.dayChangePercent), valueClass: 'negative' }), "Top 5 Losers (24h)"); const sortedByVolume = [...allCoinsData].sort((a, b) => b.volume24h - a.volume24h); renderList(volumeList, sortedByVolume.slice(0, 5), item => ({ coin: item.coin, value: '$' + formatLargeNumber(item.volume24h) }), "Top 5 Volume (24h USD)"); renderList(oiList, sortedByVolume.slice(0, 5), item => ({ coin: item.coin, value: '$' + formatLargeNumber(item.volume24h) }), "Top 5 Volume (OI Placeholder)"); }
function renderList(listElement, data, formatter, titleOverride = null, placeholder = "No Data Available") { if (!listElement) return; const gridTitleElement = listElement.closest('.overview-grid')?.querySelector('h3'); if (gridTitleElement && titleOverride) { gridTitleElement.textContent = titleOverride; } if (!data || data.length === 0) { listElement.innerHTML = `<li class="placeholder">${placeholder}</li>`; return; } listElement.innerHTML = data.map(item => { const formatted = formatter(item); return `<li><span class="coin">${formatted.coin || 'N/A'}</span><span class="value ${formatted.valueClass || ''}">${formatted.value || 'N/A'}</span></li>`; }).join(''); }

// --- Raw Log Display Logic ---
function addMessageToLog(rawMessageData, messageType = 'log-other') { if (messageType === 'log-l2') { const now = Date.now(); if (now - lastL2LogTime < L2_LOG_INTERVAL_MS) { return; } lastL2LogTime = now; console.log(`[Log] Displaying L2 update for ${currentLogCoin} after interval.`); } if (messageCounter === 0 && dataContainer.querySelector('.log-info')) { dataContainer.innerHTML = ''; } messageCounter++; if (messageCounter > MAX_MESSAGES_LOG + 1) { if (messageCounter === MAX_MESSAGES_LOG + 2) { console.warn(`[Log] Suppressing further UI updates after ${MAX_MESSAGES_LOG} messages.`); const noticeElement = document.createElement('div'); noticeElement.textContent = `--- Log UI updates paused (check console) ---`; noticeElement.className = 'message log-info'; dataContainer.appendChild(noticeElement); scrollToBottomIfNeeded(); } console.log('[Log Suppressed] Raw:', rawMessageData); return; } const messageElement = document.createElement('div'); messageElement.classList.add('message', messageType); let formattedContent = ''; try { const jsonData = JSON.parse(rawMessageData); if (messageType === 'log-trade' && Array.isArray(jsonData.data)) { formattedContent = jsonData.data.map(trade => `TRADE [${formatTimestamp(trade.time)}] ${trade.side === 'B' ? '<span class="side-B">BUY</span>' : '<span class="side-S">SELL</span>'} ${trade.sz} ${jsonData.data.coin || currentLogCoin} @ ${trade.px} (Liq: ${trade.liquidation ? 'Y' : 'N'})`).join('<br>'); } else if (messageType === 'log-l2' && jsonData.data?.levels) { formattedContent = `L2 SUMMARY [${formatTimestamp(jsonData.data.time)}] ${jsonData.data.coin || currentLogCoin} - Bids: ${jsonData.data.levels[0]?.length || 0}, Asks: ${jsonData.data.levels[1]?.length || 0}`; messageElement.classList.add('log-separator'); } else { formattedContent = `<pre>${JSON.stringify(jsonData, null, 2)}</pre>`; messageElement.classList.add('log-separator'); } } catch (e) { formattedContent = rawMessageData; messageElement.classList.replace('log-other', 'log-info'); } messageElement.innerHTML = formattedContent; const filterValue = filterInput.value.toLowerCase(); if (filterValue && !messageElement.textContent.toLowerCase().includes(filterValue)) { messageElement.classList.add('hidden'); } dataContainer.appendChild(messageElement); scrollToBottomIfNeeded(); }
function scrollToBottomIfNeeded() { const isScrolledToBottom = dataContainer.scrollHeight - dataContainer.clientHeight <= dataContainer.scrollTop + 60; if (isScrolledToBottom) { dataContainer.scrollTop = dataContainer.scrollHeight; } }

// --- Key Ticker Update Logic ---
function updateTickerDisplay(coin, data) { if (!tickerElements[coin] || !tickerElements[coin].container) return; const priceEl = tickerElements[coin].price; const changeEl = tickerElements[coin].change; if (priceEl && data.markPx != null) { priceEl.textContent = '$' + parseFloat(data.markPx).toFixed(2); } if (changeEl && data.dayChg != null) { const change = parseFloat(data.dayChg); changeEl.textContent = formatPercent(change); changeEl.className = 'change ' + (change >= 0 ? 'positive' : 'negative'); } }

// --- WebSocket Connection & Subscription ---
// NOTE: These functions still exist but might not be called if we comment out the calls
function subscribeToLogCoin(coin) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    console.log(`[WS] Subscribing log channels for ${coin}...`);
    const subscriptions = [ { type: "l2Book", coin: coin }, { type: "trades", coin: coin } ];
    subscriptions.forEach(sub => {
        const message = { method: "subscribe", subscription: sub };
        try { socket.send(JSON.stringify(message)); console.log("[WS] Sent log subscribe:", message); }
        catch (e) { console.error("[WS] Error sending log subscribe:", e); }
    });
}
function unsubscribeFromLogCoin(coin) { if (!socket || socket.readyState !== WebSocket.OPEN) return; console.log(`[WS] Unsubscribing log channels for ${coin}...`); const subscriptions = [ { type: "l2Book", coin: coin }, { type: "trades", coin: coin } ]; subscriptions.forEach(sub => { const message = { method: "unsubscribe", subscription: sub }; try { socket.send(JSON.stringify(message)); console.log("[WS] Sent log unsubscribe:", message); } catch (e) { console.error("[WS] Error sending log unsubscribe:", e); } }); }

function connectWebSocket() {
    console.log("[WS] Attempting Connection...");
    statusDiv.textContent = "Connecting...";
    statusDiv.className = 'status connecting';
    dataContainer.innerHTML = '<div class="message log-info" style="text-align: center; padding: 20px;">Connecting...</div>';
    messageCounter = 0; coinInput.value = currentLogCoin;
    assetContexts = {}; lastUpdateTime = null; lastL2LogTime = 0; tickerData = {};
    if (overviewUpdateInterval) clearInterval(overviewUpdateInterval);
    const listsToReset = [fundingPositiveList, fundingNegativeList, gainersList, losersList, oiList, volumeList];
    listsToReset.forEach(list => renderList(list, [], item => ({}), null, "Loading..."));
    Object.values(tickerElements).forEach(el => { if (el.price) el.price.textContent = 'Loading...'; if (el.change) { el.change.textContent = '--%'; el.change.className = 'change'; } });

    try { socket = new WebSocket(WEBSOCKET_URL); }
    catch (e) { console.error("[WS] WebSocket creation failed:", e); statusDiv.textContent = "WebSocket Creation Failed!"; statusDiv.className = 'status error'; return; }

    socket.addEventListener('open', function (event) {
        console.log('[WS] Connection Opened.');
        statusDiv.textContent = "Connected! Subscribing (TEST MODE)..."; // Updated status
        statusDiv.className = 'status connected';

        console.log(`[WS] Waiting ${SUBSCRIBE_DELAY_MS}ms before sending subscriptions...`);
        setTimeout(() => {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                 console.warn("[WS] WebSocket closed before subscriptions could be sent.");
                 return;
            }
            console.log("[WS] Sending ONLY webData2 subscription for testing...");

            // *** === ISOLATION TEST === ***
            // Subscribe ONLY to overview data
            const overviewSubscription = { method: "subscribe", subscription: { type: "webData2" }};
            try {
                 socket.send(JSON.stringify(overviewSubscription));
                 console.log("[WS] Sent ONLY overview (webData2) subscribe");
            }
            catch (e) { console.error("[WS] Error sending overview subscribe:", e); }

            // --- Temporarily Commented Out ---
            /*
            // Subscribe to initial log coin
            // subscribeToLogCoin(currentLogCoin);

            // Subscribe to Key Tickers
            // KEY_TICKERS.forEach(coin => {
            //     const tickerSubscription = { method: "subscribe", subscription: { type: "ticker", coin: coin }};
            //      try { socket.send(JSON.stringify(tickerSubscription)); console.log(`[WS] Sent ticker subscribe for ${coin}`); }
            //      catch (e) { console.error(`[WS] Error sending ticker subscribe for ${coin}:`, e); }
            // });
            */
            // --- End Commented Out ---

             // Update status after attempting subscriptions
             statusDiv.textContent = "Connected / Subscribed (webData2 Only)";

        }, SUBSCRIBE_DELAY_MS);

        // Start checking if overview data arrived
        if (overviewUpdateInterval) clearInterval(overviewUpdateInterval);
        overviewUpdateInterval = setInterval(checkOverviewDataReceived, 7000);
    });

    socket.addEventListener('message', function (event) {
        try {
            const messageData = JSON.parse(event.data);

            console.log(`[WS DEBUG] Raw Msg Received - Channel: ${messageData.channel || 'N/A'}, DataKeys: ${messageData.data ? Object.keys(messageData.data).join(', ') : 'N/A'}`);

            // --- webData2 Processing ---
            if (messageData.channel === 'webData2' && messageData.data) {
                 console.log("[WS] !!! Received webData2 message successfully !!!");
                 // console.log("[WS] Received webData2 Structure:", JSON.stringify(messageData.data, null, 2));
                 if (Array.isArray(messageData.data.assetCtxs)) {
                     let updatedCount = 0;
                     messageData.data.assetCtxs.forEach(ctx => {
                         if (ctx && ctx.name) { assetContexts[ctx.name] = ctx; updatedCount++; }
                         else { console.warn("[WS] Skipping asset context missing 'name':", ctx); }
                     });
                     if (updatedCount > 0) { updateOverviewDisplay(); }
                 } else { console.error("[WS] webData2 received, but 'assetCtxs' is NOT an array:", messageData.data); /* ... */ }
            }
            // --- Ticker Processing --- (Will not trigger as we didn't subscribe)
            else if (messageData.channel === 'ticker' && messageData.data) { /* This block should not be reached */ console.warn("[WS] Unexpected 'ticker' message received in isolation test mode.");}
            // --- L2Book / Trades Processing --- (Will not trigger)
            else if (messageData.channel === 'l2Book' && messageData.data?.coin === currentLogCoin) { /* This block should not be reached */ console.warn("[WS] Unexpected 'l2Book' message received in isolation test mode.");}
            else if (messageData.channel === 'trades' && messageData.data?.coin === currentLogCoin) { /* This block should not be reached */ console.warn("[WS] Unexpected 'trades' message received in isolation test mode.");}
            // --- ERROR Channel ---
            else if (messageData.channel === 'error') {
                 console.error("[WS Server Error Received]:", messageData.data);
                 // Specifically check if the error is about webData2
                 if (messageData.data.includes('webData2')) {
                    statusDiv.textContent = `Server Error Subscribing (webData2): ${messageData.data.substring(0, 40)}...`;
                 } else {
                    statusDiv.textContent = `Server Error: ${messageData.data.substring(0, 60)}...`;
                 }
                 statusDiv.className = 'status error';
            }

        } catch (e) { console.error('[WS] Error processing message:', e, 'Raw data:', event.data); }
    });

    socket.addEventListener('error', function (event) { console.error('[WS] WebSocket Error Event:', event); statusDiv.textContent = "Connection Error! Check console."; statusDiv.className = 'status error'; if (overviewUpdateInterval) clearInterval(overviewUpdateInterval); });
    socket.addEventListener('close', function (event) { console.log('[WS] Connection Closed.', event.code, event.reason); statusDiv.textContent = "Disconnected. Reconnecting..."; statusDiv.className = 'status disconnected'; if (overviewUpdateInterval) clearInterval(overviewUpdateInterval); socket = null; assetContexts = {}; tickerData = {}; setTimeout(connectWebSocket, 5000); });
}

function checkOverviewDataReceived() { if (!lastUpdateTime && socket?.readyState === WebSocket.OPEN) { console.warn("[Check] No overview data received yet. Still connected."); renderList(fundingPositiveList, [], item => ({}), "Top 5 Positive Funding", "Waiting for data..."); renderList(fundingNegativeList, [], item => ({}), "Top 5 Negative Funding", "Waiting for data..."); renderList(gainersList, [], item => ({}), "Top 5 Gainers (24h)", "Waiting for data..."); renderList(losersList, [], item => ({}), "Top 5 Losers (24h)", "Waiting for data..."); renderList(oiList, [], item => ({}), "Top 5 Volume (OI Placeholder)", "Waiting for data..."); renderList(volumeList, [], item => ({}), "Top 5 Volume (24h USD)", "Waiting for data..."); } else { if (overviewUpdateInterval) clearInterval(overviewUpdateInterval); } }
filterInput.addEventListener('input', function() { const filterValue = filterInput.value.toLowerCase(); const messages = dataContainer.querySelectorAll('.message'); messages.forEach(messageDiv => { const messageText = messageDiv.textContent.toLowerCase(); if (messageText.includes(filterValue)) { messageDiv.classList.remove('hidden'); } else { messageDiv.classList.add('hidden'); } }); });
changeCoinBtn.addEventListener('click', function() { console.log("[Control] Change Log Coin clicked - subscriptions are currently fixed for testing."); /* Optionally add UI feedback */ });

// --- Initial Connection ---
connectWebSocket();
