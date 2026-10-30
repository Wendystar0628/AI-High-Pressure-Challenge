# 形式化证明题 · AI 评分指南

- 材料：题面 `E:\Project\AI_OneShot_Bench\深度推理\形式化证明题.md`；作答是工作目录下的 `Problem1.lean`–`Problem5.lean`；出处和纸面解答见同目录 `参考答案.md`。
- 计分：每题 20 分，5 题共 100 分，满分 100 分。每题只有 0 分和 20 分两档，证明的长短和风格不影响得分。

## 得 20 分须同时满足

- 用 `C:\Lean\lean.cmd` 单独编译该文件无错误，只导入 Mathlib 及其依赖库。
- 定理名和命题与题面一致（含命题前的 `open … in`，空白和换行不计），没有用新的记号、实例、宏等改变命题含义。
- 没有 `sorry`、`admit`、新公理、`native_decide`，没有用 `set_option`、元编程等绕过内核检查。
- `#print axioms` 只含 `propext`、`Classical.choice`、`Quot.sound` 中的若干条。

文件名或位置与题面略有出入的，找到对应文件照常检查；缺文件的题记 0 分，不影响其他题。

## 输出

各题得分（0 或 20）和一句理由，以及总分。
