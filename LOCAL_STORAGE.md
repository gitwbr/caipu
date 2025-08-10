## 本地数据存储规范（Local Storage Spec）

本文档描述小程序本地持久化的键、数据结构与统一读写约定。

### 总体原则

- 所有“云端成功”的写操作，必须同步写入本地；页面渲染一律从本地读取。
- 登录成功后进行一次全量刷新：从云端获取用户信息、全部饮食记录、自定义食物，覆盖写入本地。
- 日期统一为 `YYYY-MM-DD`，时间统一为 `HH:MM`。

### 持久化键一览

- token: string
- userInfo: 对象（见下）
 - dietRecords: 数组<记录对象>（见下）
- dietRecordsLastUpdate: ISOString
 - exerciseRecords: 数组<运动记录对象>（见下）
 - exerciseRecordsLastUpdate: ISOString
- customFoods: 数组<自定义食物对象>（见下）
- customFoodsLastUpdate: ISOString
- foodNutritionData: 数组<营养数据对象>
- foodNutritionLastUpdate: number（毫秒时间戳）
- recentFoods: 数组<最近食物对象>
- favorites: 数组（默认空）
- history: 数组（默认空）
 - exerciseTypes: 数组<运动类型对象>（可选缓存）
 - exercises: 数组<标准运动对象>（可选缓存）
 - customExercises: 数组<自定义运动对象>（可选缓存）

### userInfo 结构

```
{
  id: number,
  nickname: string,
  gender: 'male' | 'female',
  birthday: 'YYYY-MM-DD',
  height: number,   // cm，本地统一字段（由 height_cm 映射）
  weight: number,   // kg，本地统一字段（由 weight_kg 映射）
  bmr: number       // 计算后写入
  // 可能包含服务端原始字段：height_cm, weight_kg 等
}
```

### dietRecords 结构

通用字段：

```
{
  id: number,
  record_date: 'YYYY-MM-DD',
  record_time: 'HH:MM' | '',
  record_type: 'standard' | 'custom' | 'quick',
  quantity_g: number,      // 快速记录为 0
  notes: string | '',
  created_at?: ISOString,
  updated_at?: ISOString,
  is_offline?: boolean
}
```

类型专有字段：

- 标准食物：`food_id: number`
- 自定义食物：`custom_food_id: number`
- 快速记录：
  - `quick_food_name: string`
  - `quick_energy_kcal: number`
  - `quick_protein_g: number`
  - `quick_fat_g: number`
  - `quick_carbohydrate_g: number`
  - `quick_image_url?: string`

示例：

```
[
  {
    id: 101,
    record_date: '2025-08-09',
    record_time: '08:30',
    record_type: 'standard',
    food_id: 5001,
    quantity_g: 120,
    notes: ''
  },
  {
    id: 102,
    record_date: '2025-08-09',
    record_time: '12:05',
    record_type: 'quick',
    quantity_g: 0,
    quick_food_name: '快速记录',
    quick_energy_kcal: 350,
    quick_protein_g: 20,
    quick_fat_g: 5,
    quick_carbohydrate_g: 50
  }
]
```

### customFoods 结构

```
[
  {
    id: number,
    food_name: string,
    energy_kcal: number,
    protein_g: number,
    fat_g: number,
    carbohydrate_g: number,
    na_mg?: number,
    image_url?: string  // 仅保存“路径”（如 /uploads/xxx.jpg），不含协议与域名
    // 其余维生素/矿物质字段可能存在（数值型）
  }
]
```

### foodNutritionData 结构（缓存）

```
[
  {
    id: number,
    food_name: string,
    energy_kcal: number,
    protein_g?: number,
    fat_g?: number,
    carbohydrate_g?: number
  }
]
```

### recentFoods 结构（用于回填/展示）

```
[
  {
    id: number,
    type: 'standard' | 'custom',
    display_name: string,
    display_energy_kcal: number,
    // 可能包含 protein_g / fat_g / carbohydrate_g
  }
]
```

### 统一写入接口（必须使用）

- 饮食记录：
  - `getApp().addDietRecordWithSync(recordData)`
  - `getApp().updateDietRecordWithSync(recordId, recordData)`
  - `getApp().deleteDietRecordWithSync(recordId)`
  - 内部保证：云端成功 → `saveDietRecordsToLocal(records)`；并兜底补齐关键字段与规范日期。

- 自定义食物：
  - `getApp().addCustomFoodWithSync(foodData)`
  - `getApp().updateCustomFoodWithSync(foodId, foodData)`
  - `getApp().deleteCustomFoodWithSync(foodId)`
  - 内部保证：云端成功 → `saveCustomFoodsToLocal(customFoods)`。
  - 图片字段规范：写入前使用 `normalizeImageUrlToPath(url)` 转为路径；读取显示时使用 `buildImageUrl(path)` 拼接为完整 URL（基于 `serverUrl`）。

- 登录刷新：
  - `getApp().wxLogin()` 成功后并行拉取 用户信息 / 全部饮食记录 / 自定义食物，并分别写入 `userInfo`、`dietRecords`、`customFoods`。

### 运动本地结构与键

- 基础字典缓存（可选）：
  - `exerciseTypes`: 数组<{ id: number, code?: string, name: string, description?: string }>
  - `exerciseCalcMethods`: 数组<{
      id: number,
      type_id: number,
      calc_method: 'met_fixed'|'acsm_walking'|'acsm_running'|'cycling_speed_table'|'cycling_power'|'swimming_stroke'|'interval_weighted',
      params_schema: object,
      description?: string
    }>
  - 各映射缓存（可选，用于离线）：
    - `cyclingSpeedMap`: 数组<{ method_id:number, speed_min_kmh:number, speed_max_kmh:number, met:number }>
    - `cyclingPowerMap`: 数组<{ method_id:number, power_min_w:number, power_max_w:number, met:number }>
    - `swimmingStrokePaceMap`: 数组<{ method_id:number, stroke:'freestyle'|'breaststroke'|'backstroke'|'butterfly', pace_min_sec_per_100m:number, pace_max_sec_per_100m:number, met:number }>
    - `strengthIntensityMap`: 数组<{ method_id:number, intensity_level:'low'|'moderate'|'high', rpe_min?:number, rpe_max?:number, met:number }>

- `exerciseRecords` 结构（与 `dietRecords` 对齐）：

```
[
  {
    id: number,
    record_date: 'YYYY-MM-DD',
    record_time: 'HH:MM' | '',
    type_id: number,              // 运动类型ID（走路/跑步/骑行/游泳/力量等）
    calc_method: 'met_fixed'|'acsm_walking'|'acsm_running'|'cycling_speed_table'|'cycling_power'|'swimming_stroke'|'interval_weighted',
    duration_min: number,
    met_used?: number,              // 使用的 MET 值
    weight_kg_at_time?: number,
    calories_burned_kcal?: number,  // 客户端计算后可持久化，便于快速显示与统计
    // 可选计算快照（按方法填充，均为可选）：
    distance_km?: number,           // km
    avg_speed_kmh?: number,         // km/h
    incline_percent?: number,       // %
    power_watts?: number,           // W
    stroke?: 'freestyle'|'breaststroke'|'backstroke'|'butterfly',
    pace_sec_per_100m?: number,     // s/100m
    intensity_level?: 'low'|'moderate'|'high',
    rpe?: number,                   // 1~10
    notes?: string,
    // 备注：无模板概念后，不再区分标准/自定义/快速
  }
]
```

- 统一写入接口（需新增，对齐饮食）：
  - `getApp().addExerciseRecordWithSync(recordData)`
  - `getApp().updateExerciseRecordWithSync(recordId, recordData)`
  - `getApp().deleteExerciseRecordWithSync(recordId)`
  - 登录刷新时新增并行拉取：全部运动记录/自定义运动 → 写入 `exerciseRecords`/`customExercises`

### 读取建议

- 运行时优先从 `app.globalData` 读取：`dietRecords`、`customFoods`、`userInfo`、`recentFoods`。
- 如需持久化源数据，使用 `wx.getStorageSync('<key>')`。


