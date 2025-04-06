document.addEventListener('DOMContentLoaded', function() {
    // Matrix effect
    const canvas = document.getElementById('matrix-canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas to full window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Matrix characters
    const matrixChars = "01アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン";
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    
    // Set up the drops
    const drops = [];
    for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -100;
    }
    
    // Drawing the characters
    function draw() {
        // Black background with opacity
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Set color and font
        ctx.fillStyle = '#0f0';
        ctx.font = fontSize + 'px monospace';
        
        // Loop over drops
        for (let i = 0; i < drops.length; i++) {
            // Get random character
            const text = matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));
            
            // Draw the character
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            
            // Reset drop to top when it reaches bottom
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            
            // Move the drop down
            drops[i]++;
        }
    }
    
    // Animation loop
    const matrixInterval = setInterval(draw, 33);
    
    // After 5 seconds, fade out the matrix effect and show the website
    setTimeout(function() {
        // Fade out matrix loading screen
        const matrixLoading = document.getElementById('matrix-loading');
        matrixLoading.style.transition = 'opacity 2s ease-in-out';
        matrixLoading.style.opacity = '0';
        
        // Show website content after fade out
        setTimeout(function() {
            matrixLoading.style.display = 'none';
            const websiteContent = document.getElementById('website-content');
            websiteContent.classList.remove('hidden');
            setTimeout(() => websiteContent.classList.add('visible'), 50);
            
            // Stop the matrix animation
            clearInterval(matrixInterval);
        }, 2000);
    }, 5000);
    
    // Handle window resize
    window.addEventListener('resize', function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
});

