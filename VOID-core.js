/**
 * VOID-core.js
 * 文章列表页：加载索引（双父级分类）、搜索、分类筛选、跳转至独立阅读页
 * 索引格式：文件名.md -文章名 +文章类型 | 简介
 *          # 文件名.md -文章名 +文章类型 | 简介 （# 前缀 = 隐藏）
 * 分类体系：公开 / 隐藏 为两个独立父级板块，+ 后为父级下的子分类；
 *          不同父级下即使子分类同名，也不归为同一分类。
 */
(function() {
    'use strict';

    const container = document.getElementById('articleContainer');
    const searchInput = document.getElementById('searchInput');
    const sortToggle = document.getElementById('sortToggle');
    let sortMode = 'alpha'; // alpha=按字母 | cat=按标签
    function getFavSet() {
        try { return new Set(JSON.parse(localStorage.getItem('voidFavs') || '[]')); }
        catch (e) { return new Set(); }
    }
    let favSet = getFavSet();
    const brandTitle = document.getElementById('brandTitle');
    const catBar = document.getElementById('categoryBar');
    const pwOverlay = document.getElementById('pwOverlay');
    const pwInput = document.getElementById('pwInput');
    const pwConfirm = document.getElementById('pwConfirm');
    const pwCancel = document.getElementById('pwCancel');

    let allArticles = [];
        let voidFiles = new Set();
        let voidFilesLoaded = false;
    let filteredArticles = [];
    // 父级：public（公开）/ hidden（隐藏）
    let currentParent = 'public';
    let currentCat = 'all';
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
                    // 系列数字文件（如 名1.md）不展示在列表，只从详情页进入
                    if (art && !/\d+\.md$/i.test(art.filename)) articles.push(art);
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

    // ========== 分类栏（父级切换 + 子分类） ==========
    // 未解锁：不显示任何父级字眼，直接展示公开子分类
    // 解锁后：在分类栏起始位置出现「公开/隐藏」切换按钮，不并列分组
    function getCatsByParent(parent) {
        const list = parent === 'hidden'
            ? allArticles.filter(a => a.hidden)
            : allArticles.filter(a => !a.hidden);
        const cats = [];
        for (const a of list) {
            if (a.category && cats.indexOf(a.category) === -1) cats.push(a.category);
        }
        return cats;
    }

    function renderCategoryBar() {
        const tokenOk = getHiddenToken();
        // 未解锁时强制公开父级
        if (!tokenOk && currentParent === 'hidden') {
            currentParent = 'public';
            currentCat = 'all';
        }
        let html = '';

        // 解锁后才出现父级切换按钮（单个，单击切换公开/隐藏）
        if (tokenOk) {
            const label = currentParent === 'public' ? '公开' : '隐藏';
            const next = currentParent === 'public' ? 'hidden' : 'public';
            html += `<button class="parent-btn active" data-parent="${next}" data-cur="${currentParent}" title="单击切换父级分类">⇄ ${label}</button>`;
        }

        // 当前父级下的子分类
        html += '<button class="cat-btn" data-cat="all">全部</button>';
        for (const c of getCatsByParent(currentParent)) {
            html += `<button class="cat-btn" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`;
        }

        catBar.innerHTML = html;

        // 恢复选中态
        const cur = catBar.querySelector(`.cat-btn[data-cat="${CSS.escape(currentCat)}"]`);
        if (cur) cur.classList.add('active');
        else {
            currentCat = 'all';
            const fallback = catBar.querySelector('.cat-btn[data-cat="all"]');
            if (fallback) fallback.classList.add('active');
        }

        // 子分类点击
        catBar.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentCat = this.dataset.cat;
                catBar.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                applyFilter();
            });
        });

        // 父级切换点击（切换后子分类重渲染）
        catBar.querySelectorAll('.parent-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentParent = this.dataset.parent;
                currentCat = 'all';
                renderCategoryBar();
                applyFilter();
            });
        });
    }

    // ========== 过滤（父级分类 + 搜索） ==========
    function applyFilter() {
        const tokenOk = getHiddenToken();
        let list = allArticles;
        if (!tokenOk) list = list.filter(a => !a.hidden);

        // 父级板块过滤：公开 / 隐藏 互不混同
        if (currentParent === 'hidden') {
            list = list.filter(a => a.hidden);
            // 子分类（隐藏父级下）
            if (currentCat !== 'all') list = list.filter(a => a.category === currentCat);
        } else {
            list = list.filter(a => !a.hidden);
            // 子分类（公开父级下）
            if (currentCat !== 'all') list = list.filter(a => a.category === currentCat);
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
        // 排序：收藏置顶 → 按标签 / 按字母
        list = list.slice().sort(function(a, b) {
            const sa = favSet.has(a.filename) ? 1 : 0;
            const sb = favSet.has(b.filename) ? 1 : 0;
            if (sa !== sb) return sb - sa;
            if (sortMode === 'cat') {
                const ca = a.category || '';
                const cb = b.category || '';
                if (ca !== cb) return ca.localeCompare(cb, 'zh');
            }
            return a.title.localeCompare(b.title, 'zh');
        });
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
            const seriesBadge = voidFilesLoaded && voidFiles.has(art.filename.replace(/\.md$/i, '') + '1.md')
                ? '<span class="badge series-badge">📚 系列</span>' : '';
            const starBadge = favSet.has(art.filename)
                ? '<span class="badge star-badge">⭐ 收藏</span>' : '';
            const descHtml = art.desc ? `<div class="card-desc">${escapeHtml(art.desc)}</div>` : '';
            html += `
                <div class="article-card" data-filename="${escapeHtml(art.filename)}">
                    <div class="card-title">
                        ${escapeHtml(art.title)}
                        ${catBadge}
                        ${hiddenBadge}
                        ${seriesBadge}
                        ${starBadge}
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

    sortToggle.addEventListener('click', function() {
        sortMode = sortMode === 'alpha' ? 'cat' : 'alpha';
        sortToggle.textContent = sortMode === 'alpha' ? '🔤 字母' : '🏷️ 标签';
        if (allArticles.length) applyFilter();
    });

    // 跨标签页同步收藏状态
    window.addEventListener('storage', function(e) {
        if (e.key === 'voidFavs') {
            favSet = getFavSet();
            if (allArticles.length) applyFilter();
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

    // ========== 加载 VOID/ 目录（用于系列判断） ==========
    function loadVoidFiles() {
        return fetch('https://api.github.com/repos/ku-134/ku-134.github.io/contents/VOID', {
            headers: { 'Accept': 'application/vnd.github+json' }
        })
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (arr) {
                voidFiles = new Set((arr || []).map(function (f) { return f.name; }));
                voidFilesLoaded = true;
                if (allArticles.length) applyFilter();
            })
            .catch(function () { voidFilesLoaded = true; });
    }
    function init() {
        loadVoidFiles();
        loadIndex();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();