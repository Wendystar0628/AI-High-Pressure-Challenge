# 网络安全攻防战 · 动态路由塔防

双击根目录的 `index.html` 即可在 Chrome 中运行，不需要网页服务器。

目录说明：

- `index.html`、`css/`、`js/`、`vendor/`：交付的网页项目。`vendor/three.bundle.js` 是打包成普通脚本的 three.js。
- `tools/`：开发用脚本，运行游戏不需要。
  - `node tools/test_routes.js`：校验三张地图的路由规则（每个节点的隔离都会改道、至少一个节点影响多入口）。
  - `node tools/test_mechanics.js`：逐项校验塔、敌人、道具和状态的机制。
  - `node tools/test_invariants.js`：随机操作压力测试（不瞬移、不穿墙、不封死、被拒操作不扣资源）。
  - `node tools/test_boss.js`：Boss 技能压力测试。
  - `node tools/sim_bot.js`、`node tools/sim_greedy.js`：无界面自动对局，用来检查难度曲线。
  - 重新打包 three.js：在 `tools/` 下执行 `npm install`，再用 esbuild 打包 `vendor_entry.js`。
