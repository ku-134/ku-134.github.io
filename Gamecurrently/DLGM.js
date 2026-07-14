/**
 * 🍀 妲那给木 · 视觉小说引擎
 * 解析 DLGM-Taiben.txt 并执行演出
 */
const DLGM = (function() {
    'use strict';

    // --- 状态 ---
    let scriptLines = [];          // 解析后的指令数组
    let currentIndex = 0;
    let characters = new Map();    // 角色标识 -> {id, image, position, effect, dom, img}
    let conditions = new Set();    // 已获得的因果条件
    let isPlaying = false;
    let isWaiting = false;
    let dialogueClickHandler = null;
    let optionSelected = false;

    // DOM 引用
    const stageBg = document.getElementById('stage-bg');
    const charsContainer = document.getElementById('characters-container');
    const dialogueBox = document.getElementById('dialogue-box');
    const dialogueName = document.getElementById('dialogue-name');
    const dialogueText = document.getElementById('dialogue-text');
    const optionsContainer = document.getElementById('options-container');
    const optionsPrompt = document.getElementById('options-prompt');
    const optionsButtons = document.getElementById('options-buttons');

    // --- 工具函数 ---
    function log(msg) { console.log('[DLGM]', msg); }

    // --- 解析台本 ---
    function parseScript(text) {
        const lines = text.split(/\r?\n/);
        const instructions = [];
        let lineNum = 0;
        for (let raw of lines) {
            lineNum++;
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue; // 空行或注释

            let instr = { line: lineNum, raw: trimmed };

            // 背景 ###
            if (trimmed.startsWith('### ')) {
                const bg = trimmed.substring(4).trim();
                instr.type = 'bg';
                instr.bg = bg === '0' ? null : bg;
                instructions.push(instr);
                continue;
            }

            // 角色 ##
            if (trimmed.startsWith('## ')) {
                const parts = trimmed.substring(3).split(/\s*-\s*/);
                if (parts.length >= 3) {
                    const id = parts[0].trim();
                    const image = parts[1].trim();
                    const position = parseInt(parts[2].trim()) || 1;
                    const effect = parts.length > 3 ? parts[3].trim() : '0';
                    instr.type = 'role';
                    instr.id = id;
                    instr.image = image;
                    instr.position = position;
                    instr.effect = effect;
                    instructions.push(instr);
                } else {
                    console.warn(`行 ${lineNum} 角色格式错误: ${trimmed}`);
                }
                continue;
            }

            // 对话或选项（以 | 开头）
            if (trimmed.startsWith('| ')) {
                const content = trimmed.substring(2).trim();
                // 判断是否包含 '/' 且不是冒号前的部分？简单判断：若含有 ' / ' 且不在冒号内，视为选项
                // 更准确：如果内容包含冒号，且冒号前没有 '/'，则为对话
                const hasColon = content.includes(':');
                const hasSlash = content.includes('/');
                // 如果包含冒号且不包含斜杠（或者斜杠在冒号后面？通常对话不会有斜杠，选项没有冒号）
                if (hasColon && !hasSlash) {
                    // 对话：角色名 : 文本
                    const colonIdx = content.indexOf(':');
                    const name = content.substring(0, colonIdx).trim();
                    const text = content.substring(colonIdx + 1).trim();
                    instr.type = 'dialogue';
                    instr.name = name;
                    instr.text = text;
                    instructions.push(instr);
                } else {
                    // 选项
                    // 格式： [说明] / 选项1 [-条件] [->标签] / 选项2 ...
                    const parts = content.split(/\s*\/\s*/);
                    const prompt = parts.length > 0 ? parts[0] : '';
                    const options = [];
                    for (let i = 1; i < parts.length; i++) {
                        let opt = parts[i].trim();
                        let condition = null;
                        let addCondition = null;
                        let target = null;
                        // 解析 -> 标签
                        const arrowIdx = opt.indexOf('->');
                        if (arrowIdx !== -1) {
                            target = opt.substring(arrowIdx + 2).trim();
                            opt = opt.substring(0, arrowIdx).trim();
                        }
                        // 解析 - 条件 和 + 条件
                        const minusIdx = opt.indexOf(' - ');
                        const plusIdx = opt.indexOf(' + ');
                        if (minusIdx !== -1 && (plusIdx === -1 || minusIdx < plusIdx)) {
                            condition = opt.substring(minusIdx + 3).trim();
                            opt = opt.substring(0, minusIdx).trim();
                        } else if (plusIdx !== -1 && (minusIdx === -1 || plusIdx < minusIdx)) {
                            addCondition = opt.substring(plusIdx + 3).trim();
                            opt = opt.substring(0, plusIdx).trim();
                        }
                        // 如果同时有 - 和 + ？我们只支持一种，但可以扩展，简单起见只支持一种
                        options.push({
                            text: opt,
                            condition: condition,
                            addCondition: addCondition,
                            target: target
                        });
                    }
                    instr.type = 'options';
                    instr.prompt = prompt;
                    instr.options = options;
                    instructions.push(instr);
                }
                continue;
            }

            // 退场（# 角色1 #角色2 ...）
            if (trimmed.startsWith('# ')) {
                const rest = trimmed.substring(2).trim();
                // 可能包含多个 #，但我们的格式是 # 角色名 # 角色名，但我们也可以支持用空格分隔，每个前面有#？
                // 更简单：按空格分割，过滤出以#开头的标识
                const parts = rest.split(/\s+/);
                const ids = [];
                for (let p of parts) {
                    if (p.startsWith('#')) {
                        ids.push(p.substring(1).trim());
                    } else {
                        // 如果没有#，可能第一个就是角色名？但格式要求有#，我们兼容没#的？
                        // 但根据规范，每个角色前有#，所以我们只取以#开头的
                    }
                }
                // 如果没找到，尝试将整个rest作为单个角色名（兼容）
                if (ids.length === 0 && rest.length > 0) {
                    // 可能用户写了 # alice bob 没写#，我们按空格分割，全部当作角色
                    const all = rest.split(/\s+/);
                    for (let a of all) {
                        if (a) ids.push(a);
                    }
                }
                instr.type = 'exit';
                instr.ids = ids;
                instructions.push(instr);
                continue;
            }

            // 等待 ^
            if (trimmed.startsWith('^ ')) {
                const val = trimmed.substring(2).trim();
                const sec = parseFloat(val);
                instr.type = 'wait';
                instr.seconds = isNaN(sec) ? 0 : sec;
                // 如果 seconds === 0，视为清场（但我们单独处理）
                instructions.push(instr);
                continue;
            }

            // 标签 @
            if (trimmed.startsWith('@')) {
                const label = trimmed.substring(1).trim();
                instr.type = 'label';
                instr.label = label;
                instructions.push(instr);
                continue;
            }

            // 跳转 ->
            if (trimmed.startsWith('-> ')) {
                const target = trimmed.substring(3).trim();
                if (target.startsWith('@')) {
                    instr.type = 'jump';
                    instr.target = target.substring(1).trim();
                    instructions.push(instr);
                } else {
                    console.warn(`行 ${lineNum} 跳转目标格式错误: ${trimmed}`);
                }
                continue;
            }

            // 未知指令
            console.warn(`行 ${lineNum} 未知指令: ${trimmed}`);
        }
        return instructions;
    }

    // --- 执行引擎 ---

    // 查找标签索引
    function findLabel(label) {
        for (let i = 0; i < scriptLines.length; i++) {
            const inst = scriptLines[i];
            if (inst.type === 'label' && inst.label === label) {
                return i;
            }
        }
        return -1;
    }

    // 跳转到标签
    function jumpToLabel(label) {
        const idx = findLabel(label);
        if (idx !== -1) {
            currentIndex = idx;
            log(`跳转到标签 @${label} (索引 ${idx})`);
            executeNext();
        } else {
            console.error(`标签 @${label} 未找到`);
        }
    }

    // 更新角色显示
    function updateCharacter(roleData) {
        const { id, image, position, effect } = roleData;
        let char = characters.get(id);
        if (!char) {
            // 创建新角色
            const div = document.createElement('div');
            div.className = 'character';
            // 根据站位设置 left
            let left = 50; // 默认中央
            if (position === 1) left = 20;
            else if (position === 2) left = 50;
            else if (position === 3) left = 80;
            div.style.left = left + '%';
            const img = document.createElement('img');
            img.src = image;
            img.alt = id;
            div.appendChild(img);
            charsContainer.appendChild(div);
            char = {
                id: id,
                image: image,
                position: position,
                effect: effect || '0',
                dom: div,
                img: img
            };
            characters.set(id, char);
            // 渐入
            setTimeout(() => div.classList.add('show'), 20);
        } else {
            // 修改现有角色
            if (image) {
                char.image = image;
                char.img.src = image;
            }
            if (position) {
                char.position = position;
                let left = 50;
                if (position === 1) left = 20;
                else if (position === 2) left = 50;
                else if (position === 3) left = 80;
                char.dom.style.left = left + '%';
            }
            if (effect !== undefined && effect !== null && effect !== '0') {
                char.effect = effect;
                // 可以触发特效，这里简单记录
                log(`角色 ${id} 效果: ${effect}`);
            }
        }
    }

    // 移除角色（退场）
    function removeCharacter(id) {
        const char = characters.get(id);
        if (char) {
            char.dom.classList.add('exiting');
            setTimeout(() => {
                char.dom.remove();
                characters.delete(id);
            }, 500);
        }
    }

    // 设置说话角色高亮
    function setSpeaking(name) {
        // 重置所有角色
        for (let [id, char] of characters) {
            char.dom.classList.remove('speaking');
        }
        // 查找匹配的角色（按标识或显示名？我们按标识匹配，但对话中的角色名可能是显示名，我们假设标识就是显示名）
        // 但可能角色标识和显示名不同？我们规定标识即显示名。
        const char = characters.get(name);
        if (char) {
            char.dom.classList.add('speaking');
        }
    }

    // 执行下一条指令
    function executeNext() {
        if (!isPlaying) return;
        if (currentIndex >= scriptLines.length) {
            // 结束
            log('台本执行完毕');
            dialogueText.textContent = '— Fin —';
            dialogueName.textContent = '';
            return;
        }

        const inst = scriptLines[currentIndex];
        currentIndex++;
        log(`执行 ${inst.line}: ${inst.type}`);

        switch (inst.type) {
            case 'bg': {
                if (inst.bg) {
                    window.setGameBackground(inst.bg);
                } else {
                    // 黑幕：设置纯色背景或黑色
                    stageBg.style.backgroundImage = 'none';
                    stageBg.style.backgroundColor = '#000';
                }
                executeNext();
                break;
            }
            case 'role': {
                updateCharacter({
                    id: inst.id,
                    image: inst.image,
                    position: inst.position,
                    effect: inst.effect
                });
                executeNext();
                break;
            }
            case 'dialogue': {
                // 显示对话
                dialogueName.textContent = inst.name;
                dialogueText.textContent = inst.text;
                // 高亮说话角色
                setSpeaking(inst.name);
                // 等待点击
                dialogueBox.style.display = 'flex';
                optionsContainer.style.display = 'none';
                // 移除旧监听
                if (dialogueClickHandler) {
                    dialogueBox.removeEventListener('click', dialogueClickHandler);
                }
                dialogueClickHandler = function() {
                    dialogueBox.removeEventListener('click', dialogueClickHandler);
                    dialogueClickHandler = null;
                    executeNext();
                };
                dialogueBox.addEventListener('click', dialogueClickHandler);
                break;
            }
            case 'options': {
                // 显示选项
                dialogueBox.style.display = 'none';
                optionsContainer.style.display = 'block';
                optionsPrompt.textContent = inst.prompt || '请选择';
                optionsButtons.innerHTML = '';
                // 过滤选项（基于条件）
                const validOptions = inst.options.filter(opt => {
                    if (opt.condition && !conditions.has(opt.condition)) {
                        return false;
                    }
                    return true;
                });
                if (validOptions.length === 0) {
                    // 没有可用选项，跳过
                    optionsContainer.style.display = 'none';
                    executeNext();
                    break;
                }
                // 生成按钮
                validOptions.forEach((opt, index) => {
                    const btn = document.createElement('button');
                    btn.className = 'option-btn';
                    btn.textContent = opt.text;
                    btn.addEventListener('click', function() {
                        // 禁用所有按钮防止多次点击
                        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
                        // 处理因果条件
                        if (opt.addCondition) {
                            conditions.add(opt.addCondition);
                            log(`添加条件: ${opt.addCondition}`);
                        }
                        // 跳转
                        if (opt.target) {
                            jumpToLabel(opt.target);
                        } else {
                            // 无跳转，继续下一条
                            optionsContainer.style.display = 'none';
                            executeNext();
                        }
                    });
                    optionsButtons.appendChild(btn);
                });
                break;
            }
            case 'exit': {
                // 退场
                const ids = inst.ids;
                ids.forEach(id => {
                    removeCharacter(id);
                });
                // 等待退场动画（0.5s）后继续
                setTimeout(() => {
                    executeNext();
                }, 500);
                break;
            }
            case 'wait': {
                const sec = inst.seconds;
                if (sec === 0) {
                    // 清场：所有角色退场
                    const allIds = Array.from(characters.keys());
                    allIds.forEach(id => removeCharacter(id));
                    setTimeout(() => {
                        executeNext();
                    }, 500);
                } else {
                    // 等待秒数
                    setTimeout(() => {
                        executeNext();
                    }, sec * 1000);
                }
                break;
            }
            case 'label': {
                // 标签本身不执行，直接下一行
                executeNext();
                break;
            }
            case 'jump': {
                jumpToLabel(inst.target);
                break;
            }
            default:
                console.warn('未知指令类型:', inst.type);
                executeNext();
        }
    }

    // --- 启动游戏 ---
    function startGame() {
        if (isPlaying) {
            // 重置状态
            resetGame();
        }
        // 加载台本
        fetch('DLGM-Taiben.txt')
            .then(res => {
                if (!res.ok) throw new Error(`加载台本失败 (${res.status})`);
                return res.text();
            })
            .then(text => {
                scriptLines = parseScript(text);
                log(`台本解析完成，共 ${scriptLines.length} 条指令`);
                currentIndex = 0;
                isPlaying = true;
                // 清空角色
                charsContainer.innerHTML = '';
                characters.clear();
                conditions.clear();
                // 初始背景设为黑幕
                stageBg.style.backgroundImage = 'none';
                stageBg.style.backgroundColor = '#000';
                // 隐藏选项，显示对话框
                optionsContainer.style.display = 'none';
                dialogueBox.style.display = 'flex';
                dialogueName.textContent = '';
                dialogueText.textContent = '加载中……';
                // 开始执行
                setTimeout(() => {
                    executeNext();
                }, 300);
            })
            .catch(err => {
                console.error('🍀 启动失败:', err);
                alert('无法加载台本文件，请确保 DLGM-Taiben.txt 存在。');
            });
    }

    function resetGame() {
        isPlaying = false;
        if (dialogueClickHandler) {
            dialogueBox.removeEventListener('click', dialogueClickHandler);
            dialogueClickHandler = null;
        }
        // 清空角色
        charsContainer.innerHTML = '';
        characters.clear();
        // 重置界面
        dialogueBox.style.display = 'flex';
        optionsContainer.style.display = 'none';
        dialogueName.textContent = '';
        dialogueText.textContent = '';
        stageBg.style.backgroundImage = 'none';
        stageBg.style.backgroundColor = '#000';
        currentIndex = 0;
        conditions.clear();
        log('游戏已重置');
    }

    // 暴露全局方法
    window.setGameBackground = function(url) {
        if (!url) {
            stageBg.style.backgroundImage = 'none';
            stageBg.style.backgroundColor = '#000';
            return;
        }
        stageBg.style.backgroundImage = `url('${url}')`;
        stageBg.style.backgroundColor = 'transparent';
    };

    return {
        startGame: startGame,
        resetGame: resetGame
    };
})();