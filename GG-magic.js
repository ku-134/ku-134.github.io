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

        var html = '';
        for (var i = 0; i < games.length; i++) {
            var game = games[i];
            html += buildGameCard(game, i);
        }

        gameGrid.innerHTML = html;

        // 加载图片（异步）
        var cards = gameGrid.querySelectorAll('.game-card');
        for (var ci = 0; ci < cards.length; ci++) {
            (function(card, idx) {
                var game = games[idx];
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

        var imagesHtml = '<div class="game-images" id="gameImages_' + index + '"></div>';

        var isExternal = game.link && (game.link.indexOf('http://') === 0 || game.link.indexOf('https://') === 0);
        var btnLabel = isExternal ? '跳转！' : '玩这个！';
        var btnLink = game.link || '#';

        var btnHtml = '<a href="' + btnLink + '" target="_blank" class="game-play-btn" data-game="' + escapeHtml(game.name) + '" data-link="' + escapeHtml(btnLink) + '">🎮 ' + btnLabel + '</a>';

        return (
            '<div class="game-card" data-index="' + index + '" data-search="' + escapeHtml(game._searchText || '') + '">' +
                '<div class="game-name">' + escapeHtml(game.name) + '</div>' +
                tagsHtml +
                (game.desc ? '<div class="game-desc">' + escapeHtml(game.desc) + '</div>' : '') +
                imagesHtml +
                btnHtml +
            '</div>'
        );
    }

    // ---------- 加载游戏图片（使用占位图 + 呼吸动画，修复布局） ----------
    function loadGameImages(card, fileName) {
        var imgContainer = card.querySelector('.game-images');
        if (!imgContainer) return;

        var basePath = 'Gamecurrently/' + fileName;
        var extensions = ['.png', '.jpg', '.webp'];
        var maxAttempts = 5;
        var placeholderSrc = 'Placeholder.webp';

        // 用于存储每个索引的加载结果
        var loadPromises = [];

        // 对每个索引尝试加载
        for (var idx = 0; idx < maxAttempts; idx++) {
            loadPromises.push(new Promise(function(resolve, reject) {
                var extIndex = 0;
                function tryNextExt() {
                    if (extIndex >= extensions.length) {
                        // 所有扩展名都失败
                        resolve(null); // 表示该索引无图片
                        return;
                    }
                    var ext = extensions[extIndex];
                    var src = basePath + idx + ext;
                    var img = new Image();
                    img.onload = function() {
                        // 图片存在，返回src
                        resolve(src);
                    };
                    img.onerror = function() {
                        extIndex++;
                        tryNextExt();
                    };
                    img.src = src;
                }
                tryNextExt();
            }));
        }

        // 等待所有索引尝试完成
        Promise.all(loadPromises).then(function(srcs) {
            // srcs 数组包含每个索引的结果（成功为src，失败为null）
            var successSrcs = srcs.filter(function(s) { return s !== null; });

            // 如果没有成功图片，标记容器无图片（但保留占位高度？我们通过占位图保持高度，所以即使没有成功图片，容器也不显示任何元素，但保持高度？我们需要给容器一个最小高度？我们已经设置了aspect-ratio，但容器内无内容时高度为0，所以还是会有高度变化。为了处理这种情况，如果没有任何图片，我们保持容器空白，但高度由aspect-ratio撑起，所以容器会有高度，但内部无内容，这样卡片高度稳定。但我们需要给容器设置背景色或占位提示？我们保留空容器，但aspect-ratio会撑起高度，这样卡片高度稳定。
            // 但我们可能希望没有图片时隐藏容器？不，为了布局稳定，我们保留容器，但内部无元素。
            // 但如果没有任何图片，容器的aspect-ratio仍然有效，所以高度存在，但卡片会有一个空白区域，可能不好看。但可以接受。
            // 更好的做法：如果没有任何图片，隐藏容器（display:none），但这样卡片高度会变化。所以我们保留容器，并添加一个占位提示？但会破坏美观。
            // 我们可以添加一个默认的占位背景图，但这里我们简单处理：如果无图片，容器内显示一个"无截图"的文字占位。
            // 但用户可能不希望显示额外文字。我们选择让容器保持空白，但高度由aspect-ratio撑起，这样卡片高度与其他卡片一致（因为其他卡片有图片，高度由图片决定，所以空白卡片高度也会被拉伸）。
            // 实际上，grid会拉伸所有卡片到相同高度，所以即使某个卡片没有图片，它的容器高度也会被拉伸，但内容为空，所以卡片底部会有空白。这样视觉上可能不协调，但至少布局不乱。
            // 我们可以给游戏卡片设置flex:1，让内容填充，但图片容器的高度由aspect-ratio决定，所以即使没有图片，容器也有高度，卡片高度一致。
            if (successSrcs.length === 0) {
                // 无图片，在容器中显示一个占位文字或背景
                // 我们选择添加一个提示，但为了简洁，我们添加一个灰色占位文字
                var emptyMsg = document.createElement('div');
                emptyMsg.textContent = '📷 暂无截图';
                emptyMsg.style.cssText = 'display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:rgba(128,128,128,0.3); font-size:0.8rem;';
                imgContainer.appendChild(emptyMsg);
                imgContainer.classList.add('has-images'); // 标记有内容，但实际是提示
                return;
            }

            // 有成功图片，创建占位图元素并替换
            // 为每个成功src创建一个img元素
            successSrcs.forEach(function(src, index) {
                // 创建img元素，先显示占位图
                var imgEl = document.createElement('img');
                imgEl.src = placeholderSrc;
                imgEl.alt = fileName + ' 截图' + (index);
                imgEl.className = 'game-screenshot loading';
                imgContainer.appendChild(imgEl);

                // 加载真实图片（因为之前已经测试过，浏览器可能缓存，但为了保险，我们再次加载）
                var realImg = new Image();
                realImg.onload = function() {
                    imgEl.src = src;
                    imgEl.classList.remove('loading');
                    // 绑定点击事件
                    (function(el, srcList, idx) {
                        el.addEventListener('click', function(e) {
                            e.stopPropagation();
                            openImageViewer(srcList, idx);
                        });
                    })(imgEl, successSrcs, index);
                };
                realImg.onerror = function() {
                    // 如果真实图片加载失败，移除占位图
                    imgEl.remove();
                };
                realImg.src = src;
            });

            imgContainer.classList.add('has-images');
        });
    }

    // ---------- 绑定游戏跳转计数 ----------
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