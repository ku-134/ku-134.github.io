/* ========================================
   SHE-script.js — 独立游戏逻辑（修复版）
   序章剧情：5段对话 + 键盘选择
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
    const choiceOptions = document.getElementById('choiceOptions');
    const choiceHint = document.getElementById('choiceHint');
    const startBtn = document.getElementById('startBtn');

    // ---------- 工具函数 ----------
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 等待 A 键（键盘 J / Enter 或 点击 A 按钮）
    function waitForA() {
        return new Promise((resolve) => {
            const handler = (e) => {
                let key = e.key;
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
                document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active-key'));
                dialogueActionHint.classList.remove('active');
            };
            document.addEventListener('keydown', handler);
            const aBtn = document.querySelector('.action-btn.a');
            if (aBtn) aBtn.addEventListener('click', clickHandler);
            dialogueActionHint.classList.add('active');
        });
    }

    // 打字机效果（支持 HTML 标签）
    function typeText(element, html, speed = 45) {
        return new Promise((resolve) => {
            element.innerHTML = '';
            // 解析 HTML 为字符 + 标签的数组
            const parts = [];
            let i = 0;
            while (i < html.length) {
                if (html[i] === '<') {
                    let j = html.indexOf('>', i);
                    if (j === -1) break;
                    parts.push(html.substring(i, j + 1));
                    i = j + 1;
                } else {
                    parts.push(html[i]);
                    i++;
                }
            }

            let index = 0;
            dialogueBox.classList.add('shaking');

            function typeNext() {
                if (index >= parts.length) {
                    dialogueBox.classList.remove('shaking');
                    resolve();
                    return;
                }
                const chunk = parts[index];
                if (chunk.startsWith('<')) {
                    element.innerHTML += chunk;
                    index++;
                    typeNext();
                    return;
                }
                const span = document.createElement('span');
                span.className = 'char';
                span.textContent = chunk;
                element.appendChild(span);
                index++;
                // 特殊标点停顿
                let delay = speed;
                if (chunk === '.' && index < parts.length && parts[index] === '.') {
                    delay = 450;
                } else if (chunk === '。' || chunk === '！' || chunk === '？') {
                    delay = 200;
                }
                setTimeout(typeNext, delay);
            }
            typeNext();
        });
    }

    // ---------- 主剧情 ----------
    async function startSequence() {
        // 1. 隐藏开始提示
        startPrompt.style.opacity = '0';
        await wait(400);
        startPrompt.style.display = 'none';

        // 2. 显示蛇，从底部弹出
        snakeContainer.style.display = 'block';
        snakeContainer.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        snakeContainer.style.transform = 'translate(-50%, 100%) scale(1)';
        await wait(50);
        snakeContainer.style.transform = 'translate(-50%, -50%) scale(1)';
        await wait(600);

        // 3. 对视，放大 (2s)
        snake.style.transition = 'transform 2s cubic-bezier(0.34, 1.56, 0.64, 1)';
        snake.style.transform = 'scale(1.5)';
        await wait(2000);

        // 4. 移到中上部，缩回原大小 (0.1s)
        snake.style.transition = 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        snake.style.transform = 'scale(1)';
        snakeContainer.style.transition = 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        snakeContainer.style.transform = 'translate(-50%, -75%) scale(1)';
        await wait(150);

        // 5. 显示对话框
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
        await waitForA();

        // ---------- 对话 2 ----------
        await typeText(dialogueText, '你不用知道我是谁。');
        await waitForA();

        // ---------- 对话 3（含特殊效果） ----------
        // 蛇红光闪烁
        snake.classList.add('red-glow');
        const text3 = '我会赐予你<span class="shaky-text">「暴食」</span>的权能，用于应对外面的那个<span class="big-baddie">大家伙</span>。';
        await typeText(dialogueText, text3, 40);
        snake.classList.remove('red-glow');

        // 对话框变红 0.5s 后恢复
        dialogueBox.classList.add('red-flash');
        await wait(500);
        dialogueBox.classList.remove('red-flash');

        await waitForA();

        // ---------- 对话 4：“你...” (带停顿) ----------
        dialogueText.innerHTML = '';
        await typeText(dialogueText, '你');
        await wait(300);
        // 手动添加三个点，每个点延迟
        for (let i = 0; i < 3; i++) {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = '.';
            dialogueText.appendChild(span);
            await wait(i === 2 ? 300 : 500);
        }
        await waitForA();

        // ---------- 对话 5 ----------
        await typeText(dialogueText, '想现在就试试吗？', 40);
        await waitForA();

        // ---------- 对话框消失 ----------
        dialogueBox.classList.remove('show');
        dialogueBox.classList.add('hide');
        await wait(350);
        dialogueBox.style.display = 'none';

        // ---------- 显示选择框 ----------
        choiceBox.style.display = 'block';
        choiceBox.classList.remove('hide');
        choiceBox.classList.add('show');

        // 选择逻辑：键盘上下选择，A 键确认
        const btns = choiceOptions.querySelectorAll('.choice-btn');
        let selectedIndex = 0;
        btns.forEach((btn, idx) => {
            btn.classList.toggle('selected', idx === 0);
            btn.dataset.index = idx;
        });

        const updateSelection = (dir) => {
            btns.forEach(b => b.classList.remove('selected'));
            selectedIndex = (selectedIndex + dir + btns.length) % btns.length;
            btns[selectedIndex].classList.add('selected');
        };

        const choicePromise = new Promise((resolve) => {
            const keyHandler = (e) => {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    updateSelection(-1);
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    updateSelection(1);
                } else if (e.key === 'j' || e.key === 'J' || e.key === 'Enter') {
                    e.preventDefault();
                    const selected = btns[selectedIndex].dataset.choice;
                    cleanup();
                    resolve(selected);
                }
            };
            const clickHandler = (e) => {
                const choice = e.currentTarget.dataset.choice;
                cleanup();
                resolve(choice);
            };
            const cleanup = () => {
                document.removeEventListener('keydown', keyHandler);
                btns.forEach(b => b.removeEventListener('click', clickHandler));
            };
            document.addEventListener('keydown', keyHandler);
            btns.forEach(b => b.addEventListener('click', clickHandler));
            // 高亮当前选项
            btns[selectedIndex].classList.add('selected');
        });

        const choice = await choicePromise;

        // ---------- 选择后消失 ----------
        choiceBox.classList.remove('show');
        choiceBox.classList.add('hide');
        await wait(350);
        choiceBox.style.display = 'none';

        // ---------- 蛇消失 ----------
        snakeContainer.style.transition = 'transform 0.5s ease-in';
        snakeContainer.style.transform = 'translate(-50%, 100%) scale(0.5)';
        await wait(500);
        snakeContainer.style.display = 'none';

        // 显示结束占位
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:rgba(255,255,255,0.2); font-size:clamp(0.8rem, 2vw, 1.2rem); z-index:5; text-align:center;';
        placeholder.textContent = '✨ 序章结束 · 游戏开发中 ✨';
        screen.appendChild(placeholder);

        // 根据选择可做后续分支，当前仅占位
        console.log('玩家选择了:', choice);
    }

    // ---------- 启动触发 ----------
    function init() {
        // 确保初始状态：提示可见，蛇和对话框隐藏
        startPrompt.style.display = 'block';
        startPrompt.style.opacity = '1';
        snakeContainer.style.display = 'none';
        dialogueBox.style.display = 'none';
        choiceBox.style.display = 'none';

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
        // 点击画面触发（仅当提示可见）
        screen.addEventListener('click', () => {
            if (startPrompt.style.display !== 'none') {
                startSequence();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();