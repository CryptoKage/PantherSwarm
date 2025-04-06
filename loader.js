// loader.js

// Set the duration for the Matrix effect (in milliseconds)
const matrixDuration = 4000; // 4 seconds

// Get references to the elements
const matrixCanvas = document.getElementById('Matrix');
const mainContent = document.getElementById('main-content');
const bodyElement = document.body; // To re-enable scrolling

// Function to initiate the transition
function showMainContent() {
    if (matrixCanvas && mainContent) {
        // Start fading out the canvas
        matrixCanvas.classList.add('fade-out');

        // After the canvas fade-out transition completes, hide it completely
        // and start fading in the main content.
        // The timeout duration should match the CSS transition duration.
        // We get the duration from the CSS variable (need parsing).
        const style = getComputedStyle(document.documentElement);
        const transitionSpeed = parseFloat(style.getPropertyValue('--transition-speed') || '0.8') * 1000; // Convert s to ms

        setTimeout(() => {
            matrixCanvas.style.display = 'none'; // Hide canvas completely

            // Make the main content visible and trigger its fade-in
            mainContent.classList.remove('hidden'); // Remove initial hidden state if needed
            mainContent.classList.add('visible');

            // Update title and allow scrolling
             document.title = "PantherSwarm"; // Set final page title
             bodyElement.style.overflow = 'auto'; // Re-enable scrolling

            // Optional: Stop the matrix animation loop if possible
            // This depends on how matrix.js is written. If it uses requestAnimationFrame,
            // you might need to expose a function like `stopMatrixAnimation()` from matrix.js
            // or set a global flag that matrix.js checks.
            // For now, just hiding the canvas is the simplest approach.

        }, transitionSpeed);
    } else {
        console.error("Loader Error: Canvas or Main Content element not found.");
        // Fallback in case elements aren't found
        if(mainContent) mainContent.classList.add('visible');
        if(matrixCanvas) matrixCanvas.style.display = 'none';
        bodyElement.style.overflow = 'auto';
        document.title = "PantherSwarm";
    }
}

// Wait for the specified duration, then start the transition
setTimeout(showMainContent, matrixDuration);

// Optional: Add an event listener to skip the animation on click/keypress
/*
function skipLoader() {
    clearTimeout(loadTimeout); // Clear the scheduled timeout
    showMainContent(); // Run the transition immediately
    // Remove the listener so it only triggers once
    document.removeEventListener('click', skipLoader);
    document.removeEventListener('keypress', skipLoader);
}
const loadTimeout = setTimeout(showMainContent, matrixDuration);
document.addEventListener('click', skipLoader, { once: true }); // Use {once: true} modern alternative
document.addEventListener('keypress', skipLoader, { once: true });
*/
