/**
 * VOID-core.js
 * 文章列表页：加载索引、搜索、跳转至独立阅读页
 */
(function() {
    'use strict';

    const container = document.getElementById('articleContainer');
    const searchInput = document.getElementById('searchInput');
    const brandTitle = document.getElementById('brandTitle');
    const pwOverlay = document.getElementById('pwOverlay');
    const pwInput = document.getElementById('pwInput');
    const pwConfirm = document.getElementById('pwConfirm');
    const pwCancel = document.getElementById('pwCancel');

    let allArticles = [];
    let filteredArticles = [];

    const HIDDEN_PASSWORD = '纳西妲天下第一可爱';
    const TOKEN_KEY = 'voidHiddenToken';
    const TOKEN_EXPIRE_KEY = 'voidHiddenExpire';

    function showToast(msg, duration) {
        if (window.showVoidToast) {
            window.showVoidToast(msg, duration);
        } else {
            alert(msg);
        }
    }

    function getHiddenToken() {
        try {
            const token = localStorage.getItem(TOKEN_KEY);
            const expire = localStorage.getItem(TOKEN_EXPIRE_KEY);
            if (!token || !expire) return false;
            if (Date.now() > parseInt(expire)) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(TOKEN_EXPIRE_KEY);
                return false;
            }
            return token === 'true';
        } catch { return false; }
    }

    function setHiddenToken() {
        try {
            localStorage.setItem(TOKEN_KEY, 'true');
            localStorage.setItem(TOKEN_EXPIRE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
        } catch (e) { /* ignore */ }
    }

    // ========== 加载索引 ==========
    function loadIndex() {
        container.innerHTML = '<div class="void-empty">⏳ 加载索引...</div>';
        const url = 'VOID/index.txt?t=' + Date.now();
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('索引文件不存在 (HTTP ' + res.status + ')');
                return res.text();
            })
            .then(text => {
                const lines = text.split('\n');
                const articles = [];
                for (let raw of lines) {
                    raw = raw.trim();
                    if (!raw) continue;
                    let hidden = false;
                    let line = raw;
                    if (line.startsWith('#')) {
                        hidden = true;
                        line = line.substring(1).trim();
                    }
                    if (!line) continue;
                    // 解析简介：| 之后
                    let desc = '';
                    const barIdx = line.lastIndexOf('|');
                    if (barIdx !== -1) {
                        desc = line.substring(barIdx + 1).trim();
                        line = line.substring(0, barIdx).trim();
                    }
                    // 解析自定义标题：' -' 之后
                    let title = '';
                    const dashIdx = line.indexOf(' -');
                    if (dashIdx !== -1) {
                        title = line.substring(dashIdx + 2).trim();
                        line = line.substring(0, dashIdx).trim();
                    }
                    const filename = line;
                    if (!filename) continue;
                    if (!title) title = filename.replace(/\.md$/i, '').trim();
                    if (!title) continue;
                    articles.push({
                        filename: filename,
                        title: title,
                        desc: desc,
                        hidden: hidden,
                    });
                }
                allArticles = articles;

                const tokenOk = getHiddenToken();
                let visible = allArticles;
                if (!tokenOk) {
                    visible = allArticles.filter(a => !a.hidden);
                }
                filteredArticles = visible.slice();
                renderArticles(filteredArticles);
            })
            .catch(err => {
                container.innerHTML = `<div class="void-empty">❌ 加载失败：${err.message}</div>`;
                showToast('❌ 索引加载失败');
            });
    }

    // ========== 渲染卡片 ==========
    function renderArticles(articles) {
        if (!articles || articles.length === 0) {
            container.innerHTML = '<div class="void-empty">📭 没有找到文章</div>';
            return;
        }

        let html = '';
        for (const art of articles) {
            const hiddenBadge = art.hidden ? '<span class="badge hidden-badge">🔒 隐藏</span>' : '';
            const descHtml = art.desc ? `<div class="card-desc">${art.desc}</div>` : '';
            html += `
                <div class="article-card" data-filename="${art.filename}">
                    <div class="card-title">
                        ${art.title}
                        ${hiddenBadge}
                    </div>
                    ${descHtml}
                    <div class="card-meta">${art.filename}</div>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    // ========== 卡片点击 → 跳转独立页 ==========
    container.addEventListener('click', function(e) {
        const card = e.target.closest('.article-card');
        if (!card) return;
        const filename = card.dataset.filename;
        if (filename) {
            // 传完整路径（VOID/ 前缀），article.html 亦兼容纯文件名
            window.location.href = 'article.html?file=' + encodeURIComponent('VOID/' + filename);
        }
    });

    // ========== 搜索过滤 ==========
    function filterArticles(keyword) {
        keyword = keyword.trim().toLowerCase();
        if (!keyword) {
            const tokenOk = getHiddenToken();
            let visible = allArticles;
            if (!tokenOk) {
                visible = allArticles.filter(a => !a.hidden);
            }
            filteredArticles = visible.slice();
            renderArticles(filteredArticles);
            return;
        }
        const tokenOk = getHiddenToken();
        let candidates = allArticles;
        if (!tokenOk) {
            candidates = allArticles.filter(a => !a.hidden);
        }
        const matched = candidates.filter(a =>
            a.title.toLowerCase().includes(keyword) ||
            (a.desc && a.desc.toLowerCase().includes(keyword))
        );
        filteredArticles = matched;
        renderArticles(filteredArticles);
    }

    // ========== 密码弹窗 ==========
    let clickCount = 0;
    let clickTimer = null;

    function openPasswordDialog() {
        pwOverlay.classList.add('active');
        pwInput.value = '';
        pwInput.focus();
    }

    function closePasswordDialog() {
        pwOverlay.classList.remove('active');
    }

    function handlePasswordConfirm() {
        const input = pwInput.value.trim();
        if (!input) {
            showToast('请输入密码');
            return;
        }
        if (input === HIDDEN_PASSWORD) {
            setHiddenToken();
            closePasswordDialog();
            showToast('✅ 解锁成功！刷新页面显示隐藏文章', 3000);
            loadIndex();
        } else {
            showToast('❌ 密码错误');
            pwInput.value = '';
            pwInput.focus();
        }
    }

    brandTitle.addEventListener('click', function() {
        clickCount++;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 800);
        if (clickCount >= 5) {
            clickCount = 0;
            clearTimeout(clickTimer);
            if (getHiddenToken()) {
                showToast('🔓 隐藏文章已解锁，无需重复操作');
            } else {
                openPasswordDialog();
            }
        }
    });

    pwConfirm.addEventListener('click', handlePasswordConfirm);
    pwCancel.addEventListener('click', closePasswordDialog);
    pwInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handlePasswordConfirm();
        if (e.key === 'Escape') closePasswordDialog();
    });
    pwOverlay.addEventListener('click', function(e) {
        if (e.target === pwOverlay) closePasswordDialog();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && pwOverlay.classList.contains('active')) {
            closePasswordDialog();
        }
    });

    let searchTimer = null;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        const keyword = this.value;
        searchTimer = setTimeout(() => {
            filterArticles(keyword);
        }, 300);
    });

    function init() {
        loadIndex();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();