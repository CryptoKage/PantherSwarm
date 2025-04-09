document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('matrix-canvas');
    const matrixLoading = document.getElementById('matrix-loading');
    const websiteContent = document.getElementById('website-content');

    // --- Basic Fallback ---
    function showContentImmediately() {
        console.warn("Matrix Fallback: Showing content immediately.");
        if (matrixLoading) {
            matrixLoading.style.display = 'none'; // Hide canvas container
        }
        if (websiteContent) {
            websiteContent.classList.remove('hidden'); // Remove display:none
            websiteContent.classList.add('visible');   // Trigger fade-in (if CSS is loaded)
            if (document.body) document.body.style.overflow = 'auto'; // Allow scroll
            document.title = "PantherSwarm";
        }
    }

    if (!canvas || !matrixLoading || !websiteContent) {
        console.error("Matrix Error: Essential elements (canvas, loading container, or content) not found.");
        showContentImmediately();
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Matrix Error: Could not get 2D context.");
        showContentImmediately();
        return;
    }

    // --- Animation Setup ---
    let animationFrameId = null; // Use requestAnimationFrame
    let lastTimestamp = 0;
    let animationRunning = true;
    let columns = 10; // Initial value, recalculate on resize
    const fontSize = 16;
    const matrixChars = "0 1 $ P U R T A R D I O アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン";
    const drops = [];

    // Configurable parameters
    let drawIntervalTargetMs = 40; // Target interval for frame drawing (initial)
    let backgroundOpacity = 0.08; // Target opacity for background effect (adjust as needed)
    let matrixFadeFactor = 0.05;  // Trail effect (initial)

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        columns = Math.ceil(canvas.width / fontSize);
        drops.length = 0; // Clear drops array
        for (let i = 0; i < columns; i++) {
            // Initialize drops at random negative heights to stagger start
            drops[i] = Math.random() * -canvas.height / fontSize;
        }
        // Redraw immediately after resize if running
        // if (animationRunning) draw(performance.now()); // Optional immediate redraw
    }

    function draw(timestamp) {
        if (!animationRunning) return;

        // Calculate delta time for consistent speed if needed, or use interval logic
        const deltaTime = timestamp - lastTimestamp;

        // Limit draw frequency based on target interval
        if (deltaTime >= drawIntervalTargetMs) {
            lastTimestamp = timestamp;

            // Draw fade effect (background)
            ctx.fillStyle = `rgba(0, 0, 0, ${matrixFadeFactor})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Set text style for drops
            ctx.fillStyle = '#33A1FF'; // Tech Blue
            ctx.font = fontSize + 'px monospace';

            // Draw the drops
            for (let i = 0; i < drops.length; i++) {
                const text = matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                // Reset drop randomly or if it goes off screen
                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++; // Move drop down
            }
        }

        // Request next frame
        animationFrameId = requestAnimationFrame(draw);
    }

    function startAnimation() {
        console.log("Matrix: Starting animation.");
        animationRunning = true;
        lastTimestamp = performance.now(); // Initialize timestamp
        if (animationFrameId) cancelAnimationFrame(animationFrameId); // Clear previous frame
        animationFrameId = requestAnimationFrame(draw); // Start loop
    }

    function stopAnimation() {
        console.log("Matrix: Stopping animation drawing.");
        animationRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function transitionToBackground() {
        console.log("Matrix: Transitioning to background mode.");
        // 1. Slow down target draw rate
        drawIntervalTargetMs = 150; // e.g., 150ms interval target
        // 2. Increase fade factor for faster character fade
        matrixFadeFactor = 0.10; // e.g., 0.10 or 0.15
        // 3. Apply final background opacity and layering via CSS class
        matrixLoading.style.opacity = backgroundOpacity; // Set target opacity
        matrixLoading.classList.add('background-mode'); // Add class for z-index etc.

        // Animation loop continues via requestAnimationFrame, slowdown happens naturally
    }

    // --- Initialization ---
    resizeCanvas(); // Initial setup
    window.addEventListener('resize', resizeCanvas); // Handle resize

    // --- Loading Sequence ---
    const initialWait = 2500; // 2.5 seconds
    const fadeToBgDuration = 500; // 0.5 seconds for initial fade

    // Start the fast animation
    startAnimation();

    // Set timeout for the transition
    setTimeout(() => {
        // Start fading the loading container to the target background opacity
        console.log("Matrix: Fading to background opacity.");
        matrixLoading.style.transition = `opacity ${fadeToBgDuration}ms ease-in-out`; // Ensure transition is set
        matrixLoading.style.opacity = backgroundOpacity; // Start fading to target opacity

        // After the fade duration, switch parameters and CSS class
        setTimeout(() => {
            transitionToBackground();
        }, fadeToBgDuration);

        // Reveal website content slightly before the fade fully finishes
        setTimeout(() => {
            console.log("Matrix: Revealing website content.");
            websiteContent.classList.remove('hidden'); // Remove display:none
            // Use another short delay before triggering opacity transition for smoother effect
             requestAnimationFrame(() => {
                 websiteContent.classList.add('visible'); // Trigger CSS opacity fade-in
                 if(document.body) document.body.style.overflow = 'auto'; // Enable scroll
                 document.title = "PantherSwarm"; // Set final title
             });
        }, fadeToBgDuration / 2); // Reveal content halfway through matrix fade

    }, initialWait);

});
