// --- Configuration ---
const WEBSOCKET_URL = "wss://api.hyperliquid.xyz/ws";
let currentLogCoin = "ETH";
const L2_LOG_INTERVAL_MS = 5 * 60 * 1000;
const KEY_TICKERS = ["BTC", "ETH", "SOL"];
const SUBSCRIBE_DELAY_MS = 200; // Added delay before sending subscriptions

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
function formatLargeNumber(num) { /* ... no changes ... */ }
function formatFundingRate(rate) { /* ... no changes ... */ }
function formatTimestamp(timestamp) { /* ... no changes ... */ }
function formatPercent(num) { /* ... no changes ... */ }

// --- Overview Display Logic ---
function updateOverviewDisplay() { /* ... no changes ... */ }
function renderList(listElement, data, formatter, titleOverride = null, placeholder = "No Data Available") { /* ... no changes ... */ }

// --- Raw Log Display Logic ---
function addMessageToLog(rawMessageData, messageType = 'log-other') { /* ... no changes ... */ }
function scrollToBottomIfNeeded() { /* ... no changes ... */ }

// --- Key Ticker Update Logic ---
function updateTickerDisplay(coin, data) { /* ... no changes ... */ }

// --- WebSocket Connection & Subscription ---
function subscribeToLogCoin(coin) { /* ... no changes ... */ }
function unsubscribeFromLogCoin(coin) { /* ... no changes ... */ }

function connectWebSocket() {
    console.log("[WS] Attempting Connection...");
    // ... (Reset variables, set initial placeholders) ...
    statusDiv.textContent = "Connecting...";
    statusDiv.className = 'status connecting';
    // ... (Reset HTML placeholders) ...
    // ... (Clear intervals, reset data stores) ...
    lastL2LogTime = 0; // Important to reset

    try { socket = new WebSocket(WEBSOCKET_URL); }
    catch (e) { /* ... error handling ... */ return; }

    socket.addEventListener('open', function (event) {
        console.log('[WS] Connection Opened.');
        statusDiv.textContent = "Connected! Subscribing..."; // Initial status
        statusDiv.className = 'status connected';

        // --- *** ADDED DELAY FOR SUBSCRIPTIONS *** ---
        console.log(`[WS] Waiting ${SUBSCRIBE_DELAY_MS}ms before sending subscriptions...`);
        setTimeout(() => {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                 console.warn("[WS] WebSocket closed before subscriptions could be sent.");
                 return;
            }
            console.log("[WS] Sending subscriptions now...");

            // Subscribe to overview data
            const overviewSubscription = { method: "subscribe", subscription: { type: "webData2" }};
            try { socket.send(JSON.stringify(overviewSubscription)); console.log("[WS] Sent overview subscribe"); }
            catch (e) { console.error("[WS] Error sending overview subscribe:", e); }

            // Subscribe to initial log coin
            subscribeToLogCoin(currentLogCoin); // This function already has try/catch

            // Subscribe to Key Tickers
            KEY_TICKERS.forEach(coin => {
                const tickerSubscription = { method: "subscribe", subscription: { type: "ticker", coin: coin }};
                 try { socket.send(JSON.stringify(tickerSubscription)); console.log(`[WS] Sent ticker subscribe for ${coin}`); }
                 catch (e) { console.error(`[WS] Error sending ticker subscribe for ${coin}:`, e); }
            });

             // Update status after attempting subscriptions
             statusDiv.textContent = "Connected / Subscribed";

        }, SUBSCRIBE_DELAY_MS); // Wait before sending

        // Start checking if overview data arrived (Keep this outside the timeout)
        if (overviewUpdateInterval) clearInterval(overviewUpdateInterval); // Clear old interval just in case
        overviewUpdateInterval = setInterval(checkOverviewDataReceived, 7000);
    });

    socket.addEventListener('message', function (event) {
        try {
            const messageData = JSON.parse(event.data);

            // --- DEBUG LOGGING (Keep this active) ---
             console.log(`[WS DEBUG] Raw Msg Received - Channel: ${messageData.channel || 'N/A'}, DataKeys: ${messageData.data ? Object.keys(messageData.data).join(', ') : 'N/A'}`);
            // ---------------------------------------

            // --- webData2 Processing ---
            if (messageData.channel === 'webData2' && messageData.data) {
                 // console.log("[WS] Received webData2 Structure:", JSON.stringify(messageData.data, null, 2)); // Keep this commented unless needed
                 if (Array.isArray(messageData.data.assetCtxs)) {
                     let updatedCount = 0;
                     messageData.data.assetCtxs.forEach(ctx => {
                         if (ctx && ctx.name) {
                            assetContexts[ctx.name] = ctx; updatedCount++;
                         } else { console.warn("[WS] Skipping asset context missing 'name':", ctx); }
                     });
                     if (updatedCount > 0) {
                          console.log(`[WS] Processed ${updatedCount} asset contexts.`);
                          updateOverviewDisplay();
                     }
                 } else { /* ... error handling ... */ }
            }
            // --- Ticker Processing ---
            else if (messageData.channel === 'ticker' && messageData.data) {
                const coin = messageData.data.coin;
                if (KEY_TICKERS.includes(coin)) {
                    tickerData[coin] = messageData.data;
                    updateTickerDisplay(coin, messageData.data);
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
            // --- ERROR Channel --- Added Explicit Handling
            else if (messageData.channel === 'error') {
                 console.error("[WS Server Error Received]:", messageData.data);
                 // Display error in status?
                 statusDiv.textContent = `Server Error: ${messageData.data.substring(0, 60)}...`;
                 statusDiv.className = 'status error';
            }

        } catch (e) { /* ... error handling ... */ }
    });

    socket.addEventListener('error', function (event) {
        console.error('[WS] WebSocket Error Event:', event);
        statusDiv.textContent = "Connection Error! Check console.";
        statusDiv.className = 'status error';
        if (overviewUpdateInterval) clearInterval(overviewUpdateInterval);
    });
    socket.addEventListener('close', function (event) {
        console.log('[WS] Connection Closed.', event.code, event.reason);
        statusDiv.textContent = "Disconnected. Reconnecting...";
        statusDiv.className = 'status disconnected';
        if (overviewUpdateInterval) clearInterval(overviewUpdateInterval);
        socket = null; assetContexts = {}; tickerData = {}; // Clear data
        setTimeout(connectWebSocket, 5000);
    });
}

function checkOverviewDataReceived() { /* ... no changes ... */ }
filterInput.addEventListener('input', function() { /* ... no changes ... */ });
changeCoinBtn.addEventListener('click', function() { /* ... no changes ... */ });

// --- Initial Connection ---
connectWebSocket();
