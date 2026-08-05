/**
 * VOID-core.js
 * 文章页核心逻辑（瀑布加载 + 隐藏策略）
 * 依赖 marked.js
 */
(function() {
    'use strict';

    // ========== DOM 引用 ==========
    const container = document.getElementById('articleContainer');
    const searchInput = document.getElementById('searchInput');
    const brandTitle = document.getElementById('brandTitle');
    const pwOverlay = document.getElementById('pwOverlay');
    const pwInput = document.getElementById('pwInput');
    const pwConfirm = document.getElementById('pwConfirm');
    const pwCancel = document.getElementById('pwCancel');

    // ========== 状态 ==========
    let allArticles = [];          // 原始文章对象数组
    let filteredArticles = [];     // 当前搜索结果
    let observer = null;           // IntersectionObserver 实例
    let loadedBodies = {};         // 缓存已加载的正文 { filename: html }

    const HIDDEN_PASSWORD = '纳西妲天下第一可爱';
    const TOKEN_KEY = 'voidHiddenToken';
    const TOKEN_EXPIRE_KEY = 'voidHiddenExpire';

    // ========== 工具函数 ==========
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
            return token === 'true'; // 简单令牌，只存标志
        } catch { return false; }
    }

    function setHiddenToken() {
        try {
            localStorage.setItem(TOKEN_KEY, 'true');
            localStorage.setItem(TOKEN_EXPIRE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
        } catch (e) { /* ignore */ }
    }

    function clearHiddenToken() {
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(TOKEN_EXPIRE_KEY);
        } catch (e) { /* ignore */ }
    }

    // ========== 数据加载 ==========
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
                let hasHidden = false;
                for (let raw of lines) {
                    raw = raw.trim();
                    if (!raw) continue;
                    let hidden = false;
                    let filename = raw;
                    if (raw.startsWith('#')) {
                        hidden = true;
                        filename = raw.substring(1).trim();
                        hasHidden = true;
                    }
                    if (!filename) continue;
                    // 提取标题（去掉 .md）
                    let title = filename.replace(/\.md$/i, '').trim();
                    if (!title) continue;
                    articles.push({
                        filename: filename,
                        title: title,
                        hidden: hidden,
                        loaded: false,    // 正文是否已加载
                        bodyHtml: null,
                    });
                }
                allArticles = articles;

                // 检查隐藏令牌
                const tokenOk = getHiddenToken();
                if (!tokenOk && hasHidden) {
                    // 有隐藏文章但未解锁，提示
                    // 但仍可显示普通文章
                }
                // 过滤隐藏文章：若未解锁，则过滤掉 hidden=true 的条目
                let visible = allArticles;
                if (!tokenOk) {
                    visible = allArticles.filter(a => !a.hidden);
                }
                // 若已解锁，显示全部，但隐藏文章会带标记
                filteredArticles = visible.slice();
                renderArticles(filteredArticles);
                setupObserver();
                // 如果已解锁但有隐藏文章，显示一条提示
                if (tokenOk && hasHidden) {
                    showToast('🔓 隐藏文章已解锁（有效期至明天）', 3000);
                } else if (hasHidden && !tokenOk) {
                    showToast('🔒 有隐藏文章，连续点击标题 5 次解锁', 4000);
                }
            })
            .catch(err => {
                container.innerHTML = `<div class="void-empty">❌ 加载失败：${err.message}</div>`;
                showToast('❌ 索引加载失败');
            });
    }

    // ========== 渲染文章卡片 ==========
    function renderArticles(articles) {
        if (!articles || articles.length === 0) {
            container.innerHTML = '<div class="void-empty">📭 没有找到文章</div>';
            return;
        }

        let html = '';
        for (const art of articles) {
            const hiddenBadge = art.hidden ? '<span class="badge hidden-badge">🔒 隐藏</span>' : '';
            html += `
                <div class="article-card" data-filename="${art.filename}" data-loaded="false">
                    <div class="card-title">
                        ${art.title}
                        ${hiddenBadge}
                    </div>
                    <div class="card-meta">${art.filename}</div>
                    <div class="card-body" id="body-${art.filename.replace(/\./g, '_')}">
                        <div class="loading-placeholder">⏳ 滚动至此加载正文...</div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    // ========== 瀑布加载正文（IntersectionObserver） ==========
    function setupObserver() {
        if (observer) observer.disconnect();
        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const card = entry.target;
                    const filename = card.dataset.filename;
                    if (!filename) return;
                    const art = allArticles.find(a => a.filename === filename);
                    if (!art) return;
                    if (art.loaded) {
                        // 已加载，无需再次
                        return;
                    }
                    // 加载正文
                    loadBody(art, card);
                }
            });
        }, {
            rootMargin: '0px 0px 200px 0px' // 提前 200px 加载
        });

        // 观察所有卡片
        document.querySelectorAll('.article-card').forEach(card => {
            observer.observe(card);
        });
    }

    function loadBody(article, card) {
        if (article.loaded) return;
        const bodyId = 'body-' + article.filename.replace(/\./g, '_');
        const bodyEl = document.getElementById(bodyId);
        if (!bodyEl) return;

        // 显示加载占位
        bodyEl.innerHTML = '<div class="loading-placeholder">⏳ 加载中...</div>';

        const url = 'VOID/' + encodeURIComponent(article.filename) + '?t=' + Date.now();
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('加载失败 (HTTP ' + res.status + ')');
                return res.text();
            })
            .then(md => {
                // 渲染 Markdown
                const html = marked.parse(md);
                bodyEl.innerHTML = html;
                bodyEl.classList.add('loaded');
                article.loaded = true;
                article.bodyHtml = html;
                // 移除观察
                if (observer) observer.unobserve(card);
            })
            .catch(err => {
                bodyEl.innerHTML = `<div style="color:#e74c3c;">❌ 正文加载失败：${err.message}</div>`;
                bodyEl.classList.add('loaded');
                article.loaded = true; // 标记为已尝试，避免反复请求
                showToast('❌ 加载正文失败');
            });
    }

    // ========== 搜索过滤 ==========
    function filterArticles(keyword) {
        keyword = keyword.trim().toLowerCase();
        if (!keyword) {
            // 恢复可见性（依据令牌）
            const tokenOk = getHiddenToken();
            let visible = allArticles;
            if (!tokenOk) {
                visible = allArticles.filter(a => !a.hidden);
            }
            filteredArticles = visible.slice();
            renderArticles(filteredArticles);
            setupObserver();
            return;
        }
        // 搜索匹配标题（不区分大小写）
        const tokenOk = getHiddenToken();
        let candidates = allArticles;
        if (!tokenOk) {
            candidates = allArticles.filter(a => !a.hidden);
        }
        const matched = candidates.filter(a => a.title.toLowerCase().includes(keyword));
        filteredArticles = matched;
        renderArticles(filteredArticles);
        setupObserver();
    }

    // ========== 密码弹窗 ==========
    let clickCount = 0;
    let clickTimer = null;

    function openPasswordDialog() {
        pwOverlay.classList.add('active');
        pwInput.value = '';
        pwInput.focus();
        pwInput.disabled = false;
        pwConfirm.disabled = false;
        pwConfirm.textContent = '确认';
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
            // 刷新视图（重新加载索引，显示隐藏）
            loadIndex();
        } else {
            showToast('❌ 密码错误');
            pwInput.value = '';
            pwInput.focus();
        }
    }

    // ========== 连续点击标题事件 ==========
    brandTitle.addEventListener('click', function() {
        clickCount++;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 800);
        if (clickCount >= 5) {
            clickCount = 0;
            clearTimeout(clickTimer);
            // 检查是否已解锁，若已解锁则提示
            if (getHiddenToken()) {
                showToast('🔓 隐藏文章已解锁，无需重复操作');
            } else {
                openPasswordDialog();
            }
        }
    });

    // ====== 弹窗按钮事件 ======
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

    // ========== 搜索事件（防抖） ==========
    let searchTimer = null;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        const keyword = this.value;
        searchTimer = setTimeout(() => {
            filterArticles(keyword);
        }, 300);
    });

    // ========== 初始化 ==========
    function init() {
        loadIndex();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();