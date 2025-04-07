document.addEventListener('DOMContentLoaded', function() {
    // Matrix effect
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) {
        console.error("Matrix Error: Canvas element with ID 'matrix-canvas' not found.");
        const matrixLoading = document.getElementById('matrix-loading');
        if (matrixLoading) matrixLoading.style.display = 'none';
        const websiteContent = document.getElementById('website-content');
        if(websiteContent) {
             websiteContent.classList.remove('hidden');
             websiteContent.classList.add('visible'); // Make visible directly
             if(document.body) document.body.style.overflow = 'auto';
        }
        return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const matrixChars = "01アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン";
    const fontSize = 16;
    const columns = Math.ceil(canvas.width / fontSize);

    const drops = [];
    for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -canvas.height / fontSize;
    }

    let matrixInterval = null;
    let animationRunning = true; // Flag to control drawing

    function draw() {
        if (!animationRunning) return; // Stop drawing if flag is false

        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Fade effect
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#33A1FF'; // Tech Blue (from previous analysis)
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }

    if (!matrixInterval) {
        matrixInterval = setInterval(draw, 40); // Start animation
    }

    const matrixLoading = document.getElementById('matrix-loading');
    const websiteContent = document.getElementById('website-content');

    if (matrixLoading && websiteContent) {
        // --- TIMING ADJUSTMENTS ---
        const initialWait = 3000; // 3 seconds (2.5 + 0.5)
        const fadeOutDuration = 500; // 0.5 seconds for matrix fade-out

        setTimeout(function() {
            // Start fade out of matrix loading screen
            matrixLoading.style.transition = `opacity ${fadeOutDuration}ms ease-in-out, visibility ${fadeOutDuration}ms ease-in-out`;
            matrixLoading.style.opacity = '0';
            matrixLoading.style.visibility = 'hidden'; // Use visibility for accessibility

            // Stop the matrix drawing animation shortly after fade starts
            setTimeout(() => {
                 animationRunning = false; // Stop the draw loop
                 if (matrixInterval) {
                    clearInterval(matrixInterval);
                    matrixInterval = null;
                    console.log("Matrix animation drawing stopped.");
                 }
            }, fadeOutDuration / 2); // Stop drawing halfway through fade

            // Show website content ALMOST IMMEDIATELY after the fade-out *finishes*
            setTimeout(function() {
                matrixLoading.style.display = 'none'; // Remove from layout after fade
                websiteContent.classList.remove('hidden'); // Make it part of layout

                // Use requestAnimationFrame for smoother transition start
                requestAnimationFrame(() => {
                    websiteContent.classList.add('visible'); // Trigger CSS fade-in
                    if(document.body) document.body.style.overflow = 'auto'; // Enable scroll
                    document.title = "PantherSwarm"; // Update title
                });

            }, fadeOutDuration); // Wait exactly for the fade-out duration

        }, initialWait); // Start the whole sequence after 3 seconds

    } else {
        console.error("Matrix Error: Could not find #matrix-loading or #website-content for transition.");
        // Fallback if elements are missing
        if(websiteContent) {
             websiteContent.classList.remove('hidden');
             websiteContent.classList.add('visible');
             if(document.body) document.body.style.overflow = 'auto';
        }
        if (matrixLoading) matrixLoading.style.display = 'none';
        if (matrixInterval) { // Ensure animation stops in fallback too
            animationRunning = false;
            clearInterval(matrixInterval);
        }
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        const currentCanvas = document.getElementById('matrix-canvas');
        if (!currentCanvas || !animationRunning) return; // Don't resize if animation stopped
        const currentCtx = currentCanvas.getContext('2d');
        if (!currentCtx) return;

        currentCanvas.width = window.innerWidth;
        currentCanvas.height = window.innerHeight;
        const newColumns = Math.ceil(currentCanvas.width / fontSize);
        drops.length = 0; // Clear drops
         for (let i = 0; i < newColumns; i++) {
             drops[i] = Math.random() * -currentCanvas.height / fontSize;
         }
    });
});
