# Collision 赛博斗蛐蛐

双人 P2P 实时对战小游戏（观战 + 主动干涉）

## 在线地址
https://ku-134.github.io/Gamecurrently/Collision/

## 当前版本
- v1.0（M1 单机 demo）：单机对战、职业系统（巨人/兵团）、图鉴、自定义按键
- M2 联机（WebRTC 房间号）开发中

## 项目结构（组件模块化）
```
Collision/
├── index.html
├── css/style.css
└── js/
    ├── main.js          # 入口
    ├── config.js        # 全部数值配置
    ├── core/            # 物理/事件/主循环
    ├── entities/        # 球/状态效果
    ├── skills/          # 技能系统 + 职业定义
    ├── rendering/       # 渲染/摄像机/粒子
    ├── ui/              # 页面/HUD/输入
    ├── mode/            # 单机/联机模式
    └── ai/              # AI 对手
```

## 操作
- 电脑：按住 J 瞄准（兵团），松开释放；设置中可改键
- 手机：长按左下角技能按钮瞄准，松开释放（需横屏）
