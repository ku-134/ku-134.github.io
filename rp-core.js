// ============================================================
// RP 核心逻辑：解析 category.txt、渲染、搜索、收藏、弹窗、计数
// ============================================================
(function() {
    'use strict';

    // ---------- DOM 引用 ----------
    const categoryListEl = document.getElementById('categoryList');
    const resourceAreaEl = document.getElementById('resourceArea');
    const statsEl = document.getElementById('stats');
    const fetchBtn = document.getElementById('fetchBtn');
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    const favToggle = document.getElementById('favToggle');

    // ---------- 弹窗 DOM ----------
    const overlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalDesc = document.getElementById('modalDesc');
    const modalIcon = document.getElementById('modalIcon');
    const modalTypeLabel = document.getElementById('modalTypeLabel');
    const modalWarning = document.getElementById('modalWarning');
    const btnCancel = document.getElementById('modalCancel');
    const btnConfirm = document.getElementById('modalConfirm');
    const countdownRing = document.getElementById('countdownRing');

    // ---------- 反馈弹窗 DOM ----------
    const feedbackTrigger = document.getElementById('feedbackTrigger');
    const feedbackOverlay = document.getElementById('feedbackOverlay');
    const feedbackConfirm = document.getElementById('feedbackConfirm');

    // ---------- 核心数据 ----------
    let allCategories = [];
    let currentView = 'all';          // 'all' 或 'favorites'
    let searchQuery = '';
    let favorites = [];
    let pendingLink = null;
    let countdownTimer = null;
    let countdownValue = 3;
    let isLoading = false;

    // ---------- 收藏管理 ----------
    function loadFavorites() {
        try {
            const data = localStorage.getItem('favorites');
            favorites = data ? JSON.parse(data) : [];
        } catch (e) {
            favorites = [];
        }
    }

    function saveFavorites() {
        localStorage.setItem('favorites', JSON.stringify(favorites));
    }

    function isFavorited(name) {
        return favorites.includes(name);
    }

    function toggleFavorite(name) {
        const idx = favorites.indexOf(name);
        if (idx > -1) {
            favorites.splice(idx, 1);
        } else {
            favorites.push(name);
        }
        saveFavorites();
        renderCurrentView();
        // 触发 storage 事件，同步首页
        try {
            window.dispatchEvent(new Event('storage'));
        } catch (e) { /* 静默降级 */ }
    }

    // ---------- 跳转计数 ----------
    function recordClick(resourceName) {
        try {
            const data = JSON.parse(localStorage.getItem('resourceClicks') || '{}');
            data[resourceName] = (data[resourceName] || 0) + 1;
            data._total = (data._total || 0) + 1;
            localStorage.setItem('resourceClicks', JSON.stringify(data));
            try {
                window.dispatchEvent(new Event('storage'));
            } catch (e) { /* 静默降级 */ }
        } catch (e) { /* 静默降级 */ }
    }

    // ---------- 类型辅助 ----------
    function detectType(link) {
        if (!link) return 'placeholder';
        const l = link.toLowerCase();
        if (l.includes('github.com')) return 'github';
        if (l.includes('pan.baidu.com') || l.includes('yunpan') || l.includes('netdisk') || l.includes('网盘')) return 'pan';
        if (l.startsWith('/') || l.startsWith('./') || l.startsWith('../')) return 'local';
        return 'other';
    }

    function getTypeLabel(type) {
        const map = { 'github': 'GitHub', 'pan': '网盘', 'local': '站内', 'other': '外部', 'placeholder': '占位' };
        return map[type] || '外部';
    }

    function getTypeIcon(type) {
        const map = { 'github': '🐙', 'pan': '☁️', 'local': '📁', 'other': '🔗', 'placeholder': '⏳' };
        return map[type] || '🔗';
    }

    // ---------- 解析 category.txt ----------
    function parseCategoryTxt(text) {
        const lines = text.split('\n');
        const categories = [];
        let current = null;

        for (let raw of lines) {
            let line = raw.trim();
            if (!line) continue;

            if (line.startsWith('##')) {
                const name = line.replace(/^##\s*/, '').trim();
                current = { name: name, items: [] };
                categories.push(current);
                continue;
            }

            if (line.startsWith('- ') && current) {
                const content = line.replace(/^-\s*/, '').trim();
                const parts = content.split('|').map(function(s) { return s.trim(); });
                var item = { name: '', desc: '', link: '', type: 'other' };

                if (parts.length >= 4) {
                    item.name = parts[0] || '';
                    item.desc = parts[1] || '';
                    item.link = parts[2] || '';
                    item.type = parts[3] || 'other';
                } else if (parts.length === 3) {
                    item.name = parts[0] || '';
                    item.desc = parts[1] || '';
                    item.link = parts[2] || '';
                    item.type = detectType(item.link);
                } else if (parts.length === 2) {
                    item.name = parts[0] || '';
                    item.desc = '';
                    item.link = parts[1] || '';
                    item.type = detectType(item.link);
                } else if (parts.length === 1) {
                    item.name = parts[0] || '';
                    item.desc = '';
                    item.link = '';
                    item.type = 'placeholder';
                }

                if (!item.link) item.type = 'placeholder';
                if (item.name) {
                    current.items.push(item);
                }
            }
        }
        return categories;
    }

    // ---------- 获取过滤后的资源 ----------
    function getFilteredItems() {
        var items = [];
        if (currentView === 'favorites') {
            for (var ci = 0; ci < allCategories.length; ci++) {
                var cat = allCategories[ci];
                for (var ii = 0; ii < cat.items.length; ii++) {
                    var item = cat.items[ii];
                    if (isFavorited(item.name)) {
                        items.push({ name: item.name, desc: item.desc, link: item.link, type: item.type, category: cat.name });
                    }
                }
            }
        } else {
            for (var ci2 = 0; ci2 < allCategories.length; ci2++) {
                var cat2 = allCategories[ci2];
                for (var ii2 = 0; ii2 < cat2.items.length; ii2++) {
                    var item2 = cat2.items[ii2];
                    items.push({ name: item2.name, desc: item2.desc, link: item2.link, type: item2.type, category: cat2.name });
                }
            }
        }

        if (searchQuery.trim() !== '') {
            var q = searchQuery.trim().toLowerCase();
            var filtered = [];
            for (var fi = 0; fi < items.length; fi++) {
                var it = items[fi];
                var nameMatch = it.name.toLowerCase().includes(q);
                var descMatch = it.desc && it.desc.toLowerCase().includes(q);
                if (nameMatch || descMatch) {
                    filtered.push(it);
                }
            }
            items = filtered;
        }
        return items;
    }

    // ---------- 更新统计 ----------
    function updateStats() {
        var items = getFilteredItems();
        var total = items.length;
        var favCount = favorites.length;
        var text = '共 ' + allCategories.length + ' 个分类 · ' + total + ' 个资源';
        if (favCount > 0) text += ' · ⭐ ' + favCount + ' 个收藏';
        if (statsEl) statsEl.textContent = text;
    }

    // ---------- 渲染指定资源列表 ----------
    function renderFilteredItems(items, categoryName) {
        if (items.length === 0) {
            resourceAreaEl.innerHTML =
                '<div class="rp-content-header">' +
                '<span class="cat-name">' + categoryName + '</span>' +
                '<span class="cat-count">0 个资源</span>' +
                '</div>' +
                '<div class="rp-empty">这个分类暂时是空的</div>';
            updateStats();
            return;
        }

        var filtered = items;
        if (searchQuery.trim() !== '') {
            var q = searchQuery.trim().toLowerCase();
            var tmp = [];
            for (var fi = 0; fi < items.length; fi++) {
                var it = items[fi];
                var nameMatch = it.name.toLowerCase().includes(q);
                var descMatch = it.desc && it.desc.toLowerCase().includes(q);
                if (nameMatch || descMatch) {
                    tmp.push(it);
                }
            }
            filtered = tmp;
        }

        var html =
            '<div class="rp-content-header">' +
            '<span class="cat-name">' + categoryName + '</span>' +
            '<span class="cat-count">' + filtered.length + ' 个资源</span>' +
            '</div>';

        for (var i = 0; i < filtered.length; i++) {
            var item = filtered[i];
            var typeClass = 'type-' + item.type;
            var typeLabel = getTypeLabel(item.type);
            var icon = getTypeIcon(item.type);
            var hasLink = item.link && item.type !== 'placeholder';
            var linkAttr = hasLink ? 'data-link="' + item.link + '" data-type="' + item.type + '"' : '';
            var fav = isFavorited(item.name) ? 'active' : '';
            var favoritedClass = isFavorited(item.name) ? 'favorited' : '';
            var nameHtml = hasLink ?
                '<a href="#" class="rp-resource-link" ' + linkAttr + '>' + item.name + '</a>' :
                '<span class="name placeholder">' + item.name + '（即将上线）</span>';

            html +=
                '<div class="rp-resource-item ' + typeClass + ' ' + favoritedClass + '">' +
                '<span class="arrow">' + icon + '</span>' +
                '<span class="name">' + nameHtml + '</span>' +
                (item.desc ? '<span class="desc">' + item.desc + '</span>' : '') +
                '<span class="type-tag">' + typeLabel + '</span>' +
                '<button class="star-btn ' + fav + '" data-name="' + item.name + '" title="收藏/取消收藏">' + (fav ? '★' : '☆') + '</button>' +
                '</div>';
        }

        resourceAreaEl.innerHTML = html;

        // 绑定资源链接点击
        var links = resourceAreaEl.querySelectorAll('.rp-resource-link');
        for (var li = 0; li < links.length; li++) {
            (function(linkEl) {
                linkEl.addEventListener('click', function(e) {
                    e.preventDefault();
                    var link = this.dataset.link;
                    var type = this.dataset.type || 'other';
                    var name = this.textContent.trim();
                    var parent = this.closest('.rp-resource-item');
                    var descEl = parent ? parent.querySelector('.desc') : null;
                    var desc = descEl ? descEl.textContent.trim() : '';
                    openModal(name, desc, link, type);
                });
            })(links[li]);
        }

        // 绑定星标按钮
        var stars = resourceAreaEl.querySelectorAll('.star-btn');
        for (var si = 0; si < stars.length; si++) {
            (function(starEl) {
                starEl.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var name = this.dataset.name;
                    toggleFavorite(name);
                });
            })(stars[si]);
        }

        updateStats();
    }

    // ---------- 渲染当前视图 ----------
    function renderCurrentView() {
        var items = getFilteredItems();

        if (items.length === 0) {
            var msg = '📭 没有找到资源';
            if (currentView === 'favorites') msg = '⭐ 还没有收藏任何资源，快去收藏吧！';
            if (searchQuery.trim() !== '') msg = '🔍 没有找到匹配的资源';
            resourceAreaEl.innerHTML =
                '<div class="rp-content-header">' +
                '<span class="cat-name">' + (currentView === 'favorites' ? '⭐ 我的收藏' : '全部资源') + '</span>' +
                '<span class="cat-count">0 个</span>' +
                '</div>' +
                '<div class="rp-empty">' + msg + '</div>';
            updateStats();
            return;
        }

        var html =
            '<div class="rp-content-header">' +
            '<span class="cat-name">' + (currentView === 'favorites' ? '⭐ 我的收藏' : '全部资源') + '</span>' +
            '<span class="cat-count">' + items.length + ' 个资源</span>' +
            '</div>';

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var typeClass = 'type-' + item.type;
            var typeLabel = getTypeLabel(item.type);
            var icon = getTypeIcon(item.type);
            var hasLink = item.link && item.type !== 'placeholder';
            var linkAttr = hasLink ? 'data-link="' + item.link + '" data-type="' + item.type + '"' : '';
            var fav = isFavorited(item.name) ? 'active' : '';
            var favoritedClass = isFavorited(item.name) ? 'favorited' : '';
            var nameHtml = hasLink ?
                '<a href="#" class="rp-resource-link" ' + linkAttr + '>' + item.name + '</a>' :
                '<span class="name placeholder">' + item.name + '（即将上线）</span>';

            html +=
                '<div class="rp-resource-item ' + typeClass + ' ' + favoritedClass + '">' +
                '<span class="arrow">' + icon + '</span>' +
                '<span class="name">' + nameHtml + '</span>' +
                (item.desc ? '<span class="desc">' + item.desc + '</span>' : '') +
                '<span class="type-tag">' + typeLabel + '</span>' +
                '<button class="star-btn ' + fav + '" data-name="' + item.name + '" title="收藏/取消收藏">' + (fav ? '★' : '☆') + '</button>' +
                '</div>';
        }

        resourceAreaEl.innerHTML = html;

        // 绑定资源链接点击
        var links = resourceAreaEl.querySelectorAll('.rp-resource-link');
        for (var li = 0; li < links.length; li++) {
            (function(linkEl) {
                linkEl.addEventListener('click', function(e) {
                    e.preventDefault();
                    var link = this.dataset.link;
                    var type = this.dataset.type || 'other';
                    var name = this.textContent.trim();
                    var parent = this.closest('.rp-resource-item');
                    var descEl = parent ? parent.querySelector('.desc') : null;
                    var desc = descEl ? descEl.textContent.trim() : '';
                    openModal(name, desc, link, type);
                });
            })(links[li]);
        }

        // 绑定星标按钮
        var stars = resourceAreaEl.querySelectorAll('.star-btn');
        for (var si = 0; si < stars.length; si++) {
            (function(starEl) {
                starEl.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var name = this.dataset.name;
                    toggleFavorite(name);
                });
            })(stars[si]);
        }

        updateStats();
    }

    // ---------- 侧边栏渲染 ----------
    function renderSidebar(categories) {
        if (!categories || categories.length === 0) {
            categoryListEl.innerHTML = '<div class="rp-empty" style="padding:0.5rem 0;font-size:0.85rem;">暂无分类</div>';
            return;
        }

        var html = '';
        html += '<button class="rp-category-item active" data-category="__all__">📂 全部</button>';
        var favCount = favorites.length;
        html += '<button class="rp-category-item" data-category="__favorites__">⭐ 我的收藏 <span class="badge">' + favCount + '</span></button>';

        for (var i = 0; i < categories.length; i++) {
            var cat = categories[i];
            var count = 0;
            for (var j = 0; j < cat.items.length; j++) {
                if (cat.items[j].type !== 'placeholder') count++;
            }
            html += '<button class="rp-category-item" data-category="' + cat.name + '">' + cat.name + '<span class="badge">' + count + '</span></button>';
        }

        categoryListEl.innerHTML = html;

        // 绑定点击事件
        var items = categoryListEl.querySelectorAll('.rp-category-item');
        for (var ki = 0; ki < items.length; ki++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var allBtns = categoryListEl.querySelectorAll('.rp-category-item');
                    for (var bi = 0; bi < allBtns.length; bi++) {
                        allBtns[bi].classList.remove('active');
                    }
                    this.classList.add('active');

                    var name = this.dataset.category;
                    if (name === '__all__') {
                        currentView = 'all';
                        searchQuery = '';
                        searchInput.value = '';
                        clearBtn.style.display = 'none';
                        favToggle.classList.remove('active');
                        renderCurrentView();
                    } else if (name === '__favorites__') {
                        currentView = 'favorites';
                        searchQuery = '';
                        searchInput.value = '';
                        clearBtn.style.display = 'none';
                        favToggle.classList.add('active');
                        renderCurrentView();
                    } else {
                        var catItems = [];
                        var targetCat = null;
                        for (var ci = 0; ci < allCategories.length; ci++) {
                            if (allCategories[ci].name === name) {
                                targetCat = allCategories[ci];
                                break;
                            }
                        }
                        if (targetCat) {
                            for (var ii = 0; ii < targetCat.items.length; ii++) {
                                var it = targetCat.items[ii];
                                catItems.push({ name: it.name, desc: it.desc, link: it.link, type: it.type, category: targetCat.name });
                            }
                        }
                        renderFilteredItems(catItems, name);
                    }
                });
            })(items[ki]);
        }
    }

    // ---------- 弹窗 ----------
    function openModal(name, desc, link, type) {
        if (!link) return;
        pendingLink = link;
        var typeLabel = getTypeLabel(type);
        var icon = getTypeIcon(type);

        modalTitle.textContent = name;
        modalDesc.textContent = desc || '没有更多描述';
        modalIcon.textContent = icon;
        modalTypeLabel.textContent = typeLabel;
        modalWarning.innerHTML = '⚠️ 即将跳转到 <strong>' + typeLabel + '</strong> 页面，请确认安全。';

        btnConfirm.classList.remove('ready');
        btnConfirm.disabled = true;
        countdownValue = 3;
        countdownRing.textContent = '3';

        overlay.classList.add('active');
        document.body.classList.add('modal-open');

        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = setInterval(function() {
            countdownValue -= 1;
            countdownRing.textContent = countdownValue;
            if (countdownValue <= 0) {
                clearInterval(countdownTimer);
                countdownTimer = null;
                btnConfirm.classList.add('ready');
                btnConfirm.disabled = false;
                countdownRing.textContent = '✓';
            }
        }, 1000);
    }

    function closeModal() {
        overlay.classList.remove('active');
        document.body.classList.remove('modal-open');
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
        pendingLink = null;
        btnConfirm.classList.remove('ready');
        btnConfirm.disabled = true;
        countdownRing.textContent = '3';
    }

    function confirmJump() {
        if (!pendingLink || btnConfirm.disabled) return;
        // 记录跳转
        var parent = document.querySelector('.rp-resource-item.favorited, .rp-resource-item');
        var nameEl = parent ? parent.querySelector('.name a') : null;
        if (nameEl) recordClick(nameEl.textContent.trim());
        window.open(pendingLink, '_blank', 'noopener,noreferrer');
        closeModal();
    }

    // ---------- 反馈弹窗 ----------
    function openFeedback() {
        feedbackOverlay.classList.add('active');
        document.body.classList.add('modal-open');
    }

    function closeFeedback() {
        feedbackOverlay.classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    // ---------- 拉取数据 ----------
    function fetchAndRender() {
        if (isLoading) return;
        isLoading = true;
        fetchBtn.classList.add('loading');
        fetchBtn.innerHTML = '<span class="spinner">⟳</span> 加载中...';

        fetch('category.txt?t=' + Date.now())
            .then(function(res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.text();
            })
            .then(function(text) {
                if (!text.trim()) {
                    allCategories = [];
                    renderSidebar([]);
                    resourceAreaEl.innerHTML = '<div class="rp-empty">📭 category.txt 为空</div>';
                    statsEl.textContent = '';
                    return;
                }
                allCategories = parseCategoryTxt(text);
                loadFavorites();
                renderSidebar(allCategories);
                currentView = 'all';
                searchQuery = '';
                searchInput.value = '';
                clearBtn.style.display = 'none';
                favToggle.classList.remove('active');
                renderCurrentView();
            })
            .catch(function(err) {
                console.warn('加载失败:', err);
                resourceAreaEl.innerHTML =
                    '<div class="rp-empty">❌ 加载失败<br><button class="btn btn-secondary" style="margin-top:1rem;" onclick="location.reload()">🔄 重试</button></div>';
                statsEl.textContent = '';
            })
            .finally(function() {
                isLoading = false;
                fetchBtn.classList.remove('loading');
                fetchBtn.innerHTML = '📂 已加载';
                fetchBtn.style.opacity = '0.4';
                fetchBtn.style.cursor = 'default';
                fetchBtn.disabled = true;
            });
    }

    // ---------- 搜索事件 ----------
    var searchTimer = null;
    function bindSearchEvents() {
        searchInput.addEventListener('input', function() {
            var val = this.value.trim();
            searchQuery = val;
            clearBtn.style.display = val.length > 0 ? 'inline' : 'none';
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
                var activeCat = document.querySelector('.rp-category-item.active');
                if (activeCat) {
                    var name = activeCat.dataset.category;
                    if (name === '__all__') {
                        currentView = 'all';
                        renderCurrentView();
                    } else if (name === '__favorites__') {
                        currentView = 'favorites';
                        renderCurrentView();
                    } else {
                        var cat = null;
                        for (var ci = 0; ci < allCategories.length; ci++) {
                            if (allCategories[ci].name === name) {
                                cat = allCategories[ci];
                                break;
                            }
                        }
                        if (cat) {
                            var items = [];
                            for (var ii = 0; ii < cat.items.length; ii++) {
                                var it = cat.items[ii];
                                items.push({ name: it.name, desc: it.desc, link: it.link, type: it.type, category: cat.name });
                            }
                            renderFilteredItems(items, cat.name);
                        }
                    }
                } else {
                    renderCurrentView();
                }
            }, 200);
        });

        clearBtn.addEventListener('click', function() {
            searchInput.value = '';
            searchQuery = '';
            this.style.display = 'none';
            var activeCat = document.querySelector('.rp-category-item.active');
            if (activeCat) {
                var name = activeCat.dataset.category;
                if (name === '__all__' || name === '__favorites__') {
                    renderCurrentView();
                } else {
                    var cat = null;
                    for (var ci = 0; ci < allCategories.length; ci++) {
                        if (allCategories[ci].name === name) {
                            cat = allCategories[ci];
                            break;
                        }
                    }
                    if (cat) {
                        var items = [];
                        for (var ii = 0; ii < cat.items.length; ii++) {
                            var it = cat.items[ii];
                            items.push({ name: it.name, desc: it.desc, link: it.link, type: it.type, category: cat.name });
                        }
                        renderFilteredItems(items, cat.name);
                    }
                }
            } else {
                renderCurrentView();
            }
        });
    }

    // ---------- 收藏切换按钮 ----------
    function bindFavToggle() {
        favToggle.addEventListener('click', function() {
            var isActive = this.classList.contains('active');
            if (isActive) {
                this.classList.remove('active');
                currentView = 'all';
                searchQuery = '';
                searchInput.value = '';
                clearBtn.style.display = 'none';
                var allBtns = categoryListEl.querySelectorAll('.rp-category-item');
                for (var bi = 0; bi < allBtns.length; bi++) {
                    allBtns[bi].classList.remove('active');
                }
                var allBtn = categoryListEl.querySelector('.rp-category-item[data-category="__all__"]');
                if (allBtn) allBtn.classList.add('active');
                renderCurrentView();
            } else {
                this.classList.add('active');
                currentView = 'favorites';
                searchQuery = '';
                searchInput.value = '';
                clearBtn.style.display = 'none';
                var allBtns2 = categoryListEl.querySelectorAll('.rp-category-item');
                for (var bi2 = 0; bi2 < allBtns2.length; bi2++) {
                    allBtns2[bi2].classList.remove('active');
                }
                var favBtn = categoryListEl.querySelector('.rp-category-item[data-category="__favorites__"]');
                if (favBtn) favBtn.classList.add('active');
                renderCurrentView();
            }
        });
    }

    // ---------- 绑定事件 ----------
    function bindEvents() {
        fetchBtn.addEventListener('click', fetchAndRender);

        btnCancel.addEventListener('click', closeModal);
        btnConfirm.addEventListener('click', confirmJump);

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeModal();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                closeModal();
            }
            if (e.key === 'Escape' && feedbackOverlay.classList.contains('active')) {
                closeFeedback();
            }
        });

        feedbackTrigger.addEventListener('click', openFeedback);
        feedbackConfirm.addEventListener('click', closeFeedback);
        feedbackOverlay.addEventListener('click', function(e) {
            if (e.target === feedbackOverlay) closeFeedback();
        });

        bindSearchEvents();
        bindFavToggle();
    }

    // ---------- 初始化 ----------
    function init() {
        loadFavorites();
        bindEvents();
        // 默认显示拉取按钮，不自动加载
    }

    // 等待 DOM 加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();