/**
 * 🍀 妲那给木 · 视觉小说引擎 v1.0.4
 * - 修复首页UI不显示问题（强制重置显示状态）
 * - 台本请求增加时间戳防止缓存
 */
const DLGM = (function() {
    'use strict';

    // ... 所有变量和辅助函数保持不变（包括 parseScript, findLabel, jumpToLabel, updateCharacter, removeCharacter, setSpeaking, startTyping, stopTyping 等） ...

    // 由于代码较长，此处只列出修改部分，但最终提供完整文件。

    // ----- 修改 startGame 中的 fetch -----
    function startGame() {
        if (isPlaying) resetGame();

        // 确保进度条隐藏（防止残留）
        loadingOverlay.style.display = 'none';

        // 加入时间戳
        const timestamp = Date.now();
        fetch(`DLGM-Taiben.txt?t=${timestamp}`)
            .then(res => {
                if (!res.ok) throw new Error(`加载台本失败 (${res.status})`);
                return res.text();
            })
            .then(text => {
                scriptLines = parseScript(text);
                log(`台本解析完成，共 ${scriptLines.length} 条指令`);
                const imageUrls = collectImageUrls(scriptLines);
                log(`发现 ${imageUrls.length} 张图片需要预加载`);

                // 显示进度条（采用flex布局）
                loadingOverlay.style.display = 'flex';
                let loadProgress = 0;

                const loadPromise = preloadImages(imageUrls, (progress) => {
                    loadProgress = progress;
                    showLoading(progress);
                });

                let timeElapsed = 0;
                const startTime = Date.now();
                const totalDuration = 5000;

                function updateProgressBar() {
                    const elapsed = Date.now() - startTime;
                    const ratio = Math.min(elapsed / totalDuration, 1);
                    const combined = Math.max(loadProgress, ratio);
                    showLoading(combined);
                    if (elapsed < totalDuration) {
                        requestAnimationFrame(updateProgressBar);
                    } else {
                        loadPromise.then(() => {
                            hideLoading();
                            // 开始演出
                            currentIndex = 0;
                            isPlaying = true;
                            optionSelected = false;
                            charsContainer.innerHTML = '';
                            characters.clear();
                            conditions.clear();
                            stageBg.style.backgroundImage = 'none';
                            stageBg.style.backgroundColor = '#000';
                            optionsContainer.style.display = 'none';
                            dialogueBox.style.display = 'flex';
                            dialogueName.textContent = '';
                            dialogueText.textContent = '加载中……';
                            setTimeout(() => executeNext(), 300);
                        }).catch(() => {
                            hideLoading();
                            // 同样开始
                            currentIndex = 0;
                            isPlaying = true;
                            optionSelected = false;
                            charsContainer.innerHTML = '';
                            characters.clear();
                            conditions.clear();
                            stageBg.style.backgroundImage = 'none';
                            stageBg.style.backgroundColor = '#000';
                            optionsContainer.style.display = 'none';
                            dialogueBox.style.display = 'flex';
                            dialogueName.textContent = '';
                            dialogueText.textContent = '加载中……';
                            setTimeout(() => executeNext(), 300);
                        });
                    }
                }
                updateProgressBar();
            })
            .catch(err => {
                console.error('启动失败:', err);
                alert('无法加载台本文件，请确保 DLGM-Taiben.txt 存在。');
                // 错误时也要隐藏进度条
                hideLoading();
            });
    }

    // 其他函数不变（showLoading, hideLoading 等）
    // 注意：hideLoading 设置 display = 'none'

    function showLoading(progress) {
        const percent = Math.round(progress * 100);
        loadingFill.style.width = percent + '%';
        loadingText.textContent = `加载中… ${percent}%`;
    }

    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    // 确保 resetGame 中调用 hideLoading()
    function resetGame() {
        // ... 原有重置代码 ...
        hideLoading();
        // ...
    }

    // 对外接口不变
    return { startGame, resetGame };
})();