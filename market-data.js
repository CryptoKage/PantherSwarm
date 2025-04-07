// --- Configuration ---
const WEBSOCKET_URL = "wss://api.hyperliquid.xyz/ws";
let currentLogCoin = "ETH"; // Still needed for display logic, even if not subscribing initially
const L2_LOG_INTERVAL_MS = 5 * 60 * 1000;
const KEY_TICKERS = ["BTC", "ETH", "SOL"]; // Still needed for display logic
const SUBSCRIBE_DELAY_MS = 200;

// --- Get HTML Elements ---
// ... (Keep all getElementById calls) ...
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
KEY_TICKERS.forEach(coin => { /* ... */ });


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
function formatLargeNumber(num) { /* ... */ }
function formatFundingRate(rate) { /* ... */ }
function formatTimestamp(timestamp) { /* ... */ }
function formatPercent(num) { /* ... */ }

// --- Overview Display Logic ---
function updateOverviewDisplay() { /* ... */ }
function renderList(listElement, data, formatter, titleOverride = null, placeholder = "No Data Available") { /* ... */ }

// --- Raw Log Display Logic ---
function addMessageToLog(rawMessageData, messageType = 'log-other') { /* ... */ }
function scrollToBottomIfNeeded() { /* ... */ }

// --- Key Ticker Update Logic ---
function updateTickerDisplay(coin, data) { /* ... */ }

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
function unsubscribeFromLogCoin(coin) { /* ... */ }

function connectWebSocket() {
    console.log("[WS] Attempting Connection...");
    // ... (Reset variables, set initial placeholders) ...
    statusDiv.textContent = "Connecting...";
    statusDiv.className = 'status connecting';
    // ... (Reset HTML placeholders) ...
    // ... (Clear intervals, reset data stores) ...
    lastL2LogTime = 0;

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
            else if (messageData.channel === 'ticker' && messageData.data) { /* ... */ }
            // --- L2Book / Trades Processing --- (Will not trigger)
            else if (messageData.channel === 'l2Book' && messageData.data?.coin === currentLogCoin) { /* ... */ }
            else if (messageData.channel === 'trades' && messageData.data?.coin === currentLogCoin) { /* ... */ }
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

    socket.addEventListener('error', function (event) { /* ... */ });
    socket.addEventListener('close', function (event) { /* ... */ });
}

function checkOverviewDataReceived() { /* ... */ }
filterInput.addEventListener('input', function() { /* ... */ });
changeCoinBtn.addEventListener('click', function() { /* ... (This button won't change subscriptions now) ... */
    // Maybe disable or change behavior in test mode? For now, just log.
    console.log("[Control] Change Log Coin clicked - subscriptions are currently fixed for testing.");
    // Optionally update display or provide feedback
    // const newCoin = coinInput.value.trim().toUpperCase();
    // if(newCoin) dataContainer.innerHTML = `<div class="message log-info" style="text-align: center; padding: 20px;">Subscriptions fixed for testing. Cannot change log coin to ${newCoin} now.</div>`;
});

// --- Initial Connection ---
connectWebSocket();
