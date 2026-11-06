# 形式化证明题 · AI 评分指南

- 材料：题面 `E:\Project\AI_OneShot_Bench\数学推理\形式化证明题.md`；作答是工作目录下的 `Problem1.lean`–`Problem8.lean`；出处和纸面解答见同目录 `参考答案.md`。
- 计分：每题 12.5 分，8 题共 100 分，满分 100 分。每题只有 0 分和 12.5 分两档，证明的长短和风格不影响得分。

## 得 12.5 分的条件

- 用 `C:\Lean\lean.cmd` 单独编译该文件，没有错误，输出里也没有 `declaration uses 'sorry'` 警告。
- 在副本末尾加 `#print axioms problemK` 和 `#check @problemK` 再编译：主定理只依赖 `propext`、`Classical.choice`、`Quot.sound`（出现自定义公理、`sorryAx`、`Lean.ofReduceBool` 都不满足）；打印出的命题与题面的 Lean 命题一致。
- 主定理确实经过编译：不在 `#exit` 之后或注释里，定理前也没有用记号、同名定义或宏改变命题含义。看一眼文件即可，不逐行审查证明。

文件名或位置与题面略有出入的，找到对应文件照常检查；缺文件的题记 0 分，不影响其他题。文件里没有题面要求的主定理 `problemK`，算缺这道题。

## 输出

各题得分（0 或 12.5）和一句理由，以及总分。
