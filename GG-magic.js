// ============================================================
// GG-magic.js —— 游戏发布页核心逻辑
// 解析 Hexenzirkel.txt，以卡片网格展示游戏，支持图片浏览弹窗
// 格式：## 游戏名 -标签1 -标签2 | 介绍 | 文件名 | +链接（可选）
// 也支持：## 游戏名 -标签1 -标签2 | 介绍 | 文件名 +链接
// ============================================================
(function() {
    'use strict';

    // ---------- DOM 引用 ----------
    var gameGrid = document.getElementById('gameGrid');
    var statsEl = document.getElementById('stats');
    var fetchBtn = document.getElementById('fetchBtn');
    var fetchArea = document.getElementById('fetchArea');
    var searchInput = document.getElementById('gameSearchInput');
    var clearBtn = document.getElementById('gameClearSearch');

    // 弹窗
    var overlay = document.getElementById('imageOverlay');
    var thumbnailsEl = document.getElementById('imageThumbnails');
    var viewer = document.getElementById('imageViewer');
    var closeBtn = document.getElementById('imageModalClose');

    // ---------- 状态 ----------
    var allGames = [];
    var isLoading = false;
    var currentImages = [];
    var currentIndex = 0;
    var searchQuery = '';
    // 收藏（gameFavs：游戏名数组）
    function getGameFavSet() {
        try { return new Set(JSON.parse(localStorage.getItem('gameFavs') || '[]')); }
        catch (e) { return new Set(); }
    }
    var favSet = getGameFavSet();

    // ---------- 解析 Hexenzirkel.txt ----------
    function parseHexenzirkel(text) {
        var lines = text.split('\n');
        var games = [];

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            if (line.indexOf('##') === 0) {
                var content = line.replace(/^##\s*/, '').trim();

                var parts = content.split('|').map(function(s) { return s.trim(); });

                var nameAndTags = parts[0] || '';
                var desc = parts[1] || '';

                var fileName = '';
                var link = '';

                for (var pi = 2; pi < parts.length; pi++) {
                    var part = parts[pi];
                    if (!part) continue;

                    if (part.indexOf('+') === 0) {
                        link = part.substring(1).trim();
                        continue;
                    }

                    var plusIndex = part.indexOf(' +');
                    if (plusIndex !== -1) {
                        var beforePlus = part.substring(0, plusIndex).trim();
                        var afterPlus = part.substring(plusIndex + 2).trim();
                        if (afterPlus.indexOf('+') === 0) {
                            afterPlus = afterPlus.substring(1).trim();
                        }
                        if (beforePlus) {
                            fileName = beforePlus;
                        }
                        if (afterPlus) {
                            link = afterPlus;
                        }
                        continue;
                    }

                    if (!fileName) {
                        fileName = part;
                    }
                }

                if (!link && fileName) {
                    link = 'Gamecurrently/' + fileName + '.html';
                }

                var name = nameAndTags;
                var tags = [];
                var dashIndex = nameAndTags.indexOf(' -');
                if (dashIndex !== -1) {
                    name = nameAndTags.substring(0, dashIndex).trim();
                    var tagStr = nameAndTags.substring(dashIndex + 2).trim();
                    tags = tagStr.split(/\s*-\s*/).filter(function(t) { return t.length > 0; });
                } else {
                    name = nameAndTags.trim();
                }

                if (name) {
                    games.push({
                        name: name,
                        tags: tags,
                        desc: desc,
                        fileName: fileName,
                        link: link,
                        _searchText: (name + ' ' + desc + ' ' + tags.join(' ')).toLowerCase()
                    });
                }
            }
        }
        return games;
    }

    // ---------- 渲染游戏卡片 ----------
    function renderGames(games) {
        if (!games || games.length === 0) {
            gameGrid.innerHTML = '<div class="game-empty">🎮 暂无游戏，敬请期待！</div>';
            updateStats(0, 0);
            return;
        }

        allGames = games;

        // 收藏优先排版
        var sorted = allGames.slice().sort(function(a, b) {
            var sa = favSet.has(a.name) ? 1 : 0;
            var sb = favSet.has(b.name) ? 1 : 0;
            return sb - sa;
        });

        var html = '';
        for (var i = 0; i < sorted.length; i++) {
            var game = sorted[i];
            html += buildGameCard(game, i);
        }

        gameGrid.innerHTML = html;

        // 🆕 加载图片（使用占位图）
        var cards = gameGrid.querySelectorAll('.game-card');
        for (var ci = 0; ci < cards.length; ci++) {
            (function(card, idx) {
                var game = sorted[idx];
                if (game && game.fileName) {
                    loadGameImages(card, game.fileName);
                }
            })(cards[ci], ci);
        }

        bindGameEntryClicks();
        applySearchFilter();
        updateStats(games.length, countTotalTags(games));
    }

    // ---------- 构建单张卡片 HTML ----------
    function buildGameCard(game, index) {
        var tagsHtml = '';
        if (game.tags && game.tags.length > 0) {
            var tagItems = [];
            for (var ti = 0; ti < game.tags.length; ti++) {
                tagItems.push('<span class="game-tag">' + escapeHtml(game.tags[ti]) + '</span>');
            }
            tagsHtml = '<div class="game-tags">' + tagItems.join('') + '</div>';
        }

        // 🆕 图片容器 - 空容器，由 JS 动态填充 wrapper
        var imagesHtml = '<div class="game-images" id="gameImages_' + index + '"></div>';

        var isExternal = game.link && (game.link.indexOf('http://') === 0 || game.link.indexOf('https://') === 0);
        var btnLabel = isExternal ? '跳转！' : '玩这个！';
        var btnLink = game.link || '#';

        var btnHtml = '<a href="' + btnLink + '" target="_blank" class="game-play-btn" data-game="' + escapeHtml(game.name) + '" data-link="' + escapeHtml(btnLink) + '">🎮 ' + btnLabel + '</a>';

        var isFav = favSet.has(game.name);
        var favBtn = '<button class="game-fav' + (isFav ? ' on' : '') + '" data-fav="' + escapeHtml(game.name) + '" title="' + (isFav ? '取消收藏' : '收藏游戏') + '">' + (isFav ? '⭐' : '☆') + '</button>';

        return (
            '<div class="game-card" data-index="' + index + '" data-search="' + escapeHtml(game._searchText || '') + '">' +
                '<div class="game-name">' + escapeHtml(game.name) + favBtn + '</div>' +
                tagsHtml +
                (game.desc ? '<div class="game-desc">' + escapeHtml(game.desc) + '</div>' : '') +
                imagesHtml +
                btnHtml +
            '</div>'
        );
    }

    // ============================================================
    // 🆕 加载游戏图片（带占位图）
    // ============================================================
    function loadGameImages(card, fileName) {
        var imgContainer = card.querySelector('.game-images');
        if (!imgContainer) return;

        var basePath = 'Gamecurrently/' + fileName;
        var extensions = ['.png', '.jpg', '.webp'];
        var maxAttempts = 5;
        // 存储所有成功加载的图片 src，用于弹窗浏览
        var loadedSrcs = [];
        // 存储所有 wrapper 元素
        var wrappers = [];

        // 🆕 占位图路径
        var placeholderSrc = 'Gamecurrently/Placeholder.webp';

        // 对每个索引尝试加载
        function tryLoad(index) {
            if (index >= maxAttempts) {
                // 所有索引尝试完毕
                if (loadedSrcs.length > 0) {
                    imgContainer.classList.add('has-images');
                    // 绑定图片点击事件（使用已加载的 src 列表）
                    bindImageClick(imgContainer, loadedSrcs);
                } else {
                    // 没有任何图片加载成功，移除所有占位图
                    wrappers.forEach(function(w) {
                        if (w.parentNode) w.parentNode.removeChild(w);
                    });
                    imgContainer.classList.remove('has-images');
                }
                return;
            }

            var extIndex = 0;

            function tryNextExt() {
                if (extIndex >= extensions.length) {
                    // 该索引所有扩展名都失败，尝试下一个索引
                    tryLoad(index + 1);
                    return;
                }

                var ext = extensions[extIndex];
                var src = basePath + index + ext;

                // 🆕 创建 wrapper 和占位图
                var wrapper = document.createElement('div');
                wrapper.className = 'game-image-wrapper';

                // 占位图（带呼吸动画和灰色模糊滤镜）
                var placeholderImg = document.createElement('img');
                placeholderImg.className = 'placeholder-img';
                placeholderImg.src = placeholderSrc;
                placeholderImg.alt = '加载中...';
                wrapper.appendChild(placeholderImg);

                // 真实图片（初始隐藏）
                var realImg = document.createElement('img');
                realImg.className = 'real-img';
                realImg.alt = fileName + ' 截图' + index;
                wrapper.appendChild(realImg);

                // 添加到容器
                imgContainer.appendChild(wrapper);
                wrappers.push(wrapper);

                // 尝试加载真实图片
                var img = new Image();
                img.onload = function() {
                    // 加载成功：设置真实图片 src，标记加载完成
                    realImg.src = src;
                    realImg.classList.add('loaded');
                    // 占位图自动通过 CSS 淡出
                    loadedSrcs.push(src);
                    // 继续尝试下一个索引
                    tryLoad(index + 1);
                };
                img.onerror = function() {
                    // 加载失败：移除这个 wrapper
                    if (wrapper.parentNode) {
                        wrapper.parentNode.removeChild(wrapper);
                    }
                    // 从 wrappers 数组中移除
                    var idx = wrappers.indexOf(wrapper);
                    if (idx !== -1) wrappers.splice(idx, 1);
                    // 尝试下一个扩展名
                    extIndex++;
                    tryNextExt();
                };
                img.src = src;
            }

            tryNextExt();
        }

        // 开始加载
        tryLoad(0);
    }

    // ---------- 绑定图片点击事件 ----------
    function bindImageClick(container, srcList) {
        var wrappers = container.querySelectorAll('.game-image-wrapper');
        var index = 0;
        wrappers.forEach(function(wrapper) {
            var realImg = wrapper.querySelector('.real-img');
            if (realImg && realImg.classList.contains('loaded')) {
                (function(idx) {
                    wrapper.addEventListener('click', function(e) {
                        e.stopPropagation();
                        openImageViewer(srcList, idx);
                    });
                })(index);
                index++;
            }
        });
    }

    // ---------- 绑定游戏跳转计数 ----------
    function toggleGameFav(name) {
        var favs = [];
        try { favs = JSON.parse(localStorage.getItem('gameFavs') || '[]'); } catch (e) {}
        var i = favs.indexOf(name);
        if (i >= 0) favs.splice(i, 1);
        else favs.push(name);
        try { localStorage.setItem('gameFavs', JSON.stringify(favs)); } catch (e) {}
        favSet = getGameFavSet();
        if (allGames.length) renderGames(allGames);
    }
    gameGrid.addEventListener('click', function(e) {
        var fav = e.target.closest('.game-fav');
        if (fav) {
            e.preventDefault();
            e.stopPropagation();
            toggleGameFav(fav.getAttribute('data-fav'));
        }
    });

    function bindGameEntryClicks() {
        var btns = document.querySelectorAll('.game-play-btn');
        btns.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                try {
                    var count = parseInt(localStorage.getItem('gameEntryCount') || '0');
                    count++;
                    localStorage.setItem('gameEntryCount', String(count));
                    try {
                        window.dispatchEvent(new Event('storage'));
                    } catch (ex) { /* 忽略 */ }
                } catch (ex) { /* 忽略 */ }
            });
        });
    }

    // ---------- 搜索功能 ----------
    function applySearchFilter() {
        var query = searchQuery.trim().toLowerCase();
        var cards = document.querySelectorAll('.game-card');
        var visibleCount = 0;
        cards.forEach(function(card) {
            var searchText = card.dataset.search || '';
            if (query === '' || searchText.indexOf(query) !== -1) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        if (statsEl) {
            var total = allGames.length;
            if (query !== '') {
                statsEl.textContent = '🔍 找到 ' + visibleCount + ' 款游戏（共 ' + total + ' 款）';
            } else {
                statsEl.textContent = '🎮 共 ' + total + ' 款游戏 · ' + countTotalTags(allGames) + ' 个标签';
            }
        }
    }

    // ---------- 图片浏览弹窗 ----------
    function openImageViewer(srcList, startIndex) {
        if (!srcList || srcList.length === 0) return;
        currentImages = srcList.slice();
        currentIndex = Math.min(startIndex, currentImages.length - 1);
        renderThumbnails();
        showImage(currentIndex);
        overlay.classList.add('active');
        document.body.classList.add('modal-open');
    }

    function renderThumbnails() {
        thumbnailsEl.innerHTML = '';
        var romanNumerals = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
        for (var i = 0; i < currentImages.length; i++) {
            var thumb = document.createElement('div');
            thumb.className = 'image-thumb' + (i === currentIndex ? ' active' : '');
            thumb.textContent = romanNumerals[i] || (i + 1);
            (function(idx) {
                thumb.addEventListener('click', function(e) {
                    e.stopPropagation();
                    currentIndex = idx;
                    var thumbs = thumbnailsEl.querySelectorAll('.image-thumb');
                    for (var t = 0; t < thumbs.length; t++) {
                        thumbs[t].classList.remove('active');
                    }
                    this.classList.add('active');
                    showImage(idx);
                });
            })(i);
            thumbnailsEl.appendChild(thumb);
        }
    }

    function showImage(index) {
        if (index >= 0 && index < currentImages.length) {
            viewer.src = currentImages[index];
        }
    }

    function closeImageViewer() {
        overlay.classList.remove('active');
        document.body.classList.remove('modal-open');
        viewer.src = '';
        currentImages = [];
        currentIndex = 0;
        thumbnailsEl.innerHTML = '';
    }

    // ---------- 统计 ----------
    function updateStats(gameCount, tagCount) {
        if (!statsEl) return;
        if (searchQuery.trim() !== '') return;
        if (gameCount === 0) {
            statsEl.textContent = '📂 暂无游戏';
            return;
        }
        statsEl.textContent = '🎮 共 ' + gameCount + ' 款游戏 · ' + tagCount + ' 个标签';
    }

    function countTotalTags(games) {
        var count = 0;
        for (var i = 0; i < games.length; i++) {
            count += (games[i].tags ? games[i].tags.length : 0);
        }
        return count;
    }

    // ---------- 工具 ----------
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---------- 拉取数据 ----------
    function fetchAndRender() {
        if (isLoading) return;
        isLoading = true;

        fetchBtn.classList.add('loading');
        fetchBtn.innerHTML = '<span class="spinner">⟳</span> 加载中...';

        fetch('Gamecurrently/Hexenzirkel.txt?t=' + Date.now())
            .then(function(res) {
                if (!res.ok) throw new Error('文件不存在 (HTTP ' + res.status + ')');
                return res.text();
            })
            .then(function(text) {
                if (!text || text.trim() === '') throw new Error('文件为空');
                var games = parseHexenzirkel(text);
                if (games.length === 0) throw new Error('未解析到有效游戏数据');
                renderGames(games);
                fetchBtn.innerHTML = '📂 已加载 ' + games.length + ' 款游戏';
                fetchBtn.style.opacity = '0.4';
                fetchBtn.style.cursor = 'default';
                fetchBtn.disabled = true;
                fetchArea.style.display = 'none';
            })
            .catch(function(err) {
                gameGrid.innerHTML =
                    '<div class="game-empty">' +
                    '❌ 加载失败：' + err.message +
                    '<br><button class="btn btn-secondary" style="margin-top:1rem;" onclick="location.reload()">🔄 重试</button>' +
                    '<br><span style="font-size:0.7rem;opacity:0.3;margin-top:0.5rem;display:block;">请确保 Gamecurrently/Hexenzirkel.txt 存在且格式正确</span>' +
                    '</div>';
                statsEl.textContent = '';
                fetchBtn.classList.remove('loading');
                fetchBtn.innerHTML = '📂 加载失败';
            })
            .finally(function() {
                isLoading = false;
                fetchBtn.classList.remove('loading');
            });
    }

    // ---------- 搜索事件绑定 ----------
    var searchTimer = null;
    function bindSearchEvents() {
        if (!searchInput) return;
        searchInput.addEventListener('input', function() {
            var val = this.value.trim();
            searchQuery = val;
            clearBtn.style.display = val.length > 0 ? 'inline' : 'none';
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
                applySearchFilter();
            }, 200);
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                searchInput.value = '';
                searchQuery = '';
                this.style.display = 'none';
                applySearchFilter();
            });
        }
    }

    // ---------- 事件绑定 ----------
    closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeImageViewer();
    });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeImageViewer();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeImageViewer();
        }
    });

    fetchBtn.addEventListener('click', fetchAndRender);

    // ---------- 初始化 ----------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(fetchAndRender, 300);
            bindSearchEvents();
        });
    } else {
        setTimeout(fetchAndRender, 300);
        bindSearchEvents();
    }

})();