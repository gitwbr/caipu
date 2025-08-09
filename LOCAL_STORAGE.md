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
- customFoods: 数组<自定义食物对象>（见下）
- customFoodsLastUpdate: ISOString
- foodNutritionData: 数组<营养数据对象>
- foodNutritionLastUpdate: number（毫秒时间戳）
- recentFoods: 数组<最近食物对象>
- favorites: 数组（默认空）
- history: 数组（默认空）

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

- 登录刷新：
  - `getApp().wxLogin()` 成功后并行拉取 用户信息 / 全部饮食记录 / 自定义食物，并分别写入 `userInfo`、`dietRecords`、`customFoods`。

### 读取建议

- 运行时优先从 `app.globalData` 读取：`dietRecords`、`customFoods`、`userInfo`、`recentFoods`。
- 如需持久化源数据，使用 `wx.getStorageSync('<key>')`。


