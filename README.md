# AI菜谱助手 - 微信小程序

一个基于微信小程序的 AI 菜谱与饮食记录项目。用户可以按主料、菜品类型、菜系风格、口味、烹饪方式、厨房环境生成更接近家庭厨房的菜谱，并在详情页中调整食材数量、收藏菜谱、记录到饮食。

## 当前功能

### 首页生成
- 支持 6 个维度生成菜谱：食材、菜品类型、菜系风格、口味、烹饪方式、厨房环境
- 未选择的维度会由 AI 按“普通家庭厨房、最自然、最能做成”的方向自动补全
- 首页在发起 `/api/ai` 前，会把选择条件组装成结构化 `messages`

### 菜谱详情
- 展示菜名、描述、标签、食材、步骤、技巧
- 支持直接调整食材数量并实时重算营养
- 支持 `g / ml` 共存
- 营养按各食材自己的 `nutrition_basis_unit` 计算，不做 `g` 和 `ml` 互转

### 收藏与记录
- 可将菜谱加入收藏
- 收藏后可补传图片并更新菜谱详情
- 可从菜谱详情页直接“记录到饮食”

## 技术架构

### 前端
- 微信小程序原生开发
- WXML + WXSS + JavaScript

### AI 调用
- 前端组装结构化提示词
- 后端统一代理 `/api/ai`
- 后端可接 OpenAI 或 DeepSeek

### 后端
- Node.js + Express
- 主要接口实现位于 `api_remote.js`

### 数据库
- PostgreSQL
- 菜谱收藏使用 `JSONB` 保存完整菜谱详情

## 数据存储说明

这是当前项目里最重要的一部分。

### 1. 最近生成历史
- 存储位置：本地
- 本地键名：`history`
- 用途：保存最近生成过的菜谱，供首页“最近厨房笔记”展示
- 特点：不走独立服务器接口

### 2. 菜谱详情页数据来源
- 当前没有独立的“菜谱详情查询接口”，例如没有 `/api/recipes/:id`
- 详情页的数据来源有两种：
  - 首页生成后，通过页面参数直接把整份 `recipe` JSON 传给详情页
  - 从收藏页进入时，优先使用本地收藏里的菜谱数据

也就是说，菜谱详情页本身不是“打开后再去服务器拉详情”，而是直接使用导航时带入的菜谱对象，或者收藏缓存里的 `recipe_data`

### 3. 菜谱收藏
- 存储位置：本地 + 服务器双写
- 本地键名：`favorites`
- 服务器表：`recipe_favorites`

当前数据库结构里，收藏表的核心字段是：

```sql
CREATE TABLE recipe_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id VARCHAR(255) NOT NULL,
    recipe_name VARCHAR(255) NOT NULL,
    recipe_data JSONB NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, recipe_id)
);
```

这里最关键的是：
- `recipe_id`：菜谱逻辑 ID
- `recipe_name`：菜谱名称
- `recipe_data JSONB`：完整菜谱详情
- `image_url`：收藏图片路径，通常是 `/uploads/...`

也就是说，收藏时不是拆成很多张菜谱子表，而是把完整菜谱对象直接存进 `recipe_data JSONB`

### 4. 饮食记录
- 存储位置：服务器为主，本地同步缓存
- 服务器接口：`/api/diet-records`
- 用途：把某次吃了什么、摄入多少热量记录下来

注意：
- “收藏菜谱” 和 “记录到饮食” 是两条不同的数据链路
- 收藏是存菜谱详情
- 饮食记录是存某次吃这道菜这件事

## 关键接口

### AI 生成
- `POST /api/ai`
- 说明：前端传入 `messages`，后端代理到实际大模型服务

### 收藏相关
- `POST /api/favorites`
  - 新增收藏
- `GET /api/favorites`
  - 获取收藏列表
- `PUT /api/favorites/:id`
  - 按收藏记录 ID 更新
- `PUT /api/favorites/recipe/:recipeId`
  - 按菜谱逻辑 ID 更新
- `DELETE /api/favorites/:id`
  - 删除收藏

### 图片上传
- `POST /api/upload-image`
- 说明：上传收藏图片，返回 `/uploads/...` 路径

### 饮食记录
- `POST /api/diet-records`
- `GET /api/diet-records`
- `PUT /api/diet-records/:id`
- `DELETE /api/diet-records/:id`

## 当前菜谱对象结构

当前前端和收藏 `recipe_data` 使用的核心结构大致如下：

```json
{
  "id": "1742450000000",
  "name": "番茄鸡胸肉炒蛋",
  "description": "用现有主料做成的一道家常快手菜。",
  "ingredients": [
    {
      "name": "鸡胸肉",
      "amount": "150g",
      "nutrition_per_100": {
        "calories": 133,
        "protein": 19.4,
        "fat": 5,
        "carbohydrates": 0
      },
      "nutrition_basis_unit": "g"
    },
    {
      "name": "番茄汁",
      "amount": "120ml",
      "nutrition_per_100": {
        "calories": 20,
        "protein": 0.8,
        "fat": 0.2,
        "carbohydrates": 4.2
      },
      "nutrition_basis_unit": "ml"
    }
  ],
  "steps": [
    "鸡胸肉切片后加少量调味抓匀。",
    "热锅下油，先炒鸡胸肉至变色。",
    "加入番茄继续翻炒，收汁后出锅。"
  ],
  "tips": "鸡胸肉不要炒太久，避免口感发柴。",
  "tags": ["家常菜", "下饭", "快手"]
}
```

兼容说明：
- 新数据使用 `nutrition_per_100 + nutrition_basis_unit`
- 旧数据中的 `nutrition_per_100g` 仍会在前端做兼容归一化

## 项目结构

```text
caipu/
├── app.js
├── app.json
├── app.wxss
├── api_remote.js
├── DATABASE_TABELS.md
├── README.md
├── pages/
│   ├── index/
│   ├── recipe/
│   ├── favorites/
│   ├── record/
│   ├── profile/
│   ├── exercise/
│   └── weight/
└── custom-tab-bar/
```

## 本地开发

### 前端
1. 使用微信开发者工具导入项目
2. 配置 `project.config.json` 中的小程序信息
3. 确认 `app.js` 中的 `serverUrl` 指向可用后端

### 后端
后端服务需要提供：
- AI 代理
- 登录鉴权
- 收藏接口
- 饮食记录接口
- 图片上传接口

### AI 密钥
当前实现里，模型密钥由后端管理，不放在前端

也就是说：
- 前端只请求 `/api/ai`
- OpenAI / DeepSeek 的 Key 放在后端环境变量中

## 文档补充

- 更完整的数据库表结构见 `DATABASE_TABELS.md`
- 主要后端接口实现见 `api_remote.js`
- 收藏与本地同步逻辑见 `app.js`
- 菜谱详情页逻辑见 `pages/recipe/recipe.js`

## 备注

如果后续要把“菜谱详情”独立成真正的服务端资源，可以再补一套例如：
- `POST /api/recipes`
- `GET /api/recipes/:id`
- `PUT /api/recipes/:id`

但当前版本还没有这层抽象，菜谱详情主要依附于：
- 首页生成结果
- 本地历史
- 收藏表中的 `recipe_data JSONB`
