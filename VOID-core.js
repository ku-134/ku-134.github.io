/**
 * VOID-core.js
 * 文章列表页：加载索引（分类）、搜索、分类筛选、跳转至独立阅读页
 * 索引格式：文件名.md -文章名 +文章类型 | 简介
 *          # 文件名.md -文章名 +文章类型 | 简介 （# 前缀 = 隐藏）
 */
(function() {
    'use strict';

    const container = document.getElementById('articleContainer');
    const searchInput = document.getElementById('searchInput');
    const brandTitle = document.getElementById('brandTitle');
    const catBar = document.getElementById('categoryBar');
    const pwOverlay = document.getElementById('pwOverlay');
    const pwInput = document.getElementById('pwInput');
    const pwConfirm = document.getElementById('pwConfirm');
    const pwCancel = document.getElementById('pwCancel');

    let allArticles = [];
    let filteredArticles = [];
    let currentCategory = 'all';
    let currentKeyword = '';

    const HIDDEN_PASSWORD = '纳西妲天下第一可爱';
    const TOKEN_KEY = 'voidHiddenToken';
    const TOKEN_EXPIRE_KEY = 'voidHiddenExpire';

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '"')
            .replace(/'/g, '&#39;');
    }

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

    // ========== 解析单行索引 ==========
    // 顺序：| 简介 → + 分类 → - 标题 → 文件名
    function parseLine(raw) {
        let hidden = false;
        let line = raw.trim();
        if (!line) return null;
        if (line.startsWith('#')) {
            hidden = true;
            line = line.substring(1).trim();
        }
        if (!line) return null;
        // 简介：最后一个 | 之后
        let desc = '';
        const barIdx = line.lastIndexOf('|');
        if (barIdx !== -1) {
            desc = line.substring(barIdx + 1).trim();
            line = line.substring(0, barIdx).trim();
        }
        // 分类：最后一个 + 之后
        let category = '';
        const plusIdx = line.lastIndexOf('+');
        if (plusIdx !== -1) {
            category = line.substring(plusIdx + 1).trim();
            line = line.substring(0, plusIdx).trim();
        }
        // 标题：' -' 之后
        let title = '';
        const dashIdx = line.indexOf(' -');
        if (dashIdx !== -1) {
            title = line.substring(dashIdx + 2).trim();
            line = line.substring(0, dashIdx).trim();
        }
        const filename = line;
        if (!filename) return null;
        if (!title) title = filename.replace(/\.md$/i, '').trim();
        return { filename: filename, title: title, desc: desc, category: category, hidden: hidden };
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
                for (const raw of lines) {
                    const art = parseLine(raw);
                    if (art) articles.push(art);
                }
                allArticles = articles;
                renderCategoryBar();
                applyFilter();
            })
            .catch(err => {
                container.innerHTML = `<div class="void-empty">❌ 加载失败：${escapeHtml(err.message)}</div>`;
                showToast('❌ 索引加载失败');
            });
    }

    // ========== 分类栏 ==========
    function getVisibleCategories() {
        const tokenOk = getHiddenToken();
        const visible = tokenOk ? allArticles : allArticles.filter(a => !a.hidden);
        const cats = [];
        for (const a of visible) {
            if (a.category && cats.indexOf(a.category) === -1) cats.push(a.category);
        }
        return cats;
    }

    function renderCategoryBar() {
        const cats = getVisibleCategories();
        let html = '<button class="cat-btn" data-cat="all">全部</button>';
        for (const c of cats) {
            html += `<button class="cat-btn" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`;
        }
        // 隐藏是独立分类板块：有令牌才显示，且不与普通分类合并
        if (getHiddenToken()) {
            html += '<button class="cat-btn hidden-cat" data-cat="hidden">🔒 隐藏</button>';
        }
        catBar.innerHTML = html;

        // 当前选中态
        const cur = catBar.querySelector(`.cat-btn[data-cat="${CSS.escape(currentCategory)}"]`);
        if (cur) cur.classList.add('active');

        catBar.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentCategory = this.dataset.cat;
                catBar.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                applyFilter();
            });
        });
    }

    // ========== 过滤（分类 + 搜索） ==========
    function applyFilter() {
        const tokenOk = getHiddenToken();
        let list = allArticles;
        if (!tokenOk) list = list.filter(a => !a.hidden);
        // 分类：隐藏为独立板块，不与普通分类合并
        if (currentCategory === 'hidden') {
            list = list.filter(a => a.hidden);
        } else if (currentCategory !== 'all') {
            list = list.filter(a => !a.hidden && a.category === currentCategory);
        }
        // 搜索（标题/简介/分类）
        const kw = currentKeyword.trim().toLowerCase();
        if (kw) {
            list = list.filter(a =>
                a.title.toLowerCase().includes(kw) ||
                (a.desc && a.desc.toLowerCase().includes(kw)) ||
                (a.category && a.category.toLowerCase().includes(kw))
            );
        }
        filteredArticles = list;
        renderArticles(list);
    }

    // ========== 渲染卡片 ==========
    function renderArticles(articles) {
        if (!articles || articles.length === 0) {
            container.innerHTML = '<div class="void-empty">📭 没有找到文章</div>';
            return;
        }

        let html = '';
        for (const art of articles) {
            const catBadge = art.category
                ? `<span class="badge cat-badge">${escapeHtml(art.category)}</span>` : '';
            const hiddenBadge = art.hidden ? '<span class="badge hidden-badge">🔒 隐藏</span>' : '';
            const descHtml = art.desc ? `<div class="card-desc">${escapeHtml(art.desc)}</div>` : '';
            html += `
                <div class="article-card" data-filename="${escapeHtml(art.filename)}">
                    <div class="card-title">
                        ${escapeHtml(art.title)}
                        ${catBadge}
                        ${hiddenBadge}
                    </div>
                    ${descHtml}
                    <div class="card-meta">${escapeHtml(art.filename)}</div>
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
            window.location.href = 'article.html?file=' + encodeURIComponent('VOID/' + filename);
        }
    });

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
            showToast('🗝️ 请留下真名');
            return;
        }
        if (input === HIDDEN_PASSWORD) {
            setHiddenToken();
            closePasswordDialog();
            showToast('✨ 帷幕缓缓拉开……', 3000);
            loadIndex();
        } else {
            showToast('❌ 这个名字，门扉不予回应');
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
                showToast('🔓 帷幕之后的光景，您早已见证');
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
        currentKeyword = this.value;
        searchTimer = setTimeout(() => {
            applyFilter();
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