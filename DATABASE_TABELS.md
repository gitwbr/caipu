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
    record_type VARCHAR(20) DEFAULT 'standard' CHECK (record_type IN ('standard', 'custom', 'quick')), -- 记录类型
    quick_food_name VARCHAR(255), -- 快速记录食物名称
    quick_energy_kcal DECIMAL(8,2), -- 快速记录热量（千卡）
    quick_protein_g DECIMAL(8,2) DEFAULT 0, -- 快速记录蛋白质（克）
    quick_fat_g DECIMAL(8,2) DEFAULT 0, -- 快速记录脂肪（克）
    quick_carbohydrate_g DECIMAL(8,2) DEFAULT 0, -- 快速记录碳水化合物（克）
    quick_image_url TEXT, -- 快速记录图片URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- 确保要么是标准食物，要么是自定义食物，要么是快速记录
    CONSTRAINT check_food_type CHECK (
        (record_type = 'standard' AND food_id IS NOT NULL AND custom_food_id IS NULL AND quick_food_name IS NULL) OR
        (record_type = 'custom' AND food_id IS NULL AND custom_food_id IS NOT NULL AND quick_food_name IS NULL) OR
        (record_type = 'quick' AND food_id IS NULL AND custom_food_id IS NULL AND quick_food_name IS NOT NULL)
    )
);

-- 添加索引以提高查询性能
CREATE INDEX idx_diet_records_user_date ON diet_records(user_id, record_date);
CREATE INDEX idx_diet_records_date ON diet_records(record_date);
CREATE INDEX idx_user_custom_foods_user_id ON user_custom_foods(user_id);

-- 基础代谢率(BMR)通过用户的身高、体重、年龄、性别在本地计算，不需要单独的目标表
*/