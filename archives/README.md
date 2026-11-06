# 模型核心归档

用户确认模型的视频和封面后运行 `python videos/tools/archive_model.py run --model <厂商>/<型号>`，按题保存核心提交物、评分表和各评分阶段的 `result.json`，并生成带 SHA256 的 `manifest.json`。完整规则见 [文件存放与归档](../videos/docs/storage.md)。

本目录纳入 Git，不加入任何 ignore/exclude。以后提交 Git 时，随其他改动一起提交、推送。模型提交的 `.gitignore`、`.gitattributes` 加 `.txt` 保存原文，避免其规则在归档中生效；归档根目录自有的 `.gitattributes` 用 `* -text` 禁止换行转换，保证检出后仍能通过原 SHA256 校验。

归档不收题面、题目数据、依赖包、构建缓存、可再生成产物和视频中间产物。用 `python videos/tools/archive_model.py verify --model <厂商>/<型号>` 校验已有归档。归档通过后，H 上原作答与视频中间产物按清理流程移入同盘待删除区，核心归档始终保留。
