你负责把评测题“鲁班锁拆解”的第 04 题（Power Burr）换成一道难度相近的公开谜题。工作目录 `E:\Project\AI_OneShot_Bench`，管理员账户。调研记录写在 `调研\鲁班锁选题\`，实验文件放 `调研\鲁班锁选题\实验\`。

## 背景

- 题面 `空间推理\鲁班锁拆解.md`；六题的作答材料直接放在 `空间推理\鲁班锁拆解\`（`01.json`/`01.md`/`01.png` … `06.*`），发题时复制成作答目录里的 `题目\`。
- 评分材料在 `Grading\空间推理\鲁班锁拆解\`：`references.json`、`参考答案.md`、`标准解答\第0k题.json`、`参考原始数据\0k.xmpuzzle`/`.xml`、`check.py`、`grade.py`、`convert_reference.py`、`参考原始数据\export_reference.cpp`、`test_grading.py`。先读 `参考答案.md` 和 `references.json` 了解现有六题怎么做出来的。
- 换题原因：Power Burr 只出现在一个 GitHub 示例文件里，查不到设计者、出处或任何公开记录。
- 规则：零件只能沿坐标轴平移，不能旋转；计步规则见题面第二节。

## 要求

1. 找一副有公开记录的谜题替换 04：优先 Puzzle Will Be Played（puzzlewillbeplayed.com，本机 DNS 解析不了时可用公共 DNS 查到的 IP 访问）上有精确装配资料、标明 level 的作品；不需要旋转；难度和 Power Burr 相近（4 件左右含框架，首次分离 20 步上下，完整拆解 25 步上下），并和其余五题的结构不重复。记下设计者、年份、页面网址和公开 level。
2. 按现有题目的同样格式做出新 04：`04.json`、`04.md`（两个视角、单件结构图、精确分层图）、`04.png`，风格与其余五题一致；用 BurrTools v0.8.0 的固定拆解实现生成参考路线（和现有题同一做法），转成 `标准解答\第04题.json`，用 `check.py` 独立验证；更新 `参考原始数据\04.*`、`references.json`（来源、页面、公开 level、参考步数、首次分离、哈希）和 `参考答案.md` 的题表与题源说明；题面第一节表格里 04 的零件数如有变化一并改。
3. Power Burr 的旧文件搬进 `调研\鲁班锁选题\已撤下_PowerBurr\` 保留，不要删除。
4. 跑 `python -m pytest -q Grading\空间推理\鲁班锁拆解\test_grading.py`。`references.json` 里每题的 `best_moves`（满分基准）现在故意留空，由用户在测完后决定，不要填；与它有关的两项测试失败是预期的，其余必须通过。
5. 不改题面的计分章节（指挥另行修改），不改 `orchestrator\`、`H:\AI_OneShot_Model` 和其他题目。

## 交付

在 `调研\鲁班锁选题\换题记录.md` 写明：选了哪副、为什么难度相近（首次分离、完整步数、件数、尺寸对比）、来源与公开 level、做了哪些文件、测试结果。完成后结束本轮。需要指挥决定的事写成消息文件后运行 `python orchestrator\timer.py notify "<消息文件>"`。
