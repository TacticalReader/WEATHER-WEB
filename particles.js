function createSparks(x, y) {
    const count = 8;
    for (let i = 0; i < count; i++) {
        const spark = document.createElement('div');
        spark.classList.add('spark');
        document.body.appendChild(spark);
        
        const angle = (i / count) * 360;
        const velocity = 20 + Math.random() * 20;
        
        spark.style.left = `${x}px`;
        spark.style.top = `${y}px`;
        spark.style.transform = `rotate(${angle}deg) translate(0px)`;
        
        // Animate
        spark.animate([
            { transform: `rotate(${angle}deg) translate(0px) scale(1)`, opacity: 1 },
            { transform: `rotate(${angle}deg) translate(${velocity}px) scale(0)`, opacity: 0 }
        ], {
            duration: 500,
            easing: 'cubic-bezier(0, .9, .57, 1)',
        }).onfinish = () => spark.remove();
    }
}
