const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// --- 数据库表结构说明 ---
/*
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

-- 个人自定义食物表 (user_custom_foods) - 用户自定义的食物营养信息
CREATE TABLE user_custom_foods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name VARCHAR(255) NOT NULL, -- 食物名称
    energy_kcal DECIMAL(8,2) NOT NULL, -- 每100g卡路里
    protein_g DECIMAL(8,2) DEFAULT 0, -- 每100g蛋白质
    fat_g DECIMAL(8,2) DEFAULT 0, -- 每100g脂肪
    carbohydrate_g DECIMAL(8,2) DEFAULT 0, -- 每100g碳水化合物
    fiber_g DECIMAL(8,2) DEFAULT 0, -- 每100g膳食纤维
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, food_name) -- 同一用户不能有重名的自定义食物
);

-- 个人自定义食物表
CREATE TABLE user_custom_foods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name VARCHAR(255) NOT NULL, -- 食物名称
    energy_kcal DECIMAL(8,2) NOT NULL, -- 每100g卡路里
    protein_g DECIMAL(8,2) DEFAULT 0, -- 每100g蛋白质
    fat_g DECIMAL(8,2) DEFAULT 0, -- 每100g脂肪
    carbohydrate_g DECIMAL(8,2) DEFAULT 0, -- 每100g碳水化合物
    fiber_g DECIMAL(8,2) DEFAULT 0, -- 每100g膳食纤维
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- 确保要么是标准食物，要么是自定义食物
    CONSTRAINT check_food_type CHECK (
        (food_id IS NOT NULL AND custom_food_id IS NULL) OR
        (food_id IS NULL AND custom_food_id IS NOT NULL)
    )
);

-- 添加索引以提高查询性能
CREATE INDEX idx_diet_records_user_date ON diet_records(user_id, record_date);
CREATE INDEX idx_diet_records_date ON diet_records(record_date);
CREATE INDEX idx_user_custom_foods_user_id ON user_custom_foods(user_id);

-- 基础代谢率(BMR)通过用户的身高、体重、年龄、性别在本地计算，不需要单独的目标表
*/

// --- 微信小程序配置 ---
// 警告：请勿将AppID和AppSecret硬编码在代码中。
// 建议使用环境变量或配置文件管理这些敏感信息。
const WX_APPID = process.env.WX_APPID;
const WX_SECRET = process.env.WX_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

if (!WX_APPID || !WX_SECRET || !JWT_SECRET) {
  throw new Error('请配置WX_APPID、WX_SECRET和JWT_SECRET环境变量');
}

// 数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://diet_user_admin:createfuture_diet_625@localhost:5432/diet_db',
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取赛程数据接口
app.get('/api/schedule', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // 查询所有轮次和比赛数据
    const query = `
     SELECT 
        r.round_number,
        json_agg(
          json_build_object(
            'home', m.home_team,
            'away', m.away_team,
            'score', m.score,
            'location', m.location
          )
        ) as matches
      FROM rounds r
      LEFT JOIN matches m ON r.id = m.round_id
      GROUP BY r.id, r.round_number
      ORDER BY r.round_number
    `;
    
    const result = await client.query(query);
    client.release();
    
    // 格式化数据以匹配小程序期望的格式
    const rounds = result.rows.map(row => ({
      round: row.round_number,
      matches: row.matches
    }));
    
    res.json(rounds);
  } catch (error) {
    console.error('数据库查询错误:', error);
    res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message 
    });
  }
});

// 获取单轮比赛数据
app.get('/api/schedule/:round', async (req, res) => {
  try {
    const { round } = req.params;
    const client = await pool.connect();
    
    const query = `
      SELECT 
        m.home_team as home,
        m.away_team as away,
        m.score,
        m.location
      FROM matches m
      JOIN rounds r ON m.round_id = r.id
      WHERE r.round_number = $1
      ORDER BY m.id
    `;
    
    const result = await client.query(query, [round]);
    client.release();
    
    res.json(result.rows);
  } catch (error) {
    console.error('数据库查询错误:', error);
    res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message 
    });
  }
});

// --- 微信登录接口 ---
app.post('/api/wx-login', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: '缺少code参数' });
    }

    try {
        // 1. 用 code 换取 openid 和 session_key
        const wechatApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${code}&grant_type=authorization_code`;
        const response = await axios.get(wechatApiUrl);

        const { openid, session_key, errcode, errmsg } = response.data;

        if (!openid || !session_key || errcode) {
            console.error('微信登录失败:', errmsg);
            return res.status(500).json({ error: '微信登录凭证交换失败', message: errmsg });
        }

        // 2. 在数据库中查找或创建用户 (UPSERT)
        const client = await pool.connect();
        const query = `
            INSERT INTO users (openid, session_key, last_login_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (openid)
            DO UPDATE SET
                session_key = EXCLUDED.session_key,
                last_login_at = NOW()
            RETURNING *;
        `;
        const result = await client.query(query, [openid, session_key]);
        const user = result.rows[0];
        client.release();
        console.log(`用户 ${user.openid} 登录/更新成功`);

        // 3. 生成 JWT token
        const token = jwt.sign(
            { userId: user.id, openid: user.openid },
            JWT_SECRET,
            { expiresIn: '7d' } // token有效期7天
        );

        // 4. 返回 token 给小程序
        res.json({
            message: '登录成功',
            token: token,
        });

    } catch (error) {
        console.error('登录流程出错:', error);
        // 检查是否是网络或其他axios错误
        if (error.response) {
          console.error('微信API返回错误:', error.response.data);
        }
        res.status(500).json({ 
            error: '服务器内部错误', 
            message: error.message 
        });
    }
});

// --- 获取当前用户信息接口 ---
app.get('/api/user-info', async (req, res) => {
  try {
    console.log('=== 获取用户信息API调试 ===');
    console.log('Authorization header:', req.headers['authorization']);
    
    // 1. 解析 Authorization 头部
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Token格式错误');
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    const token = authHeader.replace('Bearer ', '');

    // 2. 校验 token
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      console.log('JWT payload:', payload);
    } catch (err) {
      console.log('JWT 校验失败:', err.message);
      return res.status(401).json({ error: 'token 无效或已过期' });
    }

    // 3. 查询数据库
    const client = await pool.connect();
    const query = 'SELECT id, openid, nickname, avatar_url, birthday, height_cm, weight_kg, gender, last_login_at, created_at FROM users WHERE id = $1';
    console.log('SQL查询:', query);
    console.log('查询参数:', [payload.userId]);
    
    const result = await client.query(query, [payload.userId]);
    client.release();

    console.log('数据库查询结果:', result.rows);

    if (result.rows.length === 0) {
      console.log('用户不存在');
      return res.status(404).json({ error: '用户不存在' });
    }

    // 4. 返回用户信息
    console.log('返回用户信息:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('获取用户信息出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// --- 更新用户昵称和头像接口 ---
app.post('/api/update-user-info', async (req, res) => {
  try {
    console.log('=== 更新用户信息API调试 ===');
    console.log('请求体:', req.body);
    console.log('Authorization header:', req.headers['authorization']);
    
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Token格式错误');
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      console.log('JWT payload:', payload);
    } catch (err) {
      console.log('JWT 校验失败:', err.message);
      return res.status(401).json({ error: 'token 无效或已过期' });
    }

    const { nickname, birthday, height_cm, weight_kg, gender } = req.body;
    console.log('解析的字段:', { nickname, birthday, height_cm, weight_kg, gender });
    
    // 构建动态更新查询
    let updateFields = [];
    let values = [];
    let paramIndex = 1;
    
    if (nickname !== undefined) {
      updateFields.push(`nickname = $${paramIndex++}`);
      values.push(nickname);
    }
    if (birthday !== undefined) {
      updateFields.push(`birthday = $${paramIndex++}`);
      values.push(birthday);
    }
    if (height_cm !== undefined) {
      updateFields.push(`height_cm = $${paramIndex++}`);
      values.push(height_cm);
    }
    if (weight_kg !== undefined) {
      updateFields.push(`weight_kg = $${paramIndex++}`);
      values.push(weight_kg);
    }
    if (gender !== undefined) {
      updateFields.push(`gender = $${paramIndex++}`);
      values.push(gender);
    }
    
    console.log('更新字段:', updateFields);
    console.log('参数值:', values);
    
    if (updateFields.length === 0) {
      console.log('没有需要更新的字段');
      return res.status(400).json({ error: '缺少更新参数' });
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(payload.userId);

    const client = await pool.connect();
    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, openid, nickname, avatar_url, birthday, height_cm, weight_kg, gender, last_login_at, created_at;
    `;
    console.log('SQL查询:', query);
    console.log('SQL参数:', values);
    
    const result = await client.query(query, values);
    client.release();

    console.log('数据库更新结果:', result.rows);

    if (result.rows.length === 0) {
      console.log('用户不存在或更新失败');
      return res.status(404).json({ error: '用户不存在' });
    }

    console.log('更新成功，返回数据:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('更新用户信息出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// --- AI访问API ---
/**
 * POST /api/ai
 * body: { prompt: string, model?: string, [其它参数] }
 * 可选model: 'openai'（默认），后续可扩展其它模型
 */
app.post('/api/ai', async (req, res) => {
  const { prompt, model = 'openai', messages, ...otherParams } = req.body;
  if (!prompt && !messages) {
    return res.status(400).json({ error: '缺少prompt或messages参数' });
  }

  try {
    let aiResult;
    if (model === 'openai') {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ error: '未配置OpenAI API Key' });
      }
      const openai = new OpenAI({ apiKey: openaiApiKey });
      let chatMessages = messages;
      if (!Array.isArray(messages)) {
        chatMessages = [
          { role: 'system', content: otherParams.system || '你是一个有帮助的AI助手' },
          { role: 'user', content: prompt }
        ];
      }
      const completionParams = {
        model: otherParams.openai_model || 'gpt-4o',
        messages: chatMessages,
        ...otherParams
      };
      const response = await openai.chat.completions.create(completionParams);
      aiResult = response;
    } else if (model === 'deepseek') {
      // DeepSeek API调用
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
      if (!deepseekApiKey) {
        return res.status(500).json({ error: '未配置DeepSeek API Key' });
      }
      let chatMessages = messages;
      if (!Array.isArray(messages)) {
        chatMessages = [
          { role: 'system', content: otherParams.system || '你是一个有帮助的AI助手' },
          { role: 'user', content: prompt }
        ];
      }
      const completionParams = {
        model: otherParams.deepseek_model || 'deepseek-chat',
        messages: chatMessages,
        ...otherParams
      };
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        completionParams,
        {
          headers: {
            'Authorization': `Bearer ${deepseekApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      aiResult = response.data;
    } else {
      return res.status(400).json({ error: `暂不支持的AI模型: ${model}` });
    }
    res.json({ result: aiResult });
  } catch (error) {
    console.error('AI接口调用出错:', error);
    res.status(500).json({ error: 'AI服务调用失败', message: error.message });
  }
});

// GET /api/user-limits 检查用户限制接口
app.get('/api/user-limits', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const client = await pool.connect();
    const today = new Date().toISOString().split('T')[0];
    
    // 获取或创建今日限制记录（只用于生成次数）
    let query = `
      INSERT INTO user_limits (user_id, date, daily_generation_count)
      VALUES ($1, $2, 0)
      ON CONFLICT (user_id, date) DO NOTHING
      RETURNING *;
    `;
    await client.query(query, [payload.userId, today]);
    
    // 获取生成限制信息和收藏总数
    query = `
      SELECT 
        ul.daily_generation_count,
        ul.daily_generation_limit,
        (SELECT COUNT(*) FROM recipe_favorites WHERE user_id = $1) as total_favorites_count,
        100 as total_favorites_limit
      FROM user_limits ul
      WHERE ul.user_id = $1 AND ul.date = $2
    `;
    
    const result = await client.query(query, [payload.userId, today]);
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '限制信息不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('获取用户限制出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// POST /api/favorites 收藏菜谱接口
app.post('/api/favorites', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { recipe_id, recipe_name, recipe_data } = req.body;
    if (!recipe_id || !recipe_name || !recipe_data) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const client = await pool.connect();
    
    // 检查收藏总数限制
    const favoritesCount = await client.query(
      'SELECT COUNT(*) FROM recipe_favorites WHERE user_id = $1',
      [payload.userId]
    );
    
    const currentCount = parseInt(favoritesCount.rows[0].count);
    const totalLimit = 100; // 总收藏限制
    
    if (currentCount >= totalLimit) {
      client.release();
      return res.status(400).json({ 
        error: `收藏数量已达上限(${totalLimit}个)`,
        currentCount: currentCount,
        totalLimit: totalLimit
      });
    }
    
    // 添加收藏
    const query = `
      INSERT INTO recipe_favorites (user_id, recipe_id, recipe_name, recipe_data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, recipe_id) DO UPDATE SET
        recipe_name = EXCLUDED.recipe_name,
        recipe_data = EXCLUDED.recipe_data,
        updated_at = NOW()
      RETURNING *;
    `;
    
    const result = await client.query(query, [
      payload.userId, recipe_id, recipe_name, recipe_data
    ]);
    
    client.release();
    res.json({ 
      message: '收藏成功', 
      favorite: result.rows[0],
      currentCount: currentCount + 1,
      totalLimit: totalLimit
    });
  } catch (error) {
    console.error('收藏菜谱出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// GET /api/favorites 获取收藏列表接口
app.get('/api/favorites', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const client = await pool.connect();
    const query = `
      SELECT id, recipe_id, recipe_name, recipe_data, created_at
      FROM recipe_favorites
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await client.query(query, [payload.userId]);
    client.release();
    
    res.json(result.rows);
  } catch (error) {
    console.error('获取收藏列表出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// DELETE /api/favorites/:id 删除收藏接口
app.delete('/api/favorites/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { id } = req.params;
    
    const client = await pool.connect();
    
    // 删除收藏
    const deleteQuery = `
      DELETE FROM recipe_favorites
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    
    const deleteResult = await client.query(deleteQuery, [id, payload.userId]);
    
    if (deleteResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: '收藏不存在或无权限删除' });
    }
    
    // 获取删除后的收藏总数
    const countQuery = 'SELECT COUNT(*) FROM recipe_favorites WHERE user_id = $1';
    const countResult = await client.query(countQuery, [payload.userId]);
    const currentCount = parseInt(countResult.rows[0].count);
    
    client.release();
    
    res.json({ 
      message: '删除成功',
      currentCount: currentCount,
      totalLimit: 100
    });
  } catch (error) {
    console.error('删除收藏出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// POST /api/increment-generation 增加生成次数接口
app.post('/api/increment-generation', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const client = await pool.connect();
    const today = new Date().toISOString().split('T')[0];
    
    // 增加今日生成次数
    const query = `
      UPDATE user_limits 
      SET daily_generation_count = daily_generation_count + 1
      WHERE user_id = $1 AND date = $2
      RETURNING daily_generation_count, daily_generation_limit;
    `;
    
    const result = await client.query(query, [payload.userId, today]);
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户限制记录不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('增加生成次数出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// GET /api/food-nutrition 获取食物营养数据接口
app.get('/api/food-nutrition', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // 查询所有食物营养数据
    const query = `
      SELECT 
        id,
        food_name,
        edible_pct,
        energy_kcal,
        moisture_g,
        protein_g,
        fat_g,
        fiber_g,
        carbohydrate_g,
        vitamin_a_ug,
        vitamin_b1_mg,
        vitamin_b2_mg,
        vitamin_b3_mg,
        vitamin_e_mg,
        na_mg,
        ca_mg,
        fe_mg,
        food_group,
        vitamin_c_mg,
        cholesterol_mg
      FROM food_nutrition_cn
      ORDER BY food_name
    `;
    
    const result = await client.query(query);
    client.release();
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取食物营养数据出错:', error);
    res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message 
    });
  }
});

// GET /api/food-nutrition/search 搜索食物营养数据接口
app.get('/api/food-nutrition/search', async (req, res) => {
  try {
    const { keyword, food_group } = req.query;
    
    if (!keyword && !food_group) {
      return res.status(400).json({ error: '请提供搜索关键词或食品分类' });
    }
    
    const client = await pool.connect();
    
    let query = `
      SELECT 
        id,
        food_name,
        edible_pct,
        energy_kcal,
        moisture_g,
        protein_g,
        fat_g,
        fiber_g,
        carbohydrate_g,
        vitamin_a_ug,
        vitamin_b1_mg,
        vitamin_b2_mg,
        vitamin_b3_mg,
        vitamin_e_mg,
        na_mg,
        ca_mg,
        fe_mg,
        food_group,
        vitamin_c_mg,
        cholesterol_mg
      FROM food_nutrition_cn
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (keyword) {
      query += ` AND food_name ILIKE $${paramIndex}`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }
    
    if (food_group) {
      query += ` AND food_group = $${paramIndex}`;
      params.push(food_group);
    }
    
    query += ` ORDER BY food_name LIMIT 50`;
    
    const result = await client.query(query, params);
    client.release();
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      keyword: keyword,
      food_group: food_group
    });
  } catch (error) {
    console.error('搜索食物营养数据出错:', error);
    res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message 
    });
  }
});

// --- 用户资料相关接口 ---



// --- 饮食记录相关接口 ---

// POST /api/diet-records 添加饮食记录接口
app.post('/api/diet-records', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { food_id, custom_food_id, quantity_g, record_date, record_time, notes } = req.body;
    
    if (!quantity_g) {
      return res.status(400).json({ error: '缺少必要参数：摄入量' });
    }
    
    // 验证食物信息：要么有food_id，要么有custom_food_id
    if (!food_id && !custom_food_id) {
      return res.status(400).json({ error: '缺少食物信息：需要food_id或custom_food_id' });
    }
    
    if (food_id && custom_food_id) {
      return res.status(400).json({ error: '不能同时指定标准食物和自定义食物' });
    }
    
    const client = await pool.connect();
    let query, values;
    
    if (food_id) {
      // 标准食物
      query = `
        INSERT INTO diet_records (user_id, food_id, quantity_g, record_date, record_time, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      values = [
        payload.userId, food_id, quantity_g, record_date || new Date().toISOString().split('T')[0], 
        record_time ? record_time.substring(0, 5) : new Date().toTimeString().split(' ')[0].substring(0, 5), notes || null
      ];
    } else {
      // 自定义食物
      query = `
        INSERT INTO diet_records (user_id, custom_food_id, quantity_g, record_date, record_time, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      values = [
        payload.userId, custom_food_id, quantity_g, record_date || new Date().toISOString().split('T')[0], 
        record_time ? record_time.substring(0, 5) : new Date().toTimeString().split(' ')[0].substring(0, 5), notes || null
      ];
    }
    
    const result = await client.query(query, values);
    client.release();
    
    res.json({
      message: '添加成功',
      record: result.rows[0]
    });
  } catch (error) {
    console.error('添加饮食记录出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// GET /api/diet-records 获取饮食记录接口
app.get('/api/diet-records', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { date } = req.query;
    
    const client = await pool.connect();
    let query, values;
    
    if (date) {
      // 如果指定了日期，返回该日期的记录
      query = `
        SELECT 
          dr.id,
          dr.food_id,
          dr.custom_food_id,
          dr.quantity_g,
          dr.record_date,
          dr.record_time,
          dr.notes,
          dr.created_at,
          COALESCE(fn.food_name, ucf.food_name) as display_name,
          COALESCE(fn.energy_kcal, ucf.energy_kcal) as display_energy_kcal,
          COALESCE(fn.protein_g, ucf.protein_g) as display_protein_g,
          COALESCE(fn.fat_g, ucf.fat_g) as display_fat_g,
          COALESCE(fn.carbohydrate_g, ucf.carbohydrate_g) as display_carbohydrate_g,
          CASE 
            WHEN dr.food_id IS NOT NULL THEN 'standard'
            WHEN dr.custom_food_id IS NOT NULL THEN 'custom'
          END as food_type
        FROM diet_records dr
        LEFT JOIN food_nutrition_cn fn ON dr.food_id = fn.id
        LEFT JOIN user_custom_foods ucf ON dr.custom_food_id = ucf.id
        WHERE dr.user_id = $1 AND dr.record_date = $2
        ORDER BY dr.record_time DESC
      `;
      values = [payload.userId, date];
    } else {
      // 如果没有指定日期，返回所有记录
      query = `
        SELECT 
          dr.id,
          dr.food_id,
          dr.custom_food_id,
          dr.quantity_g,
          dr.record_date,
          dr.record_time,
          dr.notes,
          dr.created_at,
          COALESCE(fn.food_name, ucf.food_name) as display_name,
          COALESCE(fn.energy_kcal, ucf.energy_kcal) as display_energy_kcal,
          COALESCE(fn.protein_g, ucf.protein_g) as display_protein_g,
          COALESCE(fn.fat_g, ucf.fat_g) as display_fat_g,
          COALESCE(fn.carbohydrate_g, ucf.carbohydrate_g) as display_carbohydrate_g,
          CASE 
            WHEN dr.food_id IS NOT NULL THEN 'standard'
            WHEN dr.custom_food_id IS NOT NULL THEN 'custom'
          END as food_type
        FROM diet_records dr
        LEFT JOIN food_nutrition_cn fn ON dr.food_id = fn.id
        LEFT JOIN user_custom_foods ucf ON dr.custom_food_id = ucf.id
        WHERE dr.user_id = $1
        ORDER BY dr.record_date DESC, dr.record_time DESC
      `;
      values = [payload.userId];
    }
    
    const result = await client.query(query, values);
    client.release();
    
    res.json({
      success: true,
      data: result.rows,
      date: date || 'all',
      count: result.rows.length
    });
  } catch (error) {
    console.error('获取饮食记录出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// PUT /api/diet-records/:id 更新饮食记录接口
app.put('/api/diet-records/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { id } = req.params;
    const { food_id, custom_food_id, quantity_g, record_date, record_time, notes } = req.body;
    
    if (!quantity_g) {
      return res.status(400).json({ error: '缺少必要参数：摄入量' });
    }
    
    // 验证食物信息：要么有food_id，要么有custom_food_id
    if (!food_id && !custom_food_id) {
      return res.status(400).json({ error: '缺少食物信息：需要food_id或custom_food_id' });
    }
    
    if (food_id && custom_food_id) {
      return res.status(400).json({ error: '不能同时指定标准食物和自定义食物' });
    }
    
    const client = await pool.connect();
    let query, values;
    
    if (food_id) {
      // 标准食物
      query = `
        UPDATE diet_records
        SET food_id = $1, custom_food_id = NULL, quantity_g = $2, record_date = $3, record_time = $4, notes = $5, updated_at = NOW()
        WHERE id = $6 AND user_id = $7
        RETURNING *;
      `;
      values = [food_id, quantity_g, record_date, record_time ? record_time.substring(0, 5) : record_time, notes, id, payload.userId];
    } else {
      // 自定义食物
      query = `
        UPDATE diet_records
        SET food_id = NULL, custom_food_id = $1, quantity_g = $2, record_date = $3, record_time = $4, notes = $5, updated_at = NOW()
        WHERE id = $6 AND user_id = $7
        RETURNING *;
      `;
      values = [custom_food_id, quantity_g, record_date, record_time ? record_time.substring(0, 5) : record_time, notes, id, payload.userId];
    }
    
    const result = await client.query(query, values);
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在或无权限修改' });
    }
    
    res.json({
      message: '更新成功',
      record: result.rows[0]
    });
  } catch (error) {
    console.error('更新饮食记录出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// DELETE /api/diet-records/:id 删除饮食记录接口
app.delete('/api/diet-records/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { id } = req.params;
    
    const client = await pool.connect();
    const query = `
      DELETE FROM diet_records
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    
    const result = await client.query(query, [id, payload.userId]);
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在或无权限删除' });
    }
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除饮食记录出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// GET /api/daily-calorie-summary 获取每日卡路里汇总接口
app.get('/api/daily-calorie-summary', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { date } = req.query;
    const queryDate = date || new Date().toISOString().split('T')[0];
    
    const client = await pool.connect();
    const query = `
      SELECT 
        SUM(dr.quantity_g * COALESCE(fn.energy_kcal, ucf.energy_kcal) / 100) as total_calories,
        SUM(dr.quantity_g * COALESCE(fn.protein_g, ucf.protein_g) / 100) as total_protein,
        SUM(dr.quantity_g * COALESCE(fn.fat_g, ucf.fat_g) / 100) as total_fat,
        SUM(dr.quantity_g * COALESCE(fn.carbohydrate_g, ucf.carbohydrate_g) / 100) as total_carbs,
        COUNT(*) as record_count
      FROM diet_records dr
      LEFT JOIN food_nutrition_cn fn ON dr.food_id = fn.id
      LEFT JOIN user_custom_foods ucf ON dr.custom_food_id = ucf.id
      WHERE dr.user_id = $1 AND dr.record_date = $2
    `;
    
    const result = await client.query(query, [payload.userId, queryDate]);
    client.release();
    
    const summary = result.rows[0];
    res.json({
      success: true,
      date: queryDate,
      total_calories: parseFloat(summary.total_calories || 0).toFixed(2),
      total_protein: parseFloat(summary.total_protein || 0).toFixed(2),
      total_fat: parseFloat(summary.total_fat || 0).toFixed(2),
      total_carbs: parseFloat(summary.total_carbs || 0).toFixed(2),
      record_count: parseInt(summary.record_count || 0)
    });
  } catch (error) {
    console.error('获取每日卡路里汇总出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// --- 个人自定义食物相关接口 ---

// GET /api/user-custom-foods 获取用户自定义食物列表
app.get('/api/user-custom-foods', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const client = await pool.connect();
    const query = `
      SELECT id, food_name, energy_kcal, protein_g, fat_g, carbohydrate_g, fiber_g, created_at, updated_at
      FROM user_custom_foods
      WHERE user_id = $1
      ORDER BY updated_at DESC
    `;
    
    const result = await client.query(query, [payload.userId]);
    client.release();
    
    res.json({
      success: true,
      custom_foods: result.rows
    });
  } catch (error) {
    console.error('获取自定义食物列表出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// POST /api/user-custom-foods 添加自定义食物
app.post('/api/user-custom-foods', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { food_name, energy_kcal, protein_g, fat_g, carbohydrate_g, fiber_g } = req.body;
    
    if (!food_name || !energy_kcal) {
      return res.status(400).json({ error: '缺少必要参数：食物名称和卡路里' });
    }
    
    const client = await pool.connect();
    const query = `
      INSERT INTO user_custom_foods (user_id, food_name, energy_kcal, protein_g, fat_g, carbohydrate_g, fiber_g)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    
    const result = await client.query(query, [
      payload.userId, food_name, energy_kcal, protein_g || 0, fat_g || 0, carbohydrate_g || 0, fiber_g || 0
    ]);
    client.release();
    
    res.json({
      message: '添加成功',
      custom_food: result.rows[0]
    });
  } catch (error) {
    console.error('添加自定义食物出错:', error);
    if (error.code === '23505') { // 唯一约束违反
      res.status(400).json({ error: '该食物名称已存在' });
    } else {
      res.status(500).json({ error: '服务器内部错误', message: error.message });
    }
  }
});

// PUT /api/user-custom-foods/:id 更新自定义食物
app.put('/api/user-custom-foods/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { id } = req.params;
    const { food_name, energy_kcal, protein_g, fat_g, carbohydrate_g, fiber_g } = req.body;
    
    if (!food_name || !energy_kcal) {
      return res.status(400).json({ error: '缺少必要参数：食物名称和卡路里' });
    }
    
    const client = await pool.connect();
    const query = `
      UPDATE user_custom_foods
      SET food_name = $1, energy_kcal = $2, protein_g = $3, fat_g = $4, carbohydrate_g = $5, fiber_g = $6, updated_at = NOW()
      WHERE id = $7 AND user_id = $8
      RETURNING *;
    `;
    
    const result = await client.query(query, [
      food_name, energy_kcal, protein_g || 0, fat_g || 0, carbohydrate_g || 0, fiber_g || 0, id, payload.userId
    ]);
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '自定义食物不存在或无权限修改' });
    }
    
    res.json({
      message: '更新成功',
      custom_food: result.rows[0]
    });
  } catch (error) {
    console.error('更新自定义食物出错:', error);
    if (error.code === '23505') { // 唯一约束违反
      res.status(400).json({ error: '该食物名称已存在' });
    } else {
      res.status(500).json({ error: '服务器内部错误', message: error.message });
    }
  }
});

// DELETE /api/user-custom-foods/:id 删除自定义食物
app.delete('/api/user-custom-foods/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    const { id } = req.params;
    
    const client = await pool.connect();
    const query = `
      DELETE FROM user_custom_foods
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    
    const result = await client.query(query, [id, payload.userId]);
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '自定义食物不存在或无权限删除' });
    }
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除自定义食物出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: err.message 
  });
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  console.log(`API服务器运行在端口 ${port}`);
  console.log(`健康检查: http://localhost:${port}/health`);
  console.log(`赛程接口: http://localhost:${port}/api/schedule`);
}); 