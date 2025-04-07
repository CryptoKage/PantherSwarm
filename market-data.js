// --- Configuration ---
const WEBSOCKET_URL = "wss://api.hyperliquid.xyz/ws";
let currentLogCoin = "ETH";

// --- Get HTML Elements ---
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
let assetContexts = {}; // Stores data from webData2
let lastUpdateTime = null; // Track last overview update
let overviewUpdateInterval; // Timer for checking if overview data arrived

// --- WebSocket Logic ---
let socket;
let messageCounter = 0;
const MAX_MESSAGES_LOG = 250;

// --- Helper Functions ---
function formatLargeNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    num = Number(num);
    if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + ' K';
    return num.toFixed(0);
}
function formatFundingRate(rate) {
    if (rate === null || rate === undefined || isNaN(rate)) return 'N/A';
    return (Number(rate) * 100).toFixed(4) + '%';
}
function formatTimestamp(timestamp) {
    // Assuming timestamp is in milliseconds
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString(); // Format as HH:MM:SS
}


// --- Overview Display Logic ---
function updateOverviewDisplay() {
    console.log("[Overview] Attempting update. Context keys:", Object.keys(assetContexts).length);
    lastUpdateTime = new Date();

    if (Object.keys(assetContexts).length === 0) {
        console.warn("[Overview] No asset contexts available.");
        // Keep placeholder as "Loading..." or "No Data" - handled by renderList
        return;
    }

    const allCoinsData = Object.entries(assetContexts).map(([coin, ctx]) => {
        const funding = parseFloat(ctx?.funding);
        const volume = parseFloat(ctx?.dayNtlVlm);
        return {
            coin: coin,
            fundingRate: !isNaN(funding) ? funding : NaN,
            volume24h: !isNaN(volume) ? volume : NaN
        };
    }).filter(d => !isNaN(d.volume24h) && d.volume24h > 0 && !isNaN(d.fundingRate) && d.coin);

    console.log(`[Overview] Filtered ${allCoinsData.length} valid coins.`);

    if (allCoinsData.length === 0) {
         console.warn("[Overview] No coins remained after filtering.");
         renderList(fundingPositiveList, [], item => ({}), "Top 5 Positive Funding", "No Valid Data");
         renderList(fundingNegativeList, [], item => ({}), "Top 5 Negative Funding", "No Valid Data");
         renderList(oiList, [], item => ({}), "Top 5 Volume (OI Placeholder)", "No Valid Data");
         renderList(volumeList, [], item => ({}), "Top 5 Volume (24h USD)", "No Valid Data");
         return;
    }

    // Sort and render funding
    const sortedByFunding = [...allCoinsData].sort((a, b) => b.fundingRate - a.fundingRate);
    renderList(fundingPositiveList, sortedByFunding.filter(d => d.fundingRate > 0).slice(0, 5), item => ({
        coin: item.coin, value: formatFundingRate(item.fundingRate), valueClass: 'positive'
    }), "Top 5 Positive Funding");
    renderList(fundingNegativeList, sortedByFunding.filter(d => d.fundingRate < 0).reverse().slice(0, 5), item => ({
        coin: item.coin, value: formatFundingRate(item.fundingRate), valueClass: 'negative'
    }), "Top 5 Negative Funding");

    // Sort and render volume
    const sortedByVolume = [...allCoinsData].sort((a, b) => b.volume24h - a.volume24h);
    const topVolume = sortedByVolume.slice(0, 5);
    renderList(oiList, topVolume, item => ({
        coin: item.coin, value: '$' + formatLargeNumber(item.volume24h)
    }), "Top 5 Volume (OI Placeholder)");
    renderList(volumeList, topVolume, item => ({
        coin: item.coin, value: '$' + formatLargeNumber(item.volume24h)
    }), "Top 5 Volume (24h USD)");
}

// Renders data into a specific <ul> list
function renderList(listElement, data, formatter, titleOverride = null, placeholder = "No Data Available") {
    if (!listElement) return;
    const gridTitleElement = listElement.closest('.overview-grid')?.querySelector('h3');
    if (gridTitleElement && titleOverride) {
        gridTitleElement.textContent = titleOverride;
    }

    if (!data || data.length === 0) {
        // Use the placeholder passed in, or default
        listElement.innerHTML = `<li class="placeholder">${placeholder}</li>`;
        return;
    }
    listElement.innerHTML = data.map(item => {
        const formatted = formatter(item);
        return `
            <li>
                <span class="coin">${formatted.coin || 'N/A'}</span>
                <span class="value ${formatted.valueClass || ''}">${formatted.value || 'N/A'}</span>
            </li>
        `;
    }).join('');
}

// --- Raw Log Display Logic ---
function addMessageToLog(rawMessageData, messageType = 'log-other') {
     // Clear "Waiting..." message on first real log entry
     if (messageCounter === 0 && dataContainer.querySelector('.log-info')) {
        dataContainer.innerHTML = '';
     }

     messageCounter++;
     if (messageCounter > MAX_MESSAGES_LOG + 1) {
         // Only log suppression notice once
         if (messageCounter === MAX_MESSAGES_LOG + 2) {
             console.warn(`[Log] Suppressing further UI updates after ${MAX_MESSAGES_LOG} messages.`);
             const noticeElement = document.createElement('div');
             noticeElement.textContent = `--- Log UI updates paused (check console) ---`;
             noticeElement.className = 'message log-info';
             dataContainer.appendChild(noticeElement);
             scrollToBottomIfNeeded();
         }
         console.log('[Log Suppressed] Raw:', rawMessageData); // Still log to console
         return;
     }

     const messageElement = document.createElement('div');
     messageElement.classList.add('message', messageType); // Add base class and specific type class

     let formattedContent = '';
     try {
         const jsonData = JSON.parse(rawMessageData);
         // Format specific known types
         if (messageType === 'log-trade' && Array.isArray(jsonData.data)) {
             formattedContent = jsonData.data.map(trade =>
                 `TRADE [${formatTimestamp(trade.time)}] ${trade.side === 'B' ? '<span class="side-B">BUY</span>' : '<span class="side-S">SELL</span>'} ${trade.sz} ${jsonData.data.coin || currentLogCoin} @ ${trade.px} (Liquidation: ${trade.liquidation ? 'Yes' : 'No'})`
             ).join('<br>'); // Join multiple trades in one message with line breaks
         } else if (messageType === 'log-l2' && jsonData.data?.levels) {
              formattedContent = `L2 Update [${formatTimestamp(jsonData.data.time)}] ${jsonData.data.coin || currentLogCoin} - ${jsonData.data.levels[0]?.length || 0} Bids, ${jsonData.data.levels[1]?.length || 0} Asks`;
             // Optionally add more detail, e.g., top bid/ask
             // formattedContent += `<br>Top Bid: ${jsonData.data.levels[0][0]?.px}, Top Ask: ${jsonData.data.levels[1][0]?.px}`;
         } else {
             // Fallback: Pretty print unknown JSON
             formattedContent = `<pre>${JSON.stringify(jsonData, null, 2)}</pre>`; // Use <pre> for better formatting
             messageElement.classList.add('log-separator'); // Add separator for readability
         }

     } catch (e) {
         // If not JSON or formatting failed, display raw text
         formattedContent = rawMessageData;
         messageElement.classList.replace('log-other', 'log-info'); // Style as plain info if not JSON
     }

     messageElement.innerHTML = formattedContent; // Use innerHTML because we added spans/br/pre

     // Apply filter immediately
     const filterValue = filterInput.value.toLowerCase();
     if (filterValue && !messageElement.textContent.toLowerCase().includes(filterValue)) { // Filter on textContent
         messageElement.classList.add('hidden');
     }

     dataContainer.appendChild(messageElement);
     scrollToBottomIfNeeded();
}

function scrollToBottomIfNeeded() {
    // Auto-scroll only if user is already near the bottom
    const isScrolledToBottom = dataContainer.scrollHeight - dataContainer.clientHeight <= dataContainer.scrollTop + 60; // Generous buffer
    if (isScrolledToBottom) {
        dataContainer.scrollTop = dataContainer.scrollHeight;
    }
}

// --- WebSocket Connection & Subscription ---
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
function unsubscribeFromLogCoin(coin) {
     if (!socket || socket.readyState !== WebSocket.OPEN) return;
    console.log(`[WS] Unsubscribing log channels for ${coin}...`);
    const subscriptions = [ { type: "l2Book", coin: coin }, { type: "trades", coin: coin } ];
    subscriptions.forEach(sub => {
        const message = { method: "unsubscribe", subscription: sub };
         try { socket.send(JSON.stringify(message)); console.log("[WS] Sent log unsubscribe:", message); }
         catch (e) { console.error("[WS] Error sending log unsubscribe:", e); }
    });
}

function connectWebSocket() {
    console.log("[WS] Attempting Connection...");
    statusDiv.textContent = "Connecting...";
    statusDiv.className = 'status connecting';
    dataContainer.innerHTML = '<div class="message log-info" style="text-align: center; padding: 20px;">Connecting and waiting for data...</div>';
    messageCounter = 0;
    coinInput.value = currentLogCoin;
    assetContexts = {}; // Clear contexts
    lastUpdateTime = null; // Reset last update time
    if (overviewUpdateInterval) clearInterval(overviewUpdateInterval); // Clear previous timer

    // Set initial overview state to "Loading..."
    renderList(fundingPositiveList, [], item => ({}), "Top 5 Positive Funding", "Loading...");
    renderList(fundingNegativeList, [], item => ({}), "Top 5 Negative Funding", "Loading...");
    renderList(oiList, [], item => ({}), "Top 5 Volume (OI Placeholder)", "Loading...");
    renderList(volumeList, [], item => ({}), "Top 5 Volume (24h USD)", "Loading...");

    try {
        socket = new WebSocket(WEBSOCKET_URL);
    } catch (e) {
         console.error("[WS] WebSocket creation failed:", e);
         statusDiv.textContent = "WebSocket Creation Failed!";
         statusDiv.className = 'status error';
         return;
    }


    socket.addEventListener('open', function (event) {
        console.log('[WS] Connection Opened.');
        statusDiv.textContent = "Connected! Subscribing...";
        statusDiv.className = 'status connected';

        // Subscribe to overview data
        const overviewSubscription = { method: "subscribe", subscription: { type: "webData2" }};
         try { socket.send(JSON.stringify(overviewSubscription)); console.log("[WS] Sent overview (webData2) subscribe:", overviewSubscription); }
         catch (e) { console.error("[WS] Error sending overview subscribe:", e); }


        // Subscribe to initial log coin
        subscribeToLogCoin(currentLogCoin);

        // Start checking if overview data arrived
        overviewUpdateInterval = setInterval(checkOverviewDataReceived, 7000); // Check every 7 seconds
    });

    socket.addEventListener('message', function (event) {
        // console.log("[WS] Raw Message Received:", event.data); // DEBUG: Uncomment to see everything
        try {
            const messageData = JSON.parse(event.data);

            if (messageData.channel === 'webData2' && messageData.data) {
                console.log("[WS] Received webData2:", messageData.data); // Log received overview data structure
                 if (Array.isArray(messageData.data.assetCtxs)) {
                    let updatedCount = 0;
                    messageData.data.assetCtxs.forEach(ctx => {
                        if (ctx && ctx.name) {
                           assetContexts[ctx.name] = ctx;
                           updatedCount++;
                        }
                    });
                    console.log(`[WS] Updated ${updatedCount} asset contexts.`);
                    updateOverviewDisplay(); // Update the grids
                 } else {
                    console.warn("[WS] webData2 received, but 'assetCtxs' array missing/invalid:", messageData.data);
                 }
            }
            else if (messageData.channel === 'l2Book' && messageData.data?.coin === currentLogCoin) {
                 addMessageToLog(event.data, 'log-l2'); // Pass raw data, identify type
            }
            else if (messageData.channel === 'trades' && messageData.data?.coin === currentLogCoin) {
                 addMessageToLog(event.data, 'log-trade'); // Pass raw data, identify type
            }
            // Add handlers for other channels if needed
            // else { console.log("[WS] Received unhandled message type:", messageData.channel); }

        } catch (e) {
            console.error('[WS] Error processing message:', e, 'Raw data:', event.data);
            addMessageToLog(`Error parsing: ${event.data}`, 'log-error'); // Log error in UI
        }
    });

    socket.addEventListener('error', function (event) {
        console.error('[WS] WebSocket Error:', event);
        statusDiv.textContent = "Connection Error! Check console.";
        statusDiv.className = 'status error';
        if (overviewUpdateInterval) clearInterval(overviewUpdateInterval);
    });

    socket.addEventListener('close', function (event) {
        console.log('[WS] Connection Closed.', event.code, event.reason);
        statusDiv.textContent = "Disconnected. Reconnecting...";
        statusDiv.className = 'status disconnected';
        if (overviewUpdateInterval) clearInterval(overviewUpdateInterval);
        socket = null;
        assetContexts = {}; // Clear data
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 5000);
    });
}

// Function to check if overview data seems stuck on "Loading..."
function checkOverviewDataReceived() {
    if (!lastUpdateTime && socket?.readyState === WebSocket.OPEN) {
        console.warn("[Check] No overview data received yet. Still connected.");
        // If overview lists still show "Loading...", change to "No data"
         renderList(fundingPositiveList, [], item => ({}), "Top 5 Positive Funding", "Waiting for data...");
         renderList(fundingNegativeList, [], item => ({}), "Top 5 Negative Funding", "Waiting for data...");
         renderList(oiList, [], item => ({}), "Top 5 Volume (OI Placeholder)", "Waiting for data...");
         renderList(volumeList, [], item => ({}), "Top 5 Volume (24h USD)", "Waiting for data...");
    } else {
        // If data has arrived at some point, stop checking
         if (overviewUpdateInterval) clearInterval(overviewUpdateInterval);
    }
}


// --- Event Listeners for Controls ---
filterInput.addEventListener('input', function() {
    const filterValue = filterInput.value.toLowerCase();
    const messages = dataContainer.querySelectorAll('.message');
    messages.forEach(messageDiv => {
        // Filter based on the actual text content, ignoring HTML tags
        const messageText = messageDiv.textContent.toLowerCase();
        if (messageText.includes(filterValue)) {
            messageDiv.classList.remove('hidden');
        } else {
            messageDiv.classList.add('hidden');
        }
    });
});

changeCoinBtn.addEventListener('click', function() {
    const newCoin = coinInput.value.trim().toUpperCase();
    if (!newCoin) { alert("Please enter a coin symbol."); return; }
    if (newCoin === currentLogCoin) { alert(`Already logging ${currentLogCoin}.`); return; }
    if (!socket || socket.readyState !== WebSocket.OPEN) { alert("WebSocket is not connected."); return; }

    console.log(`[Control] Changing log coin from ${currentLogCoin} to ${newCoin}`);
    statusDiv.textContent = `Updating log subscriptions to ${newCoin}...`;
    statusDiv.className = 'status updating';

    unsubscribeFromLogCoin(currentLogCoin);
    dataContainer.innerHTML = `<div class="message log-info" style="text-align: center; padding: 20px;">Fetching ${newCoin} data...</div>`;
    messageCounter = 0; // Reset log counter for new coin
    currentLogCoin = newCoin;

    // Slight delay to allow unsubscribe message to be potentially processed
    setTimeout(() => {
       subscribeToLogCoin(currentLogCoin);
       // Reset status visually after attempting subscription
       statusDiv.textContent = "Connected";
       statusDiv.className = 'status connected';
    }, 300); // Slightly increased delay
});

// --- Initial Connection ---
connectWebSocket();
