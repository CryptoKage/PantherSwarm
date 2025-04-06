// loader.js - DEBUG VERSION

console.log("loader.js starting..."); // Check if script loads

// Set the duration for the Matrix effect (in milliseconds)
const matrixDuration = 4000; // 4 seconds
console.log(`Matrix duration set to: ${matrixDuration}ms`);

// Get references to the elements IMMEDIATELY (might be null if DOM not ready)
const matrixCanvas = document.getElementById('Matrix');
const mainContent = document.getElementById('main-content');
const bodyElement = document.body;

// Log if elements were found AT THE START
console.log("Initial Check - Matrix Canvas found:", matrixCanvas);
console.log("Initial Check - Main Content found:", mainContent);
console.log("Initial Check - Body Element found:", bodyElement);


// Function to initiate the transition
function showMainContent() {
    console.log("showMainContent() function called."); // Check if function executes

    // Re-check elements INSIDE the function, in case they loaded later
    const currentMatrixCanvas = document.getElementById('Matrix');
    const currentMainContent = document.getElementById('main-content');
    const currentBodyElement = document.body;

    console.log("Inside showMainContent - Matrix Canvas found:", currentMatrixCanvas);
    console.log("Inside showMainContent - Main Content found:", currentMainContent);
    console.log("Inside showMainContent - Body Element found:", currentBodyElement);


    if (currentMatrixCanvas && currentMainContent && currentBodyElement) {
        console.log("Elements found, starting transition...");
        currentMatrixCanvas.classList.add('fade-out');
        console.log("Added 'fade-out' class to canvas.");

        const style = getComputedStyle(document.documentElement);
        let transitionSpeed = 800; // Default
        try {
             const speedValue = style.getPropertyValue('--transition-speed').trim();
             if (speedValue.endsWith('ms')) { transitionSpeed = parseFloat(speedValue) || 800; }
             else if (speedValue.endsWith('s')) { transitionSpeed = parseFloat(speedValue) * 1000 || 800; }
        } catch(e) { console.warn("Could not parse --transition-speed.", e); }
        console.log(`Using transition speed: ${transitionSpeed}ms`);

        setTimeout(() => {
            console.log("Timeout finished. Hiding canvas, showing content.");
            // Double check element exists before setting style
            if (document.getElementById('Matrix')) {
                 document.getElementById('Matrix').style.display = 'none';
            } else {
                 console.error("Canvas disappeared before timeout finished?");
            }

            if (document.getElementById('main-content')) {
                document.getElementById('main-content').classList.add('visible');
                console.log("Added 'visible' class to main content.");
            } else {
                 console.error("Main content disappeared before timeout finished?");
            }

            document.title = "PantherSwarm";
            if (document.body) {
                 document.body.style.overflow = 'auto';
                 console.log("Scrolling enabled.");
            }
            console.log("Title changed.");

        }, transitionSpeed); // Use calculated speed for timeout

    } else {
        console.error("Loader Error inside showMainContent: Critical elements not found when transition was supposed to start.");
        // Fallback attempt
        const fallbackMainContent = document.getElementById('main-content');
        const fallbackMatrixCanvas = document.getElementById('Matrix');
        const fallbackBodyElement = document.body;
        if(fallbackMainContent) fallbackMainContent.classList.add('visible');
        if(fallbackMatrixCanvas) fallbackMatrixCanvas.style.display = 'none';
        if(fallbackBodyElement) fallbackBodyElement.style.overflow = 'auto';
        document.title = "PantherSwarm"; // Update title anyway
    }
}

// Wait for the DOM to be fully loaded before setting the timeout
// This might help if scripts run before elements exist
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    console.log(`Setting timeout for showMainContent in ${matrixDuration}ms`);
    const loadTimeout = setTimeout(showMainContent, matrixDuration);
});
