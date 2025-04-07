// --- Configuration ---
const WEBSOCKET_URL = "wss://api.hyperliquid.xyz/ws";
let currentLogCoin = "ETH";
const L2_LOG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

// --- Get HTML Elements ---
// ... (Keep all getElementById calls) ...
const statusDiv = document.getElementById('status');
const dataContainer = document.getElementById('data-container');
const filterInput = document.getElementById('filterInput');
const coinInput = document.getElementById('coinInput');
const changeCoinBtn = document.getElementById('changeCoinBtn');
const fundingPositiveList = document.getElementById('funding-positive-list');
const fundingNegativeList = document.getElementById('funding-negative-list');
const oiList = document.getElementById('oi-list');
const volumeList = document.getElementById('volume-list');


// --- Data Storage ---
let assetContexts = {};
let lastUpdateTime = null;
let overviewUpdateInterval;
let lastL2LogTime = 0; // Timestamp of the last L2 message shown in the log

// --- WebSocket Logic ---
let socket;
let messageCounter = 0;
const MAX_MESSAGES_LOG = 250; // Limit total messages shown in log

// --- Helper Functions ---
// ... (Keep formatLargeNumber, formatFundingRate, formatTimestamp) ...
function formatLargeNumber(num) { /* ... no changes ... */ }
function formatFundingRate(rate) { /* ... no changes ... */ }
function formatTimestamp(timestamp) { /* ... no changes ... */ }


// --- Overview Display Logic ---
// ... (Keep updateOverviewDisplay function as is) ...
function updateOverviewDisplay() { /* ... no changes ... */ }

// ... (Keep renderList function as is) ...
function renderList(listElement, data, formatter, titleOverride = null, placeholder = "No Data Available") { /* ... no changes ... */ }


// --- Raw Log Display Logic ---
function addMessageToLog(rawMessageData, messageType = 'log-other') {
     // Special handling for L2 throttling
     if (messageType === 'log-l2') {
         const now = Date.now();
         if (now - lastL2LogTime < L2_LOG_INTERVAL_MS) {
             // console.log("[Log] Throttled L2 update."); // Optional debug log
             return; // Skip adding this L2 update to the log
         }
         // If allowed, update the timestamp
         lastL2LogTime = now;
         console.log(`[Log] Displaying L2 update for ${currentLogCoin} after interval.`);
     }

     // Clear "Waiting..." message on first real log entry (excluding throttled L2)
     if (messageCounter === 0 && dataContainer.querySelector('.log-info')) {
        dataContainer.innerHTML = '';
     }

     messageCounter++;
     if (messageCounter > MAX_MESSAGES_LOG + 1) {
         // ... (Keep MAX_MESSAGES_LOG handling as is) ...
         return;
     }

     const messageElement = document.createElement('div');
     messageElement.classList.add('message', messageType);

     let formattedContent = '';
     try {
         const jsonData = JSON.parse(rawMessageData);

         if (messageType === 'log-trade' && Array.isArray(jsonData.data)) {
             formattedContent = jsonData.data.map(trade =>
                 `TRADE [${formatTimestamp(trade.time)}] ${trade.side === 'B' ? '<span class="side-B">BUY</span>' : '<span class="side-S">SELL</span>'} ${trade.sz} ${jsonData.data.coin || currentLogCoin} @ ${trade.px} (Liq: ${trade.liquidation ? 'Y' : 'N'})` // Shortened Liquidation
             ).join('<br>');
         } else if (messageType === 'log-l2' && jsonData.data?.levels) {
              // This will now only run approx every 5 minutes due to the check above
              formattedContent = `L2 SUMMARY [${formatTimestamp(jsonData.data.time)}] ${jsonData.data.coin || currentLogCoin} - Bids: ${jsonData.data.levels[0]?.length || 0}, Asks: ${jsonData.data.levels[1]?.length || 0}`;
              messageElement.classList.add('log-separator'); // Add separator before L2 summary
         } else {
             formattedContent = `<pre>${JSON.stringify(jsonData, null, 2)}</pre>`;
             messageElement.classList.add('log-separator');
         }

     } catch (e) {
         formattedContent = rawMessageData;
         messageElement.classList.replace('log-other', 'log-info');
     }

     messageElement.innerHTML = formattedContent;

     // Apply filter
     const filterValue = filterInput.value.toLowerCase();
     if (filterValue && !messageElement.textContent.toLowerCase().includes(filterValue)) {
         messageElement.classList.add('hidden');
     }

     dataContainer.appendChild(messageElement);
     scrollToBottomIfNeeded();
}

function scrollToBottomIfNeeded() { /* ... no changes ... */ }


// --- WebSocket Connection & Subscription ---
function subscribeToLogCoin(coin) { /* ... no changes ... */ }
function unsubscribeFromLogCoin(coin) { /* ... no changes ... */ }

function connectWebSocket() {
    console.log("[WS] Attempting Connection...");
    // ... (Keep status updates, initial placeholders, variable resets) ...
    statusDiv.textContent = "Connecting...";
    statusDiv.className = 'status connecting';
    dataContainer.innerHTML = '<div class="message log-info" style="text-align: center; padding: 20px;">Connecting and waiting for data...</div>';
    messageCounter = 0;
    coinInput.value = currentLogCoin;
    assetContexts = {};
    lastUpdateTime = null;
    lastL2LogTime = 0; // Reset L2 log timer on reconnect
    if (overviewUpdateInterval) clearInterval(overviewUpdateInterval);

    renderList(fundingPositiveList, [], item => ({}), "Top 5 Positive Funding", "Loading...");
    renderList(fundingNegativeList, [], item => ({}), "Top 5 Negative Funding", "Loading...");
    renderList(oiList, [], item => ({}), "Top 5 Volume (OI Placeholder)", "Loading...");
    renderList(volumeList, [], item => ({}), "Top 5 Volume (24h USD)", "Loading...");


    try { socket = new WebSocket(WEBSOCKET_URL); }
    catch (e) { /* ... error handling ... */ return; }

    socket.addEventListener('open', function (event) {
        // ... (Keep status updates, overview subscription, log coin subscription) ...
        console.log('[WS] Connection Opened.');
        statusDiv.textContent = "Connected! Subscribing...";
        statusDiv.className = 'status connected';

        const overviewSubscription = { method: "subscribe", subscription: { type: "webData2" }};
         try { socket.send(JSON.stringify(overviewSubscription)); console.log("[WS] Sent overview (webData2) subscribe:", overviewSubscription); }
         catch (e) { console.error("[WS] Error sending overview subscribe:", e); }

        subscribeToLogCoin(currentLogCoin);
        overviewUpdateInterval = setInterval(checkOverviewDataReceived, 7000);
    });

    socket.addEventListener('message', function (event) {
        // console.log("[WS] Raw Message Received:", event.data); // Keep this commented unless actively debugging everything

        try {
            const messageData = JSON.parse(event.data);

            // --- webData2 Processing ---
            if (messageData.channel === 'webData2' && messageData.data) {
                // *** MOST IMPORTANT DEBUG LOG ***
                console.log("[WS] Received webData2:", JSON.stringify(messageData.data, null, 2)); // Log the structure clearly

                 if (Array.isArray(messageData.data.assetCtxs)) {
                    let updatedCount = 0;
                    messageData.data.assetCtxs.forEach(ctx => {
                        if (ctx && ctx.name) { // Check if 'name' exists and is truthy
                           assetContexts[ctx.name] = ctx;
                           updatedCount++;
                        } else {
                           console.warn("[WS] Skipping asset context missing 'name':", ctx); // Log problematic contexts
                        }
                    });
                    console.log(`[WS] Processed ${updatedCount} asset contexts from webData2.`);
                    // Only update display if data was actually processed
                    if (updatedCount > 0) updateOverviewDisplay();
                 } else {
                    console.error("[WS] webData2 received, but 'assetCtxs' is NOT an array:", messageData.data);
                    // *** ADD A VISUAL CUE? ***
                    renderList(fundingPositiveList, [], item => ({}), "Top 5 Positive Funding", "Data Error (Ctx)"); // Indicate error
                 }
            }
            // --- L2Book Processing (Passes to addMessageToLog which throttles UI) ---
            else if (messageData.channel === 'l2Book' && messageData.data?.coin === currentLogCoin) {
                 addMessageToLog(event.data, 'log-l2'); // Type determines throttling in addMessageToLog
            }
            // --- Trades Processing ---
            else if (messageData.channel === 'trades' && messageData.data?.coin === currentLogCoin) {
                 addMessageToLog(event.data, 'log-trade');
            }
            // --- Other Channels ---
            // else { console.log("[WS] Received unhandled channel:", messageData.channel); }

        } catch (e) {
            console.error('[WS] Error processing message:', e, 'Raw data:', event.data);
            // Don't add raw parse errors to the main log unless debugging
            // addMessageToLog(`Error parsing: ${event.data}`, 'log-error');
        }
    });

    // ... (Keep error and close event listeners as they are) ...
    socket.addEventListener('error', function (event) { /* ... no changes ... */ });
    socket.addEventListener('close', function (event) { /* ... no changes ... */ });
}

// ... (Keep checkOverviewDataReceived function as is) ...
function checkOverviewDataReceived() { /* ... no changes ... */ }

// --- Event Listeners for Controls ---
// ... (Keep filterInput and changeCoinBtn listeners as they are) ...
filterInput.addEventListener('input', function() { /* ... no changes ... */ });
changeCoinBtn.addEventListener('click', function() { /* ... no changes ... */ });


// --- Initial Connection ---
connectWebSocket();
