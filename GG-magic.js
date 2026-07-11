// ============================================================
// GG-magic.js —— 游戏发布页核心逻辑
// 解析 Hexenzirkel.txt，以卡片网格展示游戏
// ============================================================
(function() {
    'use strict';

    // ---------- DOM 引用 ----------
    var gameGrid = document.getElementById('gameGrid');
    var statsEl = document.getElementById('stats');
    var fetchBtn = document.getElementById('fetchBtn');
    var fetchArea = document.getElementById('fetchArea');

    // ---------- 状态 ----------
    var allGames = [];
    var isLoading = false;

    // ---------- 解析 Hexenzirkel.txt ----------
    function parseHexenzirkel(text) {
        var lines = text.split('\n');
        var games = [];

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            // 匹配格式：## 游戏名 -类型1 -类型2 ... | 介绍 | 文件名
            if (line.indexOf('##') === 0) {
                var content = line.replace(/^##\s*/, '').trim();

                // 分离 游戏名+类型 部分 与 介绍+文件名 部分
                var parts = content.split('|').map(function(s) { return s.trim(); });
                // parts[0] = "游戏名 -类型1 -类型2 ..."
                // parts[1] = "介绍"
                // parts[2] = "文件名"

                var nameAndTags = parts[0] || '';
                var desc = parts[1] || '';
                var fileName = parts[2] || '';

                // 解析游戏名和类型：第一个 - 之前是游戏名，之后是类型列表
                var name = nameAndTags;
                var tags = [];
                var dashIndex = nameAndTags.indexOf(' -');
                if (dashIndex !== -1) {
                    name = nameAndTags.substring(0, dashIndex).trim();
                    var tagStr = nameAndTags.substring(dashIndex + 2).trim();
                    // 按 - 分割类型（保留类型中的空格）
                    tags = tagStr.split(/\s*-\s*/).filter(function(t) { return t.length > 0; });
                } else {
                    // 没有 - 符号，整个作为游戏名
                    name = nameAndTags.trim();
                }

                if (name) {
                    games.push({
                        name: name,
                        tags: tags,
                        desc: desc,
                        fileName: fileName
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
        // 类型标签
        var tagsHtml = '';
        if (game.tags && game.tags.length > 0) {
            var tagItems = [];
            for (var ti = 0; ti < game.tags.length; ti++) {
                tagItems.push('<span class="game-tag">' + escapeHtml(game.tags[ti]) + '</span>');
            }
            tagsHtml = '<div class="game-tags">' + tagItems.join('') + '</div>';
        }

        // 图片占位容器
        var imagesHtml = '<div class="game-images" id="gameImages_' + index + '"></div>';

        // 按钮
        var btnHtml = '<button class="game-play-btn" data-game="' + escapeHtml(game.name) + '">🎮 玩这个！</button>';

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

    // ---------- 加载游戏图片 ----------
    function loadGameImages(card, fileName) {
        var imgContainer = card.querySelector('.game-images');
        if (!imgContainer) return;

        // 尝试加载 0~4 号图片
        var loadedCount = 0;
        var maxAttempts = 5;

        for (var i = 0; i < maxAttempts; i++) {
            (function(imgIndex) {
                var img = new Image();
                var src = 'Gamecurrently/' + fileName + imgIndex + '.png';
                img.onload = function() {
                    // 图片加载成功，添加到容器
                    var imgEl = document.createElement('img');
                    imgEl.src = src;
                    imgEl.alt = fileName + ' 截图' + imgIndex;
                    imgEl.className = 'game-screenshot';
                    imgContainer.appendChild(imgEl);
                    loadedCount++;
                    // 如果所有图片都加载完了，移除空状态
                    if (loadedCount > 0) {
                        imgContainer.classList.add('has-images');
                    }
                };
                img.onerror = function() {
                    // 单个图片加载失败，尝试其他扩展名（jpg）
                    var imgJpg = new Image();
                    var srcJpg = 'Gamecurrently/' + fileName + imgIndex + '.jpg';
                    imgJpg.onload = function() {
                        var imgEl = document.createElement('img');
                        imgEl.src = srcJpg;
                        imgEl.alt = fileName + ' 截图' + imgIndex;
                        imgEl.className = 'game-screenshot';
                        imgContainer.appendChild(imgEl);
                        loadedCount++;
                        if (loadedCount > 0) {
                            imgContainer.classList.add('has-images');
                        }
                    };
                    imgJpg.onerror = function() {
                        // 也尝试 webp
                        var imgWebp = new Image();
                        var srcWebp = 'Gamecurrently/' + fileName + imgIndex + '.webp';
                        imgWebp.onload = function() {
                            var imgEl = document.createElement('img');
                            imgEl.src = srcWebp;
                            imgEl.alt = fileName + ' 截图' + imgIndex;
                            imgEl.className = 'game-screenshot';
                            imgContainer.appendChild(imgEl);
                            loadedCount++;
                            if (loadedCount > 0) {
                                imgContainer.classList.add('has-images');
                            }
                        };
                        imgWebp.onerror = function() {
                            // 全部失败，静默忽略
                        };
                        imgWebp.src = srcWebp;
                    };
                    imgJpg.src = srcJpg;
                };
                img.src = src;
            })(i);
        }
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

    // ---------- 工具：防 XSS ----------
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

    // ---------- 绑定按钮事件 ----------
    // “玩这个！”按钮使用事件委托
    document.addEventListener('click', function(e) {
        var target = e.target.closest('.game-play-btn');
        if (target) {
            var gameName = target.dataset.game || '这个游戏';
            alert('🎮 “' + gameName + '” 即将上线，敬请期待！');
        }
    });

    // ---------- 拉取按钮 ----------
    fetchBtn.addEventListener('click', fetchAndRender);

    // ---------- 初始化 ----------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // 自动拉取
            setTimeout(fetchAndRender, 300);
        });
    } else {
        setTimeout(fetchAndRender, 300);
    }

})();