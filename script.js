// ============================================================
// 打字机特效：将 .typing-title 内的文本拆分为字符逐个下落
// ============================================================
(function() {
    'use strict';

    const titleElements = document.querySelectorAll('.typing-title');

    titleElements.forEach(function(el) {
        const text = el.textContent.trim();
        if (!text) return;

        // 清空原有文本，准备逐个字符
        el.innerHTML = '';

        // 将文本拆分为字符数组（支持 emoji 等）
        const chars = [...text];

        // 为每个字符创建 span，并设置延迟
        chars.forEach(function(char, index) {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = char;
            // 每个字符延迟递增 0.05s，形成从左到右依次下落
            span.style.animationDelay = (index * 0.05) + 's';
            el.appendChild(span);
        });

        // 添加一个光标（可选）
        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        el.appendChild(cursor);
    });

})();
// ============================================================
// 3D 卡片倾斜特效（鼠标/触摸）
// ============================================================
(function() {
    'use strict';

    const cards = document.querySelectorAll('.card-3d');
    if (!cards.length) return;

    function handleMove(e, card) {
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let clientX, clientY;
        if (e.type.startsWith('touch')) {
            const touch = e.touches[0];
            if (!touch) return;
            clientX = touch.clientX;
            clientY = touch.clientY;
            e.preventDefault();
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const deltaX = (clientX - centerX) / rect.width;
        const deltaY = (clientY - centerY) / rect.height;

        const maxRotate = 8;
        const rotateX = -deltaY * maxRotate;
        const rotateY = deltaX * maxRotate;

        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }

    function handleLeave(card) {
        card.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => handleMove(e, card));
        card.addEventListener('mouseleave', () => handleLeave(card));

        card.addEventListener('touchmove', (e) => handleMove(e, card), { passive: false });
        card.addEventListener('touchend', () => handleLeave(card));
        card.addEventListener('touchcancel', () => handleLeave(card));
    });

})();