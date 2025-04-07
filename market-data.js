// --- Configuration ---
const WEBSOCKET_URL = "wss://api.hyperliquid.xyz/ws";
let currentCoin = "ETH"; // Keep track of the currently subscribed coin, default ETH

// --- Get HTML Elements ---
const statusDiv = document.getElementById('status');
const dataContainer = document.getElementById('data-container');
const filterInput = document.getElementById('filterInput');
const coinInput = document.getElementById('coinInput');
const changeCoinBtn = document.getElementById('changeCoinBtn');

// --- WebSocket Logic ---
let socket;
let messageCounter = 0;
const MAX_MESSAGES = 300; // Increased limit slightly

// Function to send subscription messages for the currentCoin
function subscribeToCoinChannels(coin) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log("WebSocket not open. Cannot subscribe.");
        return;
    }
    console.log(`Subscribing to channels for ${coin}...`);

    // Example subscriptions (add/remove as needed)
    const subscriptions = [
        { type: "l2Book", coin: coin },
        { type: "trades", coin: coin }
        // Add more types if desired: e.g., { type: "ticker", coin: coin }
    ];

    subscriptions.forEach(sub => {
        const message = { method: "subscribe", subscription: sub };
        socket.send(JSON.stringify(message));
        console.log("Sent subscription:", message);
    });

    // Update status briefly
    statusDiv.textContent = `Subscribed to ${coin} data streams!`;
    statusDiv.className = 'status connected'; // Revert to connected state
}

// Function to send un-subscription messages for a coin
function unsubscribeFromCoinChannels(coin) {
     if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log("WebSocket not open. Cannot unsubscribe.");
        return;
    }
    console.log(`Unsubscribing from channels for ${coin}...`);

    // Must match the types you subscribed to
    const subscriptionsToCancel = [
        { type: "l2Book", coin: coin },
        { type: "trades", coin: coin }
        // Add corresponding types if you added more in subscribeToCoinChannels
    ];

    subscriptionsToCancel.forEach(sub => {
        const message = { method: "unsubscribe", subscription: sub };
        socket.send(JSON.stringify(message));
        console.log("Sent unsubscribe:", message);
    });
}

function connectWebSocket() {
    console.log("Attempting to connect to WebSocket:", WEBSOCKET_URL);
    statusDiv.textContent = "Connecting...";
    statusDiv.className = 'status connecting';
    dataContainer.innerHTML = "";
    messageCounter = 0;
    coinInput.value = currentCoin; // Ensure input matches current state

    socket = new WebSocket(WEBSOCKET_URL);

    socket.addEventListener('open', function (event) {
        console.log('WebSocket connection opened:', event);
        statusDiv.textContent = "Connected! Subscribing...";
        statusDiv.className = 'status connected';
        // Subscribe to the initial/current coin
        subscribeToCoinChannels(currentCoin);
    });

    socket.addEventListener('message', function (event) {
        messageCounter++;
         if (messageCounter > MAX_MESSAGES + 1) { // Check before processing/adding
             console.log('Message from server (suppressed in UI):', event.data);
             return; // Stop processing further messages for UI
         }

        // Create the message element (even if it gets hidden by filter later)
        const messageElement = document.createElement('div');
        messageElement.classList.add('message'); // Add class for filtering
        let messageTextContent = ''; // Store text for filtering

        try {
            const jsonData = JSON.parse(event.data);
            messageTextContent = JSON.stringify(jsonData, null, 2); // Pretty print JSON
            console.log('Message from server:', jsonData);
        } catch (e) {
            messageTextContent = event.data; // Raw text
            console.log('Message from server (raw):', event.data);
        }
        messageElement.textContent = messageTextContent;

        // Apply filter immediately if there's a value
        const filterValue = filterInput.value.toLowerCase();
        if (filterValue && !messageTextContent.toLowerCase().includes(filterValue)) {
            messageElement.classList.add('hidden');
        }

        // Append to container
        dataContainer.appendChild(messageElement);

        // Special handling for the MAX_MESSAGES notice
         if(messageCounter === MAX_MESSAGES + 1) {
            const noticeElement = document.createElement('div');
            noticeElement.textContent = `--- Further messages suppressed in UI (still logging to console) ---`;
            noticeElement.style.color = 'yellow';
            noticeElement.classList.add('message'); // So it can be potentially filtered too
            dataContainer.appendChild(noticeElement);
         }

        // Auto-scroll logic
        const isScrolledToBottom = dataContainer.scrollHeight - dataContainer.clientHeight <= dataContainer.scrollTop + 30; // Increased buffer
        if (isScrolledToBottom) {
            dataContainer.scrollTop = dataContainer.scrollHeight;
        }
    });

    socket.addEventListener('error', function (event) {
        console.error('WebSocket Error:', event);
        statusDiv.textContent = "Connection Error! Check console (F12).";
        statusDiv.className = 'status error';
    });

    socket.addEventListener('close', function (event) {
        console.log('WebSocket connection closed:', event);
        statusDiv.textContent = "Disconnected. Attempting to reconnect in 5 seconds...";
        statusDiv.className = 'status disconnected';
        // Ensure socket is cleaned up
        socket = null;
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 5000);
    });
}

// --- Event Listeners for Controls ---

// Filter Input Listener
filterInput.addEventListener('input', function() {
    const filterValue = filterInput.value.toLowerCase();
    const messages = dataContainer.querySelectorAll('.message'); // Get all message divs

    messages.forEach(messageDiv => {
        const messageText = messageDiv.textContent.toLowerCase();
        if (messageText.includes(filterValue)) {
            messageDiv.classList.remove('hidden'); // Show if matches
        } else {
            messageDiv.classList.add('hidden'); // Hide if doesn't match
        }
    });
});

// Change Coin Button Listener
changeCoinBtn.addEventListener('click', function() {
    const newCoin = coinInput.value.trim().toUpperCase(); // Get value, trim whitespace, convert to upper

    if (!newCoin) {
        alert("Please enter a coin symbol.");
        return;
    }

    if (newCoin === currentCoin) {
        alert(`Already subscribed to ${currentCoin}.`);
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert("WebSocket is not connected. Please wait or try refreshing.");
        return;
    }

    console.log(`Changing subscription from ${currentCoin} to ${newCoin}`);
    statusDiv.textContent = `Updating subscriptions to ${newCoin}...`;
    statusDiv.className = 'status updating'; // Use the new updating style

    // 1. Unsubscribe from the old coin
    unsubscribeFromCoinChannels(currentCoin);

    // 2. Clear the display
    dataContainer.innerHTML = ' '; // Clear data visually
    messageCounter = 0; // Reset counter

    // 3. Update the current coin variable
    currentCoin = newCoin;

    // 4. Subscribe to the new coin (add a small delay to ensure unsubscribe is processed)
    setTimeout(() => {
       subscribeToCoinChannels(currentCoin);
    }, 250); // 250ms delay, adjust if needed

});

// --- Initial Connection ---
connectWebSocket();
