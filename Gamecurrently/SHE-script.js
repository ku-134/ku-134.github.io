/* ========================================
   SHE-script.js — 独立游戏逻辑
   序章剧情：蛇出场 → 三段对话 → 选择
   ======================================== */

(function() {
    'use strict';

    // ---------- DOM 引用 ----------
    const screen = document.getElementById('gameScreen');
    const startPrompt = document.getElementById('startPrompt');
    const snakeContainer = document.getElementById('snakeContainer');
    const snake = document.getElementById('snake');
    const dialogueBox = document.getElementById('dialogueBox');
    const dialogueSpeaker = document.getElementById('dialogueSpeaker');
    const dialogueText = document.getElementById('dialogueText');
    const dialogueActionHint = document.getElementById('dialogueActionHint');
    const choiceBox = document.getElementById('choiceBox');
    const startBtn = document.getElementById('startBtn');

    // ---------- 工具函数 ----------
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 等待 A 键（键盘 J / Enter 或 点击 A 按钮）
    function waitForA() {
        return new Promise((resolve) => {
            const handler = (e) => {
                let key = e.key;
                // 键盘事件
                if (key === 'j' || key === 'J' || key === 'Enter') {
                    e.preventDefault();
                    cleanup();
                    resolve();
                }
            };
            const clickHandler = () => {
                cleanup();
                resolve();
            };
            const cleanup = () => {
                document.removeEventListener('keydown', handler);
                const aBtn = document.querySelector('.action-btn.a');
                if (aBtn) aBtn.removeEventListener('click', clickHandler);
                // 移除高亮
                document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active-key'));
            };
            document.addEventListener('keydown', handler);
            const aBtn = document.querySelector('.action-btn.a');
            if (aBtn) aBtn.addEventListener('click', clickHandler);
            // 激活提示
            dialogueActionHint.classList.add('active');
        });
    }

    // 打字机效果（支持 HTML 标签）
    function typeText(element, html, speed = 50) {
        return new Promise((resolve) => {
            element.innerHTML = '';
            // 将 HTML 拆分为字符和标签的混合数组
            const chars = [];
            let i = 0;
            while (i < html.length) {
                if (html[i] === '<') {
                    let j = html.indexOf('>', i);
                    if (j === -1) break;
                    chars.push(html.substring(i, j + 1));
                    i = j + 1;
                } else {
                    chars.push(html[i]);
                    i++;
                }
            }

            let index = 0;
            // 添加抖动
            dialogueBox.classList.add('shaking');

            function typeNext() {
                if (index >= chars.length) {
                    dialogueBox.classList.remove('shaking');
                    resolve();
                    return;
                }
                const chunk = chars[index];
                // 如果是标签，直接追加（无延迟）
                if (chunk.startsWith('<')) {
                    element.innerHTML += chunk;
                    index++;
                    // 检查是否特殊标签，需要滚动到可见
                    typeNext();
                    return;
                }
                // 普通字符：包裹 span 实现下落动画
                const span = document.createElement('span');
                span.className = 'char';
                span.textContent = chunk;
                element.appendChild(span);
                index++;
                // 如果遇到 '.' 且是 '...' 中的点，稍微延迟
                let delay = speed;
                if (chunk === '.') {
                    // 检查上下文是否在 '...' 中，简单处理：如果后面还有两个点则延迟
                    if (index < chars.length && chars[index] === '.' && index + 1 < chars.length && chars[index+1] === '.') {
                        delay = 450; // 0.45s 停顿
                    } else if (index < chars.length && chars[index] === '.') {
                        delay = 300;
                    }
                }
                // 滚动到最新字符
                element.scrollTop = element.scrollHeight;
                setTimeout(typeNext, delay);
            }

            typeNext();
        });
    }

    // ---------- 主流程 ----------
    async function startSequence() {
        // 1. 隐藏初始提示
        startPrompt.style.opacity = '0';
        await wait(400);
        startPrompt.style.display = 'none';

        // 2. 蛇从底部弹出
        snakeContainer.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        snakeContainer.style.transform = 'translate(-50%, 100%) scale(1)';
        // 强制回流后移入中央
        await wait(50);
        snakeContainer.style.transform = 'translate(-50%, -50%) scale(1)';
        await wait(600);

        // 3. 与玩家对视，缓慢放大 (2s)
        snake.style.transition = 'transform 2s cubic-bezier(0.34, 1.56, 0.64, 1)';
        snake.style.transform = 'scale(1.5)';
        await wait(2000);

        // 4. 0.1s 移动到中上部并缩小回原大小
        snake.style.transition = 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        snake.style.transform = 'scale(1)';
        snakeContainer.style.transition = 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        snakeContainer.style.transform = 'translate(-50%, -80%) scale(1)';
        await wait(150);

        // 5. 显示对话框（展开出现）
        dialogueBox.style.display = 'block';
        dialogueBox.classList.remove('hide');
        dialogueBox.classList.add('show');
        dialogueBox.style.opacity = '1';
        dialogueBox.style.transform = 'scaleX(1)';
        dialogueBox.classList.remove('red-flash');
        dialogueActionHint.classList.remove('active');

        // ---------- 对话 1 ----------
        dialogueSpeaker.textContent = '？？？';
        await typeText(dialogueText, '你好');
        await wait(1000); // 显示完后等待1s
        // 激活 A 按钮
        await waitForA();
        dialogueActionHint.classList.remove('active');

        // ---------- 对话 2 ----------
        // 开始蛇的红光闪烁
        snake.classList.add('red-glow');

        const text2 = '你不用知道我是谁。我会赐予你<span class="shaky-text">「暴食」</span>的权能，用于应对外面的那个<span class="big-baddie">大家伙</span>。';
        await typeText(dialogueText, text2, 40);
        // 停止蛇的红光
        snake.classList.remove('red-glow');

        // 对话框变红 0.5s 后恢复
        dialogueBox.classList.add('red-flash');
        await wait(500);
        dialogueBox.classList.remove('red-flash');

        await waitForA();
        dialogueActionHint.classList.remove('active');

        // ---------- 对话 3 ----------
        // 特殊处理 "你...（停顿0.5s）想现在就试试吗？"
        dialogueText.innerHTML = '';
        await typeText(dialogueText, '你');
        await wait(300);
        // 追加 "..."
        const span1 = document.createElement('span');
        span1.className = 'char';
        span1.textContent = '.';
        dialogueText.appendChild(span1);
        await wait(500);
        const span2 = document.createElement('span');
        span2.className = 'char';
        span2.textContent = '.';
        dialogueText.appendChild(span2);
        await wait(300);
        // 追加剩余
        await typeText(dialogueText, '想现在就试试吗？', 40);

        await waitForA();
        dialogueActionHint.classList.remove('active');

        // ---------- 对话框消失（收缩 + 渐影 0.3s） ----------
        dialogueBox.classList.remove('show');
        dialogueBox.classList.add('hide');
        await wait(350);
        dialogueBox.style.display = 'none';

        // ---------- 显示选择对话框 ----------
        choiceBox.style.display = 'block';
        choiceBox.classList.remove('hide');
        choiceBox.classList.add('show');

        // 等待选择
        const choice = await new Promise((resolve) => {
            const btns = choiceBox.querySelectorAll('.choice-btn');
            const handler = (e) => {
                const val = e.currentTarget.dataset.choice;
                btns.forEach(b => b.removeEventListener('click', handler));
                resolve(val);
            };
            btns.forEach(b => b.addEventListener('click', handler));
        });

        // 选择后，选择框消失
        choiceBox.classList.remove('show');
        choiceBox.classList.add('hide');
        await wait(350);
        choiceBox.style.display = 'none';

        // ---------- 蛇消失（由于后面部分没做） ----------
        snakeContainer.style.transition = 'transform 0.5s ease-in';
        snakeContainer.style.transform = 'translate(-50%, 100%) scale(0.5)';
        await wait(500);
        snakeContainer.style.display = 'none';

        // 显示占位提示（可选）
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:rgba(255,255,255,0.2); font-size:1rem; z-index:5;';
        placeholder.textContent = '✨ 序章结束 · 游戏开发中 ✨';
        screen.appendChild(placeholder);
    }

    // ---------- 启动触发器 ----------
    function init() {
        // 监听 START 按钮
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                if (startPrompt.style.display !== 'none') {
                    startSequence();
                }
            });
        }
        // 键盘 Enter 触发
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && startPrompt.style.display !== 'none') {
                e.preventDefault();
                startSequence();
            }
        });
        // 也支持点击画面（如果显示提示）
        screen.addEventListener('click', () => {
            if (startPrompt.style.display !== 'none') {
                startSequence();
            }
        });
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();