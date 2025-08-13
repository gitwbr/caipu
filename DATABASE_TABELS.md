// --- 数据库表结构说明 ---
/*
-- 创建 users 表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,                          -- 用户ID，自增主键
    openid VARCHAR(255) UNIQUE NOT NULL,            -- 微信用户的唯一标识
    session_key VARCHAR(255) NOT NULL,              -- 微信 session_key，用于解密敏感数据
    nickname VARCHAR(255),                          -- 用户昵称
    avatar_url TEXT,                                -- 用户头像链接
    last_login_at TIMESTAMP WITH TIME ZONE,         -- 最后登录时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  -- 更新时间
);

-- 为 openid 创建索引，提高查询速度
CREATE UNIQUE INDEX idx_users_openid ON users(openid);

-- 创建一个函数，用于在更新行时自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建一个触发器，在 users 表的任何行更新之前，调用 update_timestamp 函数
CREATE TRIGGER trigger_update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- 给表和字段添加注释，方便理解
COMMENT ON TABLE users IS '用户信息表';
COMMENT ON COLUMN users.id IS '用户ID，自增主键';
COMMENT ON COLUMN users.openid IS '微信用户的唯一标识';
COMMENT ON COLUMN users.session_key IS '微信 session_key';
COMMENT ON COLUMN users.nickname IS '用户昵称';
COMMENT ON COLUMN users.avatar_url IS '用户头像链接';
COMMENT ON COLUMN users.last_login_at IS '最后登录时间';
COMMENT ON COLUMN users.created_at IS '记录创建时间';
COMMENT ON COLUMN users.updated_at IS '记录更新时间';


-- 用户使用限制表 (user_limits) - 只记录每日生成次数
CREATE TABLE user_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    daily_generation_count INTEGER DEFAULT 0,
    daily_generation_limit INTEGER DEFAULT 10, -- 每日生成限制
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- 菜谱收藏表 (recipe_favorites) - 记录用户收藏的菜谱
CREATE TABLE recipe_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id VARCHAR(255) NOT NULL, -- 菜谱唯一标识
    recipe_name VARCHAR(255) NOT NULL,
    recipe_data JSONB NOT NULL, -- 完整的菜谱数据
    image_url TEXT, -- 收藏图片URL（仅路径 /uploads/...）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, recipe_id)
);


-- 收藏总数限制：100个（通过代码控制，不存储在数据库中）
-- 创建 users 表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,                          -- 用户ID，自增主键
    openid VARCHAR(255) UNIQUE NOT NULL,            -- 微信用户的唯一标识
    session_key VARCHAR(255) NOT NULL,              -- 微信 session_key，用于解密敏感数据
    nickname VARCHAR(255),                          -- 用户昵称
    avatar_url TEXT,                                -- 用户头像链接
    last_login_at TIMESTAMP WITH TIME ZONE,         -- 最后登录时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  -- 更新时间
);

    -- 为 openid 创建索引，提高查询速度
    CREATE UNIQUE INDEX idx_users_openid ON users(openid);

    -- 创建一个函数，用于在更新行时自动更新 updated_at 字段
    CREATE OR REPLACE FUNCTION update_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- 创建一个触发器，在 users 表的任何行更新之前，调用 update_timestamp 函数
    CREATE TRIGGER trigger_update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

    -- 给表和字段添加注释，方便理解
    COMMENT ON TABLE users IS '用户信息表';
    COMMENT ON COLUMN users.id IS '用户ID，自增主键';
    COMMENT ON COLUMN users.openid IS '微信用户的唯一标识';
    COMMENT ON COLUMN users.session_key IS '微信 session_key';
    COMMENT ON COLUMN users.nickname IS '用户昵称';
    COMMENT ON COLUMN users.avatar_url IS '用户头像链接';
    COMMENT ON COLUMN users.last_login_at IS '最后登录时间';
    COMMENT ON COLUMN users.created_at IS '记录创建时间';
    COMMENT ON COLUMN users.updated_at IS '记录更新时间';

-- 用户表 (users) - 需要添加生日、身高、体重、性别字段
-- ALTER TABLE users ADD COLUMN birthday DATE;
-- ALTER TABLE users ADD COLUMN height_cm DECIMAL(5,2);
-- ALTER TABLE users ADD COLUMN weight_kg DECIMAL(5,2);
-- ALTER TABLE users ADD COLUMN gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other'));


-- 更新后的 user_custom_foods 表结构
CREATE TABLE user_custom_foods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name VARCHAR(255) NOT NULL, -- 食物名称
    energy_kcal DECIMAL(8,2) NOT NULL, -- 每100g卡路里
    protein_g DECIMAL(8,2) DEFAULT 0, -- 每100g蛋白质
    fat_g DECIMAL(8,2) DEFAULT 0, -- 每100g脂肪
    carbohydrate_g DECIMAL(8,2) DEFAULT 0, -- 每100g碳水化合物
    fiber_g DECIMAL(8,2) DEFAULT 0, -- 每100g膳食纤维
    moisture_g DECIMAL(10,2) DEFAULT 0, -- 水分 (g/100 g)
    vitamin_a_ug DECIMAL(10,2) DEFAULT 0, -- 维生素A (µg RAE/100 g)
    vitamin_b1_mg DECIMAL(10,2) DEFAULT 0, -- 维生素B₁ (mg/100 g)
    vitamin_b2_mg DECIMAL(10,2) DEFAULT 0, -- 维生素B₂ (mg/100 g)
    vitamin_b3_mg DECIMAL(10,2) DEFAULT 0, -- 维生素B₃/烟酸 (mg/100 g)
    vitamin_e_mg DECIMAL(10,2) DEFAULT 0, -- 维生素E (mg/100 g)
    na_mg DECIMAL(10,2) DEFAULT 0, -- 钠 (mg/100 g)
    ca_mg DECIMAL(10,2) DEFAULT 0, -- 钙 (mg/100 g)
    fe_mg DECIMAL(10,2) DEFAULT 0, -- 铁 (mg/100 g)
    vitamin_c_mg DECIMAL(10,2) DEFAULT 0, -- 维生素C (mg/100 g)
    cholesterol_mg DECIMAL(10,2) DEFAULT 0, -- 胆固醇 (mg/100 g)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, food_name) -- 同一用户不能有重名的自定义食物
);

-- 饮食记录表（简化版）
CREATE TABLE diet_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id INTEGER REFERENCES food_nutrition_cn(id), -- 标准食物ID
    custom_food_id INTEGER REFERENCES user_custom_foods(id), -- 自定义食物ID
    quantity_g DECIMAL(8,2) NOT NULL, -- 摄入量（克）
    record_date DATE NOT NULL DEFAULT CURRENT_DATE, -- 记录日期
    record_time TIME NOT NULL DEFAULT CURRENT_TIME, -- 记录时间
    notes TEXT, -- 备注
    -- 快速记录相关字段
    record_type VARCHAR(20) DEFAULT 'standard' CHECK (record_type IN ('standard', 'custom', 'quick', 'recipe')), -- 记录类型（新增 recipe：菜谱总营养快照）
    -- 下列 5 个字段为“快速/菜谱”公用快照字段（菜谱沿用 quick_* 字段，不新加列）
    quick_food_name VARCHAR(255), -- 快速/菜谱 记录食物/菜名
    quick_energy_kcal DECIMAL(8,2), -- 快速/菜谱 总热量（千卡）
    quick_protein_g DECIMAL(8,2) DEFAULT 0, -- 快速/菜谱 蛋白质（克）
    quick_fat_g DECIMAL(8,2) DEFAULT 0, -- 快速/菜谱 脂肪（克）
    quick_carbohydrate_g DECIMAL(8,2) DEFAULT 0, -- 快速/菜谱 碳水化合物（克）
    quick_image_url TEXT, --（可选）快速/菜谱 图片URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- 确保要么是标准食物，要么是自定义食物，要么是快速记录
    CONSTRAINT check_food_type CHECK (
        (record_type = 'standard' AND food_id IS NOT NULL AND custom_food_id IS NULL) OR
        (record_type = 'custom'   AND food_id IS NULL AND custom_food_id IS NOT NULL) OR
        (record_type = 'quick'    AND food_id IS NULL AND custom_food_id IS NULL AND quick_energy_kcal IS NOT NULL) OR
        (record_type = 'recipe'   AND food_id IS NULL AND custom_food_id IS NULL AND quick_energy_kcal IS NOT NULL)
    )
);

 -- 添加索引以提高查询性能
CREATE INDEX idx_diet_records_user_date ON diet_records(user_id, record_date);
CREATE INDEX idx_diet_records_date ON diet_records(record_date);
CREATE INDEX idx_user_custom_foods_user_id ON user_custom_foods(user_id);

-- 基础代谢率(BMR)通过用户的身高、体重、年龄、性别在本地计算，不需要单独的目标表
 
 
 -- =============================
 -- 运动相关表（与饮食结构风格对齐）
 -- 设计目标（每个运动仅一种计算方式）：
 -- 1) 类型表（exercise_types）：走路/跑步/力量/骑行/游泳/HIIT/瑜伽；
 -- 2) 计算方法（exercise_calc_methods）：每种类型恰好一种 calc_method + params_schema；
 --    - 走路：acsm_walking；跑步：acsm_running；骑行：cycling_speed_table；
 --    - 游泳：swimming_stroke；力量/HIIT/瑜伽：met_fixed（用强度/RPE 映射 MET）；
 -- 3) 映射表：仅保留所需映射（骑行速度、泳姿配速、强度RPE）；
 -- 4) 记录表（exercise_records）：仅存事实快照（type_id + calc_method + 参数 + met_used + calories_burned_kcal 等）；
 -- 5) 记录时间字段对齐饮食：record_date、record_time。
 
 -- 运动类型表（如：走路、跑步、力量训练、骑行、游泳、HIIT、瑜伽等）
 -- 说明：类型是大类，用于归类与筛选；标准库与自定义运动均指向此类型
 CREATE TABLE exercise_types (
     id SERIAL PRIMARY KEY,                                          -- 主键
     code VARCHAR(100) UNIQUE,                                       -- 类型编码（英文标识，如 walking/running/strength/cycling/swimming/hiit/yoga）
     name VARCHAR(100) UNIQUE NOT NULL,                              -- 类型名称（中文，如“走路/跑步/力量训练”等）
     description TEXT,                                               -- 说明
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP   -- 更新时间
 );
 CREATE TRIGGER trigger_update_exercise_types_timestamp
 BEFORE UPDATE ON exercise_types
 FOR EACH ROW
 EXECUTE FUNCTION update_timestamp();
 
 -- 运动计算方法（按类型配置，用于驱动参数表单与计算路径）
 -- 说明：
 -- - 统一换算公式：kcal = MET × 3.5 × 体重(kg) / 200 × 时长(min)
 -- - calc_method：计算方法（决定如何从参数得到 MET 或直接给出 MET）
 --   可选值：
 --     met_fixed            固定 MET（力量、瑜伽等按强度/RPE估算）
 --     acsm_walking         ACSM 走路公式（速度/坡度→MET）
 --     acsm_running         ACSM 跑步公式（速度/坡度→MET）
 --     cycling_speed_table  骑行按速度映射 MET
 --     cycling_power        骑行按功率估算 MET
 --     swimming_stroke      游泳按泳姿+配速映射 MET
 --     interval_weighted    间歇训练按分段加权 MET（前端按分段求加权平均 MET）
 -- - params_schema：JSONB，定义该方法所需参数（字段、类型、单位、范围、默认值），用于前端动态表单
 CREATE TABLE exercise_calc_methods (
     id SERIAL PRIMARY KEY,                                          -- 主键
     type_id INTEGER NOT NULL REFERENCES exercise_types(id) ON DELETE CASCADE, -- 运动类型ID
     calc_method VARCHAR(32) NOT NULL CHECK (
         calc_method IN (
           'met_fixed','acsm_walking','acsm_running',
           'cycling_speed_table','cycling_power','swimming_stroke','interval_weighted'
         )
     ),                                                              -- 计算方法
     params_schema JSONB NOT NULL,                                   -- 参数schema（如 {"speed_kmh":{"type":"number","unit":"km/h"}, ...}）
     description TEXT,                                               -- 说明
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
     UNIQUE(type_id, calc_method)
 );
 CREATE INDEX idx_exercise_calc_methods_type_id ON exercise_calc_methods(type_id);
 CREATE TRIGGER trigger_update_exercise_calc_methods_timestamp
 BEFORE UPDATE ON exercise_calc_methods
 FOR EACH ROW
 EXECUTE FUNCTION update_timestamp();
 
 -- 计算方法映射表：用于从参数求 MET（不同方法各有对应映射）
 -- 1) 骑行（按速度映射 MET）
 CREATE TABLE cycling_speed_map (
     id SERIAL PRIMARY KEY,
     method_id INTEGER NOT NULL REFERENCES exercise_calc_methods(id) ON DELETE CASCADE,
     speed_min_kmh DECIMAL(6,2) NOT NULL CHECK (speed_min_kmh >= 0),
     speed_max_kmh DECIMAL(6,2) NOT NULL CHECK (speed_max_kmh > speed_min_kmh),
     met DECIMAL(5,2) NOT NULL CHECK (met > 0),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 );
 CREATE INDEX idx_cycling_speed_map_method_id ON cycling_speed_map(method_id);
 
 -- 2) 骑行（按功率映射 MET）
 CREATE TABLE cycling_power_map (
     id SERIAL PRIMARY KEY,
     method_id INTEGER NOT NULL REFERENCES exercise_calc_methods(id) ON DELETE CASCADE,
     power_min_w DECIMAL(7,2) NOT NULL CHECK (power_min_w >= 0),
     power_max_w DECIMAL(7,2) NOT NULL CHECK (power_max_w > power_min_w),
     met DECIMAL(5,2) NOT NULL CHECK (met > 0),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 );
 CREATE INDEX idx_cycling_power_map_method_id ON cycling_power_map(method_id);
 
 -- 3) 游泳（按泳姿+配速映射 MET）
 CREATE TABLE swimming_stroke_pace_map (
     id SERIAL PRIMARY KEY,
     method_id INTEGER NOT NULL REFERENCES exercise_calc_methods(id) ON DELETE CASCADE,
     stroke VARCHAR(32) NOT NULL CHECK (stroke IN ('freestyle','breaststroke','backstroke','butterfly')),
     pace_min_sec_per_100m INTEGER NOT NULL CHECK (pace_min_sec_per_100m > 0),
     pace_max_sec_per_100m INTEGER NOT NULL CHECK (pace_max_sec_per_100m > pace_min_sec_per_100m),
     met DECIMAL(5,2) NOT NULL CHECK (met > 0),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 );
 CREATE INDEX idx_swimming_stroke_pace_map_method_id ON swimming_stroke_pace_map(method_id);
 
 -- 4) 力量训练（按强度/RPE 映射 MET）
 CREATE TABLE strength_intensity_map (
     id SERIAL PRIMARY KEY,
     method_id INTEGER NOT NULL REFERENCES exercise_calc_methods(id) ON DELETE CASCADE,
     intensity_level VARCHAR(20) CHECK (intensity_level IN ('low','moderate','high')),
     rpe_min SMALLINT CHECK (rpe_min BETWEEN 1 AND 10),
     rpe_max SMALLINT CHECK (rpe_max BETWEEN 1 AND 10 AND rpe_max >= rpe_min),
     met DECIMAL(5,2) NOT NULL CHECK (met > 0),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 );
 CREATE INDEX idx_strength_intensity_map_method_id ON strength_intensity_map(method_id);
 
 -- 移除“模板”概念后，不再需要用户自定义模板表
 
  -- 运动记录表（仅存事实快照，页面选类型与方法，填参数后计算写入快照）
  -- 说明：
  -- - duration_min 为记录时长(分钟)；
  -- - met_used 存当时使用的 MET；
  -- - weight_kg_at_time 记录当时体重；
  -- - calories_burned_kcal 客户端计算写入，便于直接显示与统计；
  -- - type_id + calc_method 决定了该条记录的计算路径（所需参数由方法的 params_schema 定义）；
  -- - 可选快照字段按方法填充（速度/坡度/泳姿/配速/功率/强度/RPE等）
  -- - 记录时间字段：record_date、record_time
  CREATE TABLE exercise_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type_id INTEGER NOT NULL REFERENCES exercise_types(id),
      calc_method VARCHAR(32) NOT NULL CHECK (
          calc_method IN (
            'met_fixed','acsm_walking','acsm_running',
            'cycling_speed_table','cycling_power','swimming_stroke','interval_weighted'
          )
      ),
      duration_min DECIMAL(8,2) NOT NULL CHECK (duration_min > 0),
      met_used DECIMAL(5,2),
      weight_kg_at_time DECIMAL(5,2),
      calories_burned_kcal DECIMAL(10,2),
      -- 计算过程参数快照（按方法填充，均为可选）
      distance_km DECIMAL(8,3),                 -- 距离（公里）
      avg_speed_kmh DECIMAL(8,3),               -- 平均速度（公里/小时）
      incline_percent DECIMAL(6,3),             -- 坡度（百分比）
      power_watts DECIMAL(8,2),                 -- 功率（瓦）
      stroke VARCHAR(32),                       -- 泳姿（freestyle/breaststroke/backstroke/butterfly）
      pace_sec_per_100m INTEGER,                -- 配速（每100米秒数）
      intensity_level VARCHAR(20) CHECK (intensity_level IN ('low','moderate','high')), -- 强度等级
      rpe SMALLINT CHECK (rpe BETWEEN 1 AND 10),-- 主观用力感受（1~10）
      record_date DATE NOT NULL DEFAULT CURRENT_DATE,
      record_time TIME NOT NULL DEFAULT CURRENT_TIME,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
 
 -- 运动记录索引
 CREATE INDEX idx_exercise_records_user_date ON exercise_records(user_id, record_date);
 CREATE INDEX idx_exercise_records_date ON exercise_records(record_date);

 -- =============================
 -- 基础数据初始化（类型、方法与映射表）
 -- 说明：仅为示例/默认值，便于前端联调与本地计算；后续可按需要扩充或调整

  -- 1) 运动类型（走路/跑步/骑行/游泳/力量/HIIT/瑜伽）
 INSERT INTO exercise_types(code, name, description) VALUES
   ('walking',  '走路',    '日常步行/快走'),
   ('running',  '跑步',    '慢跑/中速/快速'),
   ('cycling',  '骑行',    '公路骑行/动感单车'),
   ('swimming', '游泳',    '自由泳/蛙泳/仰泳/蝶泳'),
   ('strength', '力量训练',  '器械/徒手等阻力训练'),
   ('hiit',     'HIIT',    '高强度间歇训练'),
   ('yoga',     '瑜伽',    '静力拉伸/体式/呼吸')
 ON CONFLICT (code) DO NOTHING;

  -- 新增：跳绳
  INSERT INTO exercise_types(code, name, description) VALUES
    ('jump_rope', '跳绳', '基础跳绳/双摇/间歇')
  ON CONFLICT (code) DO NOTHING;

 -- 2) 计算方法（按类型配置）+ 参数 schema（驱动前端动态表单）
  -- 走路：ACSM 走路（速度/坡度→MET）
 INSERT INTO exercise_calc_methods(type_id, calc_method, params_schema, description)
 VALUES (
   (SELECT id FROM exercise_types WHERE code='walking'),
   'acsm_walking',
   '{
      "speed_kmh": {"type":"number","unit":"km/h","min":1,"max":8,"step":0.1},
      "incline_percent": {"type":"number","unit":"%","min":0,"max":20,"step":0.5},
      "weight_kg_at_time": {"type":"number","unit":"kg","min":20,"max":200,"step":0.5},
      "duration_min": {"type":"number","unit":"min","min":5,"max":300,"step":1}
    }'::jsonb,
   'ACSM 走路：速度/坡度 → VO2 → MET'
 ) ON CONFLICT DO NOTHING;

  -- 跑步：ACSM 跑步（速度/坡度→MET）
 INSERT INTO exercise_calc_methods(type_id, calc_method, params_schema, description)
 VALUES (
   (SELECT id FROM exercise_types WHERE code='running'),
   'acsm_running',
   '{
      "speed_kmh": {"type":"number","unit":"km/h","min":5,"max":25,"step":0.1},
      "incline_percent": {"type":"number","unit":"%","min":0,"max":20,"step":0.5},
      "weight_kg_at_time": {"type":"number","unit":"kg","min":20,"max":200,"step":0.5},
      "duration_min": {"type":"number","unit":"min","min":5,"max":300,"step":1}
    }'::jsonb,
   'ACSM 跑步：速度/坡度 → VO2 → MET'
 ) ON CONFLICT DO NOTHING;

  -- 骑行：按速度映射 MET（仅保留速度表法）
 INSERT INTO exercise_calc_methods(type_id, calc_method, params_schema, description)
 VALUES (
   (SELECT id FROM exercise_types WHERE code='cycling'),
   'cycling_speed_table',
   '{
      "speed_kmh": {"type":"number","unit":"km/h","min":0,"max":100,"step":0.1},
      "weight_kg_at_time": {"type":"number","unit":"kg","min":20,"max":200,"step":0.5},
      "duration_min": {"type":"number","unit":"min","min":5,"max":300,"step":1}
    }'::jsonb,
   '骑行：速度区间 → MET'
 ) ON CONFLICT DO NOTHING;

  -- （每类型仅一种方法，故去掉 cycling_power）

   -- 游泳：按泳姿 + 配速映射 MET（推荐 60~300 s/100m，兼容进阶泳者）
 INSERT INTO exercise_calc_methods(type_id, calc_method, params_schema, description)
 VALUES (
   (SELECT id FROM exercise_types WHERE code='swimming'),
   'swimming_stroke',
   '{
      "stroke": {"type":"enum","enum":["freestyle","breaststroke","backstroke","butterfly"],"labels":{"freestyle":"自由泳","breaststroke":"蛙泳","backstroke":"仰泳","butterfly":"蝶泳"}},
      "pace_sec_per_100m": {"type":"number","unit":"s/100m","min":60,"max":300,"step":1},
      "weight_kg_at_time": {"type":"number","unit":"kg","min":20,"max":200,"step":0.5},
      "duration_min": {"type":"number","unit":"min","min":5,"max":300,"step":1}
    }'::jsonb,
   '游泳：泳姿 + 配速 → MET'
 ) ON CONFLICT DO NOTHING;

  -- 力量/HIIT/瑜伽：按强度/RPE 映射 MET（固定 MET）
 INSERT INTO exercise_calc_methods(type_id, calc_method, params_schema, description)
 VALUES (
    (SELECT id FROM exercise_types WHERE code='strength'),
   'met_fixed',
   '{
      "intensity_level": {"type":"enum","enum":["low","moderate","high"],"labels":{"low":"低强度","moderate":"中等强度","high":"高强度"}},
      "rpe": {"type":"number","unit":"1-10","min":1,"max":10,"step":1},
      "duration_min": {"type":"number","unit":"min","min":5,"max":180,"step":1},
      "weight_kg_at_time": {"type":"number","unit":"kg","min":20,"max":200,"step":0.5}
    }'::jsonb,
   '力量：按强度/RPE 映射固定 MET'
 ) ON CONFLICT DO NOTHING;

  -- HIIT：met_fixed
  INSERT INTO exercise_calc_methods(type_id, calc_method, params_schema, description)
  VALUES (
    (SELECT id FROM exercise_types WHERE code='hiit'),
    'met_fixed',
    '{
       "intensity_level": {"type":"enum","enum":["low","moderate","high"],"labels":{"low":"低强度","moderate":"中等强度","high":"高强度"}},
       "rpe": {"type":"number","unit":"1-10","min":1,"max":10,"step":1},
       "duration_min": {"type":"number","unit":"min","min":5,"max":90,"step":1},
       "weight_kg_at_time": {"type":"number","unit":"kg","min":20,"max":200,"step":0.5}
     }'::jsonb,
    'HIIT：强度/RPE → MET（前端可按分段自加权，但存单值）'
  ) ON CONFLICT DO NOTHING;

  -- 瑜伽：met_fixed（普遍较低 MET）
  INSERT INTO exercise_calc_methods(type_id, calc_method, params_schema, description)
  VALUES (
    (SELECT id FROM exercise_types WHERE code='yoga'),
    'met_fixed',
    '{
       "intensity_level": {"type":"enum","enum":["low","moderate"],"labels":{"low":"轻柔","moderate":"力量瑜伽/流瑜伽"}},
       "duration_min": {"type":"number","unit":"min","min":10,"max":180,"step":5},
       "weight_kg_at_time": {"type":"number","unit":"kg","min":20,"max":200,"step":0.5}
     }'::jsonb,
    '瑜伽：按强度估算 MET'
  ) ON CONFLICT DO NOTHING;

  -- 跳绳：met_fixed（按强度/RPE 估算 MET）
  INSERT INTO exercise_calc_methods(type_id, calc_method, params_schema, description)
  VALUES (
    (SELECT id FROM exercise_types WHERE code='jump_rope'),
    'met_fixed',
    '{
       "intensity_level": {"type":"enum","enum":["low","moderate","high"],"labels":{"low":"低强度","moderate":"中等强度","high":"高强度"}},
       "rpe": {"type":"number","unit":"1-10","min":1,"max":10,"step":1},
       "duration_min": {"type":"number","unit":"min","min":5,"max":120,"step":1},
       "weight_kg_at_time": {"type":"number","unit":"kg","min":20,"max":200,"step":0.5}
     }'::jsonb,
    '跳绳：按强度或 RPE 估算 MET（基础/双摇/间歇）'
  ) ON CONFLICT DO NOTHING;

  -- 3) 映射表基础数据（仅针对保留的方法：骑行速度/游泳配速/强度RPE）
 -- 骑行：速度→MET（示例区间，按公开经验值近似）
 INSERT INTO cycling_speed_map(method_id, speed_min_kmh, speed_max_kmh, met) VALUES
   ((SELECT id FROM exercise_calc_methods WHERE calc_method='cycling_speed_table' AND type_id=(SELECT id FROM exercise_types WHERE code='cycling')),  0.0, 15.9, 4.0),
   ((SELECT id FROM exercise_calc_methods WHERE calc_method='cycling_speed_table' AND type_id=(SELECT id FROM exercise_types WHERE code='cycling')), 16.0, 19.9, 6.0),
   ((SELECT id FROM exercise_calc_methods WHERE calc_method='cycling_speed_table' AND type_id=(SELECT id FROM exercise_types WHERE code='cycling')), 20.0, 22.9, 8.0),
   ((SELECT id FROM exercise_calc_methods WHERE calc_method='cycling_speed_table' AND type_id=(SELECT id FROM exercise_types WHERE code='cycling')), 23.0, 25.9,10.0),
   ((SELECT id FROM exercise_calc_methods WHERE calc_method='cycling_speed_table' AND type_id=(SELECT id FROM exercise_types WHERE code='cycling')), 26.0, 30.9,12.0),
   ((SELECT id FROM exercise_calc_methods WHERE calc_method='cycling_speed_table' AND type_id=(SELECT id FROM exercise_types WHERE code='cycling')), 31.0,100.0,16.0);

  -- （去除功率映射，按速度法即可）

 -- 游泳：泳姿+配速→MET（示例区间，按公开经验值近似；配速为每100m秒数）
 -- 自由泳
INSERT INTO swimming_stroke_pace_map(method_id, stroke, pace_min_sec_per_100m, pace_max_sec_per_100m, met) VALUES
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'freestyle', 150, 180, 6.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'freestyle', 130, 149, 8.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'freestyle', 110, 129,10.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'freestyle',  95, 109,12.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'freestyle',  80,  94,14.0);
 -- 蛙泳
INSERT INTO swimming_stroke_pace_map(method_id, stroke, pace_min_sec_per_100m, pace_max_sec_per_100m, met) VALUES
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'breaststroke', 180, 220, 6.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'breaststroke', 160, 179, 8.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'breaststroke', 140, 159,10.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'breaststroke', 120, 139,12.0);
 -- 仰泳
INSERT INTO swimming_stroke_pace_map(method_id, stroke, pace_min_sec_per_100m, pace_max_sec_per_100m, met) VALUES
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'backstroke', 150, 180, 6.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'backstroke', 130, 149, 8.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'backstroke', 110, 129,10.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'backstroke',  95, 109,12.0);
 -- 蝶泳
INSERT INTO swimming_stroke_pace_map(method_id, stroke, pace_min_sec_per_100m, pace_max_sec_per_100m, met) VALUES
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'butterfly', 150, 180, 8.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'butterfly', 130, 149,10.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'butterfly', 110, 129,12.0),
  ((SELECT id FROM exercise_calc_methods WHERE calc_method='swimming_stroke' AND type_id=(SELECT id FROM exercise_types WHERE code='swimming')), 'butterfly',  90, 109,14.0);

 -- 力量：强度/RPE → MET（示例）
 INSERT INTO strength_intensity_map(method_id, intensity_level, rpe_min, rpe_max, met) VALUES
   ((SELECT id FROM exercise_calc_methods WHERE calc_method='met_fixed' AND type_id=(SELECT id FROM exercise_types WHERE code='strength')), 'low',      3, 5, 3.5),
   ((SELECT id FROM exercise_calc_methods WHERE calc_method='met_fixed' AND type_id=(SELECT id FROM exercise_types WHERE code='strength')), 'moderate', 6, 7, 5.0),
   ((SELECT id FROM exercise_calc_methods WHERE calc_method='met_fixed' AND type_id=(SELECT id FROM exercise_types WHERE code='strength')), 'high',     8, 9, 6.0);

  -- HIIT：强度/RPE → MET（推荐更高的代谢当量区间）
  -- 说明：强度等级与 RPE 均可触发计算；若两者都提供，以强度为准
  INSERT INTO strength_intensity_map(method_id, intensity_level, rpe_min, rpe_max, met) VALUES
    ((SELECT id FROM exercise_calc_methods WHERE calc_method='met_fixed' AND type_id=(SELECT id FROM exercise_types WHERE code='hiit')), 'low',      5, 6, 6.0),
    ((SELECT id FROM exercise_calc_methods WHERE calc_method='met_fixed' AND type_id=(SELECT id FROM exercise_types WHERE code='hiit')), 'moderate', 7, 8, 8.0),
    ((SELECT id FROM exercise_calc_methods WHERE calc_method='met_fixed' AND type_id=(SELECT id FROM exercise_types WHERE code='hiit')), 'high',     9,10,10.0);

 -- 提示：如需扩充 HIIT，可为 running/cycling/swimming 增加 interval_weighted 方法，前端按分段加权求 MET 后写入记录

  -- 跳绳：强度/RPE → MET（建议值）
  INSERT INTO strength_intensity_map(method_id, intensity_level, rpe_min, rpe_max, met) VALUES
    ((SELECT id FROM exercise_calc_methods WHERE calc_method='met_fixed' AND type_id=(SELECT id FROM exercise_types WHERE code='jump_rope')), 'low',      5, 6, 8.0),
    ((SELECT id FROM exercise_calc_methods WHERE calc_method='met_fixed' AND type_id=(SELECT id FROM exercise_types WHERE code='jump_rope')), 'moderate', 7, 8,10.0),
    ((SELECT id FROM exercise_calc_methods WHERE calc_method='met_fixed' AND type_id=(SELECT id FROM exercise_types WHERE code='jump_rope')), 'high',     9,10,12.0);

 -- =============================
 -- 体重记录表（weight_records）
 -- 说明：用于记录用户体重随时间的变化，字段与饮食/运动记录对齐（record_date / record_time）
 CREATE TABLE weight_records (
     id SERIAL PRIMARY KEY,                                              -- 主键
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,    -- 用户ID
     weight_kg DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0),              -- 体重（kg）
     record_date DATE NOT NULL DEFAULT CURRENT_DATE,                     -- 记录日期（YYYY-MM-DD）
     record_time TIME NOT NULL DEFAULT CURRENT_TIME,                     -- 记录时间（HH:MM:SS）
     notes TEXT,                                                         -- 备注
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 );

 -- 索引：按用户+日期查询；以及按日期查询
 CREATE INDEX idx_weight_records_user_date ON weight_records(user_id, record_date);
 CREATE INDEX idx_weight_records_date ON weight_records(record_date);

 -- 触发器：更新行时自动更新 updated_at
 CREATE TRIGGER trigger_update_weight_records_timestamp
 BEFORE UPDATE ON weight_records
 FOR EACH ROW
 EXECUTE FUNCTION update_timestamp();

 -- 注释
 COMMENT ON TABLE weight_records IS '用户体重记录表';
 COMMENT ON COLUMN weight_records.weight_kg IS '体重（kg）';
 COMMENT ON COLUMN weight_records.record_date IS '记录日期（YYYY-MM-DD）';
 COMMENT ON COLUMN weight_records.record_time IS '记录时间（HH:MM:SS）';

 -- 可选唯一约束：若希望每位用户每天仅一条体重记录，可启用
 -- ALTER TABLE weight_records ADD CONSTRAINT unique_user_date UNIQUE(user_id, record_date);

 */