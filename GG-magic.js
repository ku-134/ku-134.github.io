// ============================================================
// GG-magic.js —— 游戏发布页核心逻辑
// 解析 Hexenzirkel.txt，以卡片网格展示游戏，支持图片浏览弹窗
// 格式：## 游戏名 -标签1 -标签2 | 介绍 | 文件名 | +链接（可选）
// 注意：文件名和+链接的顺序可以互换
// ============================================================
(function() {
    'use strict';

    // ---------- DOM 引用 ----------
    var gameGrid = document.getElementById('gameGrid');
    var statsEl = document.getElementById('stats');
    var fetchBtn = document.getElementById('fetchBtn');
    var fetchArea = document.getElementById('fetchArea');

    // 弹窗
    var overlay = document.getElementById('imageOverlay');
    var thumbnailsEl = document.getElementById('imageThumbnails');
    var viewer = document.getElementById('imageViewer');

    // ---------- 状态 ----------
    var allGames = [];
    var isLoading = false;
    var currentImages = [];
    var currentIndex = 0;

    // ---------- 解析 Hexenzirkel.txt ----------
    function parseHexenzirkel(text) {
        var lines = text.split('\n');
        var games = [];

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            if (line.indexOf('##') === 0) {
                var content = line.replace(/^##\s*/, '').trim();

                // 按 | 分割
                var parts = content.split('|').map(function(s) { return s.trim(); });
                var nameAndTags = parts[0] || '';
                var desc = parts[1] || '';

                // ---------- 智能解析文件名和 +链接 ----------
                var fileName = '';
                var link = '';

                // 从 parts[2] 开始遍历，区分文件名和 +链接
                for (var pi = 2; pi < parts.length; pi++) {
                    var part = parts[pi];
                    if (!part) continue;

                    // 检测是否为 +链接（以 + 开头）
                    var linkMatch = part.match(/^\+\s*(.+)/);
                    if (linkMatch) {
                        // 这是 +链接
                        link = linkMatch[1].trim();
                    } else {
                        // 这是文件名（只取第一个非 + 开头的部分作为文件名）
                        if (!fileName) {
                            fileName = part;
                        }
                        // 如果有多个非 + 开头的部分，忽略后面的（但记录到 link 备用？不，保持简单）
                    }
                }

                // ---------- 解析游戏名和标签 ----------
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

                // ---------- 如果没有 +链接，使用默认跳转 ----------
                if (!link && fileName) {
                    link = 'Gamecurrently/' + fileName + '.html';
                }

                if (name) {
                    games.push({
                        name: name,
                        tags: tags,
                        desc: desc,
                        fileName: fileName,
                        link: link
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

        var html = '';
        for (var i = 0; i < games.length; i++) {
            var game = games[i];
            html += buildGameCard(game, i);
        }

        gameGrid.innerHTML = html;

        // 渲染完成后，异步加载每个游戏的图片
        var cards = gameGrid.querySelectorAll('.game-card');
        for (var ci = 0; ci < cards.length; ci++) {
            (function(card, idx) {
                var game = games[idx];
                if (game && game.fileName) {
                    loadGameImages(card, game.fileName);
                }
            })(cards[ci], ci);
        }

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

        // 按钮：使用解析好的 link
        var btnLink = game.link || '#';
        var btnHtml = '<a href="' + escapeHtml(btnLink) + '" target="_blank" class="game-play-btn" data-game="' + escapeHtml(game.name) + '">🎮 玩这个！</a>';

        return (
            '<div class="game-card" data-index="' + index + '">' +
                '<div class="game-name">' + escapeHtml(game.name) + '</div>' +
                tagsHtml +
                (game.desc ? '<div class="game-desc">' + escapeHtml(game.desc) + '</div>' : '') +
                imagesHtml +
                btnHtml +
            '</div>'
        );
    }

    // ---------- 加载游戏图片并绑定点击事件 ----------
    function loadGameImages(card, fileName) {
        var imgContainer = card.querySelector('.game-images');
        if (!imgContainer) return;

        var basePath = 'Gamecurrently/' + fileName;
        var extensions = ['.png', '.jpg', '.webp'];
        var loadedSrcs = [];
        var maxAttempts = 5;

        function tryLoad(index) {
            if (index >= maxAttempts) {
                if (loadedSrcs.length > 0) {
                    imgContainer.classList.add('has-images');
                    var imgs = imgContainer.querySelectorAll('.game-screenshot');
                    for (var i = 0; i < imgs.length; i++) {
                        (function(imgEl) {
                            imgEl.addEventListener('click', function(e) {
                                e.stopPropagation();
                                openImageViewer(loadedSrcs, i);
                            });
                        })(imgs[i]);
                    }
                }
                return;
            }

            var extIndex = 0;
            function tryNextExt() {
                if (extIndex >= extensions.length) {
                    tryLoad(index + 1);
                    return;
                }
                var ext = extensions[extIndex];
                var src = basePath + index + ext;
                var img = new Image();
                img.onload = function() {
                    var imgEl = document.createElement('img');
                    imgEl.src = src;
                    imgEl.alt = fileName + ' 截图' + index;
                    imgEl.className = 'game-screenshot';
                    imgContainer.appendChild(imgEl);
                    loadedSrcs.push(src);
                    tryLoad(index + 1);
                };
                img.onerror = function() {
                    extIndex++;
                    tryNextExt();
                };
                img.src = src;
            }
            tryNextExt();
        }

        tryLoad(0);
    }

    // ---------- 打开图片浏览弹窗 ----------
    function openImageViewer(srcList, startIndex) {
        if (!srcList || srcList.length === 0) return;
        currentImages = srcList.slice();
        currentIndex = Math.min(startIndex, currentImages.length - 1);
        renderThumbnails();
        showImage(currentIndex);
        overlay.classList.add('active');
        document.body.classList.add('modal-open');
    }

    // ---------- 渲染缩略图索引 ----------
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

    // ---------- 显示大图 ----------
    function showImage(index) {
        if (index >= 0 && index < currentImages.length) {
            viewer.src = currentImages[index];
        }
    }

    // ---------- 关闭弹窗 ----------
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
                allGames = parseHexenzirkel(text);
                if (allGames.length === 0) throw new Error('未解析到有效游戏数据');
                renderGames(allGames);
                fetchBtn.innerHTML = '📂 已加载 ' + allGames.length + ' 款游戏';
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

    // ---------- 事件绑定 ----------
    // 图片浏览弹窗——点击蒙层关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeImageViewer();
        }
    });

    // ESC 关闭
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeImageViewer();
        }
    });

    // 拉取按钮
    fetchBtn.addEventListener('click', fetchAndRender);

    // ---------- 初始化 ----------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(fetchAndRender, 300);
        });
    } else {
        setTimeout(fetchAndRender, 300);
    }

})();