# 回放数据格式（版本 1）

```powershell
python replay_data.py --answers <作答目录> --out <输出目录>
python replay_data.py --reference --out <输出目录>
```

作答路径为 `<作答目录>/答案/第NN题.json`。可用 `--only 01,02` 选择题目；测试件可加 `--config 测试件/references.json --only T1,T2,T3`。输出为 `replay.json`、每题一个子目录及其 GLB、图纸 PNG。输出目录应为新目录；重复导出时播放器只读取本次 JSON 引用的文件。

顶层包含 `problems` 数组，另有 `format`、`version: 1`、`units: "毫米"`、`up: "Z"`、`source` 元数据。所有文件路径相对 `replay.json`，用 `/` 分隔。GLB 数值直接使用毫米，图纸坐标系 Z 朝上；播放器不得自动按 glTF 默认单位或 Y 朝上转换。

每题结构如下（示意，省略的矩阵实际为完整 16 数数组）：

```json
{
  "id": "01", "tier": "简单档", "name": "角支架", "kind": "part", "max": 3.5,
  "drawing": "01/drawing.png", "drawings": ["01/drawing.png"],
  "status": "ok", "error": null,
  "parts": [{
    "name": "1", "title": "底座",
    "steps": [{"label": "拉伸 · 底板 120×80×15", "kind": "add", "feature": 1,
      "tool": "01/p1_tool_01.glb", "result": "01/p1_step_01.glb", "axis": [0,0,1]}],
    "final": "01/p1_final.glb",
    "placement": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1], "explode": [0,0,0]
  }],
  "reference": {"parts": [{"name": "1", "title": "底座", "mesh": "01/ref_p1.glb",
    "placement": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}]},
  "compare": {"fscore": 0.956, "precision": 0.97, "recall": 0.94,
    "translation": [0,0,0], "tolerance": 0.2, "parts": [{"name": "1", "fscore": 0.956}],
    "matched": "01/cmp_matched.glb", "extra": "01/cmp_extra.glb", "missing": "01/cmp_missing.glb"}
}
```

- `kind` 为 `part` 或 `assembly`；`max` 仅为题目分值，**不导出得分或总分**。
- `status` 为 `ok`、`missing`、`invalid`。缺答案文件时 `parts: []`、`error: null`、`compare: null`；JSON 或整体描述无法读取时 `parts: []`、`compare: null`，`error` 给原因。特征失败时 `error: {"part":"1","step":4,"message":"中文原因"}`，该零件仅导出前三步并按第三步实体比对。零件定义错误的 `step` 为 `null`，整体错误的 `part`、`step` 均为 `null`。其他正常零件仍完整导出；仅保留首个错误于 `error`。
- `steps` 按特征顺序排列；`feature` 从 1 开始。`label` 为中文短说明，覆盖拉伸、旋转、孔、阵列、镜像、倒圆、倒角。`kind` 为 `add` 或 `cut`；求交用 `cut` 表示移除交集以外材料。
- `tool` 是该步实际增加或切掉的实体，`result` 是完成该步的实体。第一步工具截在零件附近；无材料变化的步骤工具为空场景。通常用 `axis` 给单位生长方向；旋转特征改用 `revolve: {"origin":[x,y,z],"axis":[dx,dy,dz]}`。旋转原点和轴也在零件自身坐标系。
- `tool`、`result`、`final` 和参考 `mesh` 均在**零件自身坐标系**；乘对应 `placement` 才到装配坐标。`placement` 为 4×4 列主序矩阵，平移在第 13–15 个数。没有成功实体时 `final: null`。文件编号按零件列表顺序，匹配零件始终用 `name`。
- `explode` 是装配坐标系中的额外显示位移。方向为零件中心远离装配中心，长度为装配包围盒对角线的一半；中心重合时按零件顺序选择坐标轴。单件题为零。仅用于爆炸演示，不用于评分或最终装配。
- `translation` 是**作答加上它对齐到参考**，整题一次平移，不旋转，各零件共用。装配按零件 `name` 对应；准确率按整套作答表面积汇总，完整率对整套参考几何面等权汇总，再计算整题F；缺件的参考面全记零，多出的未知序号与评分一样不参与比对。
- `compare` 三份网格已经在**对齐后的装配坐标系**中，不能再次应用 placement、translation 或 explode。matched 为作答表面吻合部分，extra 为作答表面多余部分，missing 为参考表面缺失部分。
- F、precision、recall直接复用 `grade.py` 的 `aggregate` 和同一平移对齐及容差查询：precision按作答表面积，recall按相连同曲面合并后的参考面等权，每面按面积采样至少256点、至多5000点；合并规则见评分README第四节。`compare.parts[].fscore`仅作逐件诊断，不能取平均得到整题F。比较着色把表面三角形细分至最长边 4 mm，采用不粗于0.02mm/0.1rad的比对网格，按重心调用同一表面距离判定；颜色边界为三角形近似，不以着色三角形数量计算 F 值。空分类 GLB 是合法空场景。
- 多张图纸按文件名顺序列在 `drawings`，首张同时作为 `drawing`；没有可用 PNG 时 `drawing: null`、`drawings: []`。参考网格即使作答缺失也导出，供播放器展示。


加难版图纸：同题多张图按自然张次排序（-2在-10之前）。回放PNG副本等比限制到1600×1200像素，避免A1原图在多个渲染面重复解码占用大量内存和显存；原始240dpi题图保持完整分辨率。回放从建模描述与GLB生成，不读取公开JSON的图线坐标，也不调用受测对照工具。

回放工具对较长的新题名自动缩字号，多件装配标记必要时放到第二行；标题不占用图纸缩略图。工具播放页文案使用中文。参考all段的本轮试导证据见调研/工程图纸三维还原/验收-v4/回放。

第三轮为25题：简单8题、中档7题、困难10题，分值3.5/4/4.4。视频固定选简单01/03/06/08、中档09/11/13/15、困难16/19/22/25（三档等距选四题），三页2×2，每页≤10秒。正常data.mjs仅请求这些题，box请求05；不能按模型表现换题。

JSON格式version仍1，新增顶层scoring_schema=4、tolerance_mm=0.2、wide_tolerance_mm=2、strict_f_weight=0.8。compare.fscore为综合F；fscore_strict/fscore_wide分别为两档F，precision/recall为窄档，wide_precision/wide_recall为宽档。先在0.2mm求平移，2mm固定复用；每档汇总P/R算F，再80/20合成，不平均零件F。compare.parts中的综合F仅用于诊断，不可平均为整题F。颜色分类仍按0.2mm。旧版单档缓存需重建。

steps[].type为建模特征类型；fillet/chamfer另有transition="finish"，实际增减材料差体原位显现再切换曲面结果。凸倒圆/倒角通常cut，凹圆角可能add；不能拿未修剪工具体代替。其余仍用真实axis/revolve。独立零件同时播放各自有序步骤，再装回，以让复杂装配在10秒内每步可见；不改变几何或评分。

本轮验收证据在调研/工程图纸三维还原/验收-v4。PNG原图和1568/2048缩图是图纸可读性的依据，视频缩略图只是来源提示。视频模板未改，维护清单见调研目录。
