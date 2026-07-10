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