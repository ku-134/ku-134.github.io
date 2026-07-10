// ============================================================
// 打字机特效：将 .typing-title 内的文本拆分为字符逐个下落
// ============================================================
(function() {
    'use strict';

    const titleElements = document.querySelectorAll('.typing-title');

    titleElements.forEach(function(el) {
        const text = el.textContent.trim();
        if (!text) return;

        el.innerHTML = '';

        const chars = [...text];

        chars.forEach(function(char, index) {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = char;
            span.style.animationDelay = (index * 0.05) + 's';
            el.appendChild(span);
        });

        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        el.appendChild(cursor);
    });

})();