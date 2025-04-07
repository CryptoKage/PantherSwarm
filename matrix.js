document.addEventListener('DOMContentLoaded', function() {
    // Matrix effect
    const canvas = document.getElementById('matrix-canvas');
    // Add safety check for canvas existence
    if (!canvas) {
        console.error("Matrix Error: Canvas element with ID 'matrix-canvas' not found.");
        // Optionally hide the loading container if canvas isn't found
        const matrixLoading = document.getElementById('matrix-loading');
        if (matrixLoading) matrixLoading.style.display = 'none';
        // Ensure main content is visible as fallback
        const websiteContent = document.getElementById('website-content');
        if(websiteContent) {
             websiteContent.classList.remove('hidden');
             websiteContent.classList.add('visible');
             if(document.body) document.body.style.overflow = 'auto'; // Enable scroll
        }
        return; // Stop script execution if canvas is missing
    }

    const ctx = canvas.getContext('2d');

    // Set canvas to full window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Matrix characters
    const matrixChars = "01アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン";
    const fontSize = 16;
    const columns = Math.ceil(canvas.width / fontSize); // Use Math.ceil for better coverage

    // Set up the drops
    const drops = [];
    for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -canvas.height / fontSize; // Start drops off-screen
    }

    let matrixInterval = null; // Define interval variable

    // Drawing the characters
    function draw() {
        // Black background with opacity for fading effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Set color and font FOR MATRIX EFFECT <<< COLOR CHANGED HERE
        ctx.fillStyle = '#33A1FF'; // Tech Blue
        ctx.font = fontSize + 'px monospace';

        // Loop over drops
        for (let i = 0; i < drops.length; i++) {
            // Get random character
            const text = matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));

            // Draw the character at current drop position
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            // Reset drop to top randomly when it goes off screen
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }

            // Move the drop down
            drops[i]++;
        }
    }

    // Start the animation loop
    if (!matrixInterval) { // Prevent multiple intervals if script runs twice
        matrixInterval = setInterval(draw, 40); // Adjust speed slightly if needed (33-50ms)
    }

    // After 5 seconds, fade out the matrix effect and show the website
    // Ensure elements exist before setting timeouts
    const matrixLoading = document.getElementById('matrix-loading');
    const websiteContent = document.getElementById('website-content');

    if (matrixLoading && websiteContent) {
        setTimeout(function() {
            // Fade out matrix loading screen
            matrixLoading.style.transition = 'opacity 2s ease-in-out'; // Ensure CSS has this too
            matrixLoading.style.opacity = '0';
             matrixLoading.style.visibility = 'hidden'; // Add visibility transition

            // Show website content after fade out
            setTimeout(function() {
                matrixLoading.style.display = 'none'; // Remove from layout
                websiteContent.classList.remove('hidden'); // Prepare for visibility
                // Timeout ensures class change happens after display:none potentially reflows
                setTimeout(() => {
                    websiteContent.classList.add('visible');
                    if(document.body) document.body.style.overflow = 'auto'; // Enable scroll
                     document.title = "PantherSwarm"; // Update title
                }, 50); // Short delay

                // Stop the matrix animation ONLY IF interval was started
                if (matrixInterval) {
                    clearInterval(matrixInterval);
                     matrixInterval = null; // Clear variable
                     console.log("Matrix animation stopped.");
                }
            }, 2000); // Corresponds to the 2s fade-out transition
        }, 5000); // Initial delay before starting fade-out
    } else {
        console.error("Matrix Error: Could not find #matrix-loading or #website-content for transition.");
        // Fallback if elements are missing
        if(websiteContent) {
             websiteContent.classList.remove('hidden');
             websiteContent.classList.add('visible');
             if(document.body) document.body.style.overflow = 'auto';
        }
        if (matrixLoading) matrixLoading.style.display = 'none';
        if (matrixInterval) clearInterval(matrixInterval); // Stop animation anyway
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        // Ensure canvas and context still exist
        const currentCanvas = document.getElementById('matrix-canvas');
        if (!currentCanvas) return;
        const currentCtx = currentCanvas.getContext('2d');
        if (!currentCtx) return;

        currentCanvas.width = window.innerWidth;
        currentCanvas.height = window.innerHeight;
        const newColumns = Math.ceil(currentCanvas.width / fontSize);
        // Reset drops array based on new column count
        drops.length = 0; // Clear existing drops
         for (let i = 0; i < newColumns; i++) {
             drops[i] = Math.random() * -currentCanvas.height / fontSize;
         }
    });
});
