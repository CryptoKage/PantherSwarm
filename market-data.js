// --- Configuration ---
const WEBSOCKET_URL = "wss://api.hyperliquid.xyz/ws";
let currentLogCoin = "ETH"; // Coin for L2/Trades log

// --- Get HTML Elements ---
const statusDiv = document.getElementById('status');
const dataContainer = document.getElementById('data-container');
const filterInput = document.getElementById('filterInput');
const coinInput = document.getElementById('coinInput');
const changeCoinBtn = document.getElementById('changeCoinBtn');

// Overview List Elements
const fundingPositiveList = document.getElementById('funding-positive-list');
const fundingNegativeList = document.getElementById('funding-negative-list');
const oiList = document.getElementById('oi-list');
const volumeList = document.getElementById('volume-list');

// --- Data Storage ---
let marketOverviewData = {}; // Stores { coin: { fundingRate, openInterest, volume24h, ... } } from webData2
let assetContexts = {}; // Stores { coin: { dayNtlVlm, funding, openInterest, ... } } Needed for USD values

// --- WebSocket Logic ---
let socket;
let messageCounter = 0;
const MAX_MESSAGES_LOG = 200; // Limit messages in raw log only

// --- Helper Functions ---

// Format large numbers (Volume, OI) into K, M, B
function formatLargeNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + ' K';
    return num.toFixed(0); // No decimal for small numbers
}

// Format funding rate as percentage
function formatFundingRate(rate) {
    if (rate === null || rate === undefined) return 'N/A';
    return (parseFloat(rate) * 100).toFixed(4) + '%'; // Display with 4 decimal places
}

// Update the overview grids in the UI
function updateOverviewDisplay() {
    if (Object.keys(assetContexts).length === 0) {
        // console.log("Asset contexts not yet available for overview.");
        return; // Wait for data
    }

    const allCoinsData = Object.entries(assetContexts).map(([coin, ctx]) => {
        // Calculate OI in USD: openInterest (in coins) * current price (midPrice)
        // We need mid prices. For now, let's just use openInterest in coins if mid price isn't readily available
        // Or better: use dayNtlVlm directly as it's already in USD. Use openInterest for OI sorting for now.
        return {
            coin: coin,
            fundingRate: parseFloat(ctx?.funding || 0), // Ensure numeric for sorting
            openInterestValue: parseFloat(ctx?.openInterest || 0), // In units of the coin
            volume24h: parseFloat(ctx?.dayNtlVlm || 0) // Already in USD nominal terms
        };
    }).filter(d => d.volume24h > 0); // Filter out coins with no volume, likely inactive


    // --- Funding Rate ---
    const sortedByFunding = [...allCoinsData].sort((a, b) => b.fundingRate - a.fundingRate); // Descending
    const topPositiveFunding = sortedByFunding.filter(d => d.fundingRate > 0).slice(0, 5);
    const topNegativeFunding = sortedByFunding.filter(d => d.fundingRate < 0).reverse().slice(0, 5); // Reverse for most negative

    renderList(fundingPositiveList, topPositiveFunding, item => ({
        coin: item.coin,
        value: formatFundingRate(item.fundingRate),
        valueClass: 'positive'
    }));
    renderList(fundingNegativeList, topNegativeFunding, item => ({
        coin: item.coin,
        value: formatFundingRate(item.fundingRate),
        valueClass: 'negative'
    }));


    // --- Open Interest (using coin units for now, needs price for USD) ---
    // Let's sort by USD Volume instead as OI needs price conversion which we don't have easily here
    // *** Or we can use the OI value directly if that's useful info ***
    // Let's stick to Volume as requested
    /*
    const sortedByOI = [...allCoinsData].sort((a, b) => b.openInterestValue - a.openInterestValue);
    const topOI = sortedByOI.slice(0, 5);
    renderList(oiList, topOI, item => ({
        coin: item.coin,
        value: formatLargeNumber(item.openInterestValue) + ` ${item.coin}` // Add unit
    }));
    */
     // --- Let's replace OI with a second volume sort or another metric if OI isn't easily usable ---
     // For now, let's just duplicate the Volume ranking here. You might want a different metric.
     const sortedByVolumeOIPlaceholder = [...allCoinsData].sort((a, b) => b.volume24h - a.volume24h);
     const topVolumeForOI = sortedByVolumeOIPlaceholder.slice(0, 5);
     renderList(oiList, topVolumeForOI, item => ({ // Reusing oiList element ID
         coin: item.coin,
         value: '$' + formatLargeNumber(item.volume24h) // Show volume here instead
     }), "Top 5 Volume (placeholder for OI)"); // Update title via JS


    // --- Volume (24h USD) ---
    const sortedByVolume = [...allCoinsData].sort((a, b) => b.volume24h - a.volume24h);
    const topVolume = sortedByVolume.slice(0, 5);
    renderList(volumeList, topVolume, item => ({
        coin: item.coin,
        value: '$' + formatLargeNumber(item.volume24h)
    }));
}

// Renders data into a specific <ul> list
function renderList(listElement, data, formatter, titleOverride = null) {
    if (!listElement) return;
     if (titleOverride) {
        const titleElement = listElement.closest('.overview-grid')?.querySelector('h3');
        if (titleElement) titleElement.textContent = titleOverride;
    }

    if (!data || data.length === 0) {
        listElement.innerHTML = '<li>No data available</li>';
        return;
    }
    listElement.innerHTML = data.map(item => {
        const formatted = formatter(item);
        return `
            <li>
                <span class="coin">${formatted.coin}</span>
                <span class="value ${formatted.valueClass || ''}">${formatted.value}</span>
            </li>
        `;
    }).join('');
}


// Function to send subscription messages for the log coin
function subscribeToLogCoin(coin) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    console.log(`Subscribing log channels for ${coin}...`);
    const subscriptions = [
        { type: "l2Book", coin: coin },
        { type: "trades", coin: coin }
    ];
    subscriptions.forEach(sub => {
        const message = { method: "subscribe", subscription: sub };
        socket.send(JSON.stringify(message));
        console.log("Sent log subscription:", message);
    });
}

// Function to send unsubscribe messages for the log coin
function unsubscribeFromLogCoin(coin) {
     if (!socket || socket.readyState !== WebSocket.OPEN) return;
    console.log(`Unsubscribing log channels for ${coin}...`);
    const subscriptions = [
        { type: "l2Book", coin: coin },
        { type: "trades", coin: coin }
    ];
    subscriptions.forEach(sub => {
        const message = { method: "unsubscribe", subscription: sub };
        socket.send(JSON.stringify(message));
        console.log("Sent log unsubscribe:", message);
    });
}

function connectWebSocket() {
    console.log("Attempting to connect to WebSocket:", WEBSOCKET_URL);
    statusDiv.textContent = "Connecting...";
    statusDiv.className = 'status connecting';
    dataContainer.innerHTML = '<div style="text-align: center; padding-top: 20px; color: #888;">Connecting and waiting for data...</div>'; // Clear log with placeholder
    messageCounter = 0;
    coinInput.value = currentLogCoin; // Ensure input matches state
    // Clear overview grids on reconnect
    renderList(fundingPositiveList, [], item => ({ coin: item.coin, value: '' }));
    renderList(fundingNegativeList, [], item => ({ coin: item.coin, value: '' }));
    renderList(oiList, [], item => ({ coin: item.coin, value: '' }));
    renderList(volumeList, [], item => ({ coin: item.coin, value: '' }));


    socket = new WebSocket(WEBSOCKET_URL);

    socket.addEventListener('open', function (event) {
        console.log('WebSocket connection opened:', event);
        statusDiv.textContent = "Connected! Subscribing...";
        statusDiv.className = 'status connected';

        // Subscribe to the overview data stream
        const overviewSubscription = { method: "subscribe", subscription: { type: "webData2" }};
        socket.send(JSON.stringify(overviewSubscription));
        console.log("Sent overview subscription:", overviewSubscription);

        // Subscribe to the initial log coin
        subscribeToLogCoin(currentLogCoin);
    });

    socket.addEventListener('message', function (event) {
        try {
            const messageData = JSON.parse(event.data);

            // Check if it's the overview data
            if (messageData.channel === 'webData2' && messageData.data) {
                // Process asset contexts - this seems to be the structure based on REST API similarity
                 if (Array.isArray(messageData.data.assetCtxs)) {
                    messageData.data.assetCtxs.forEach(ctx => {
                        if (ctx && ctx.name) {
                           assetContexts[ctx.name] = ctx; // Store context by coin name (e.g., "ETH")
                        }
                    });
                    // console.log("Updated Asset Contexts:", assetContexts); // Debug log
                    updateOverviewDisplay(); // Update the grids whenever new overview data arrives
                 }

            }
            // Check if it's data for the specific coin log (l2Book or trades)
            else if (messageData.channel === 'l2Book' || messageData.channel === 'trades') {
                 // Only add to the log if it matches the currently selected log coin (redundant check, but safe)
                 if (messageData.data && messageData.data.coin === currentLogCoin) {
                     addMessageToLog(event.data); // Pass raw data to log function
                 }
            } else {
                 // Handle other message types or log them if unexpected
                 console.log("Received other message type:", messageData);
                 // Optionally add to log if needed: addMessageToLog(event.data);
            }

        } catch (e) {
            console.error('Failed to parse message or process:', event.data, e);
            addMessageToLog(`Error processing message: ${event.data}`); // Add raw data on error
        }
    });

    // Function to add messages to the raw log container, respecting filter and max count
    function addMessageToLog(rawMessageData) {
         if (messageCounter === 0) {
            dataContainer.innerHTML = ''; // Clear "Waiting..." message on first real data
         }

         messageCounter++;
         if (messageCounter > MAX_MESSAGES_LOG + 1) {
             console.log('Log message suppressed (raw):', rawMessageData);
             return;
         }

         const messageElement = document.createElement('div');
         messageElement.classList.add('message');
         let messageTextContent = '';

         try { // Try pretty printing JSON for the log
             const jsonData = JSON.parse(rawMessageData);
             messageTextContent = JSON.stringify(jsonData, null, 2);
         } catch (e) { // Fallback to raw text
             messageTextContent = rawMessageData;
         }
         messageElement.textContent = messageTextContent;

         const filterValue = filterInput.value.toLowerCase();
         if (filterValue && !messageTextContent.toLowerCase().includes(filterValue)) {
             messageElement.classList.add('hidden');
         }

         dataContainer.appendChild(messageElement);

          if(messageCounter === MAX_MESSAGES_LOG + 1) {
            const noticeElement = document.createElement('div');
            noticeElement.textContent = `--- Further log messages suppressed in UI (still logging to console) ---`;
            noticeElement.style.color = 'yellow';
            noticeElement.classList.add('message');
            dataContainer.appendChild(noticeElement);
         }

         const isScrolledToBottom = dataContainer.scrollHeight - dataContainer.clientHeight <= dataContainer.scrollTop + 50; // Generous buffer
         if (isScrolledToBottom) {
             dataContainer.scrollTop = dataContainer.scrollHeight;
         }
    }


    socket.addEventListener('error', function (event) {
        console.error('WebSocket Error:', event);
        statusDiv.textContent = "Connection Error! Check console (F12).";
        statusDiv.className = 'status error';
    });

    socket.addEventListener('close', function (event) {
        console.log('WebSocket connection closed:', event);
        statusDiv.textContent = "Disconnected. Attempting to reconnect in 5 seconds...";
        statusDiv.className = 'status disconnected';
        socket = null;
        assetContexts = {}; // Clear overview data on disconnect
        marketOverviewData = {}; // Clear other potential overview data
        setTimeout(connectWebSocket, 5000);
    });
}

// --- Event Listeners for Controls ---

filterInput.addEventListener('input', function() {
    const filterValue = filterInput.value.toLowerCase();
    const messages = dataContainer.querySelectorAll('.message');
    messages.forEach(messageDiv => {
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

    console.log(`Changing log subscription from ${currentLogCoin} to ${newCoin}`);
    statusDiv.textContent = `Updating log subscriptions to ${newCoin}...`;
    statusDiv.className = 'status updating';

    unsubscribeFromLogCoin(currentLogCoin);
    dataContainer.innerHTML = `<div style="text-align: center; padding-top: 20px; color: #888;">Fetching ${newCoin} data...</div>`; // Clear log with placeholder
    messageCounter = 0;
    currentLogCoin = newCoin;

    setTimeout(() => {
       subscribeToLogCoin(currentLogCoin);
       // Reset status after attempting subscription
       statusDiv.textContent = "Connected";
       statusDiv.className = 'status connected';
    }, 250);
});

// --- Initial Connection ---
connectWebSocket();
// Periodically update display in case webData2 stops sending for a bit (optional safety net)
// setInterval(updateOverviewDisplay, 10000); // Update every 10 seconds regardless
