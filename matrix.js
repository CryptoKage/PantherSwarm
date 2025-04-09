document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) {
        // ... (error handling as before) ...
        return;
    }
    // ... (canvas setup, matrixChars, fontSize, columns as before) ...
    const drops = [];
    // ... (initialize drops as before) ...

    let matrixInterval = null;
    let animationRunning = true;
    let drawIntervalMs = 40; // Initial speed
    let backgroundOpacity = 0.1; // Target opacity for background effect
    let matrixFadeFactor = 0.05; // Initial fade factor

    function draw() {
        if (!animationRunning) return; // Still useful if we need to pause

        // Use the current fade factor
        ctx.fillStyle = `rgba(0, 0, 0, ${matrixFadeFactor})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#33A1FF'; // Tech Blue
        ctx.font = fontSize + 'px monospace';

        // ... (drawing drops logic as before) ...
        for (let i = 0; i < drops.length; i++) {
            const text = matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }

    function startAnimation() {
        if (!matrixInterval) {
            matrixInterval = setInterval(draw, drawIntervalMs);
        }
    }

    function transitionToBackgroundAnimation() {
        console.log("Matrix: Transitioning to background mode.");
        // 1. Slow down the animation significantly
        drawIntervalMs = 150; // Slower redraw rate (e.g., 150ms)
        // 2. Increase fade factor (characters disappear faster)
        matrixFadeFactor = 0.10; // Or 0.15
        // 3. Apply final background opacity via CSS class or direct style
        if (matrixLoading) {
           matrixLoading.style.opacity = backgroundOpacity; // Set the subtle opacity
        }

        // Clear the old interval and start with the new speed
        if (matrixInterval) {
            clearInterval(matrixInterval);
            matrixInterval = null;
        }
        startAnimation(); // Restart with new drawIntervalMs
    }


    const matrixLoading = document.getElementById('matrix-loading');
    const websiteContent = document.getElementById('website-content');

    if (matrixLoading && websiteContent) {
        const initialWait = 3000;
        const fadeOutDuration = 500; // Duration for the initial loading fade (opacity 1 to target opacity)

        // Start the initial fast animation
        startAnimation();

        setTimeout(function() {
            // Start fade out of the matrix overlay effect
            // We fade its OPACITY down to the target backgroundOpacity value
            matrixLoading.style.transition = `opacity ${fadeOutDuration}ms ease-in-out`;
            matrixLoading.style.opacity = backgroundOpacity; // Fade to subtle background opacity


            // --- CHANGE: Don't stop drawing, transition to slower mode ---
            // Schedule the transition *after* the fade completes
            setTimeout(transitionToBackgroundAnimation, fadeOutDuration);

            // Show website content ALMOST IMMEDIATELY after the fade-out *starts*
             // (Content fade-in should start as matrix fades back)
            websiteContent.classList.remove('hidden'); // Make it part of layout

            requestAnimationFrame(() => {
                websiteContent.classList.add('visible'); // Trigger CSS fade-in for content
                if(document.body) document.body.style.overflow = 'auto'; // Enable scroll
                document.title = "PantherSwarm";
            });
             // NOTE: We no longer set matrixLoading display:none or visibility:hidden

        }, initialWait);

    } else {
        // ... (error handling and fallback as before, ensure animation stops if canvas fails) ...
        if (matrixInterval) {
            animationRunning = false;
            clearInterval(matrixInterval);
        }
    }

    // ... (window resize handler as before - ensure it uses current canvas dimensions and potentially adjusts drops based on newColumns) ...
     window.addEventListener('resize', function() {
        // ... (resize logic needs to ensure it works correctly when animation is ongoing) ...
        // It should re-calculate columns and reset drops as before.
         const currentCanvas = document.getElementById('matrix-canvas');
         if (!currentCanvas || !ctx) return;

         currentCanvas.width = window.innerWidth;
         currentCanvas.height = window.innerHeight;
         const newColumns = Math.ceil(currentCanvas.width / fontSize);
         // Recalculate drops array size and randomize positions
         drops.length = 0;
         for (let i = 0; i < newColumns; i++) {
             drops[i] = Math.random() * -currentCanvas.height / fontSize;
         }
         // No need to restart interval if it's already running at the slow background speed
    });
});
