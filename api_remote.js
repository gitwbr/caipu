const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

const fs = require('fs');
const path = require('path');

// 配置图片上传目录
const UPLOAD_DIR = process.env.UPLOAD_DIR;
const UPLOAD_URL_PREFIX = process.env.UPLOAD_URL_PREFIX;

// 静态文件服务 - 提供上传图片的访问
app.use('/uploads', express.static(UPLOAD_DIR));

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 从请求中获取用户ID
    const userId = req.body.userId || req.query.userId;
    
    if (!userId) {
      return cb(new Error('用户ID不能为空'));
    }
    
    // 按用户ID创建子目录
    const userDir = path.join(UPLOAD_DIR, String(userId));
    
    // 确保目录存在
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名：时间戳_随机数_原文件名
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}_${random}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制10MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

// 专门用于OCR的内存存储配置（不保存文件到磁盘）
const ocrUpload = multer({
  storage: multer.memoryStorage(), // 使用内存存储，不保存文件
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制10MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

// 百度OCR配置
const BAIDU_OCR_CONFIG = {
  API_KEY: process.env.BAIDU_OCR_API_KEY,
  SECRET_KEY: process.env.BAIDU_OCR_SECRET_KEY,
  BASE_URL: 'https://aip.baidubce.com',
  OCR_URL: 'https://aip.baidubce.com/rest/2.0/ocr/v1'
};

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
        cholesterol_mg,
        image_url
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
        cholesterol_mg,
        image_url
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

// --- 图片上传接口 ---

// 工具：将绝对URL或以/uploads开头的路径统一转换为“仅路径”（/uploads/...）
function normalizeToPathOnly(urlOrPath) {
  if (!urlOrPath) return null;
  try {
    if (/^https?:\/\//i.test(urlOrPath)) {
      const u = new URL(urlOrPath);
      return u.pathname; // /uploads/.../file
    }
  } catch (_) {}
  return urlOrPath; // 已是路径
}

// POST /api/upload-image 图片上传接口
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    
    if (!req.file) {
      return res.status(400).json({ error: '没有上传图片文件' });
    }
    
    // 构建图片URL（仅路径）
    const relativePath = path.relative(UPLOAD_DIR, req.file.path);
    const imagePathOnly = `/uploads/${relativePath.replace(/\\/g, '/')}`;
    
    console.log('图片上传成功:', {
      originalName: req.file.originalname,
      savedPath: req.file.path,
      imageUrl: imagePathOnly
    });
    
    res.json({ success: true, imageUrl: imagePathOnly });
  } catch (error) {
    console.error('图片上传失败:', error);
    res.status(500).json({ error: '图片上传失败', message: error.message });
  }
});

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
    
    const { 
      food_id, 
      custom_food_id, 
      quantity_g, 
      record_date, 
      record_time, 
      notes,
      // 快速记录相关字段
      record_type = 'standard',
      quick_food_name,
      quick_energy_kcal,
      quick_protein_g,
      quick_fat_g,
      quick_carbohydrate_g,
      quick_image_url
    } = req.body;
    
    const client = await pool.connect();
    let query, values;
    
    if (record_type === 'quick') {
      // 快速记录
      if (!quick_food_name || !quick_energy_kcal) {
        return res.status(400).json({ error: '快速记录缺少必要参数：食物名称和热量' });
      }
      
      query = `
        INSERT INTO diet_records (
          user_id, record_type, quick_food_name, quick_energy_kcal, 
          quick_protein_g, quick_fat_g, quick_carbohydrate_g, quick_image_url,
          quantity_g, record_date, record_time, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `;
      values = [
        payload.userId, 'quick', quick_food_name, quick_energy_kcal,
        quick_protein_g || 0, quick_fat_g || 0, quick_carbohydrate_g || 0, quick_image_url || null,
        quantity_g || 0, // 快速记录不需要重量，设为0
        record_date || new Date().toISOString().split('T')[0], 
        record_time ? record_time.substring(0, 5) : new Date().toTimeString().split(' ')[0].substring(0, 5), 
        notes || null
      ];
    } else {
      // 标准食物或自定义食物（原有功能）
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
      
      if (food_id) {
        // 标准食物
        query = `
          INSERT INTO diet_records (user_id, record_type, food_id, quantity_g, record_date, record_time, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
        `;
        values = [
          payload.userId, 'standard', food_id, quantity_g, 
          record_date || new Date().toISOString().split('T')[0], 
          record_time ? record_time.substring(0, 5) : new Date().toTimeString().split(' ')[0].substring(0, 5), 
          notes || null
        ];
      } else {
        // 自定义食物
        query = `
          INSERT INTO diet_records (user_id, record_type, custom_food_id, quantity_g, record_date, record_time, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
        `;
        values = [
          payload.userId, 'custom', custom_food_id, quantity_g, 
          record_date || new Date().toISOString().split('T')[0], 
          record_time ? record_time.substring(0, 5) : new Date().toTimeString().split(' ')[0].substring(0, 5), 
          notes || null
        ];
      }
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
          dr.record_type,
          dr.food_id,
          dr.custom_food_id,
          dr.quantity_g,
          dr.record_date,
          dr.record_time,
          dr.notes,
          dr.created_at,
          dr.quick_food_name,
          dr.quick_energy_kcal,
          dr.quick_protein_g,
          dr.quick_fat_g,
          dr.quick_carbohydrate_g,
          dr.quick_image_url,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_food_name
            ELSE COALESCE(fn.food_name, ucf.food_name)
          END as display_name,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_energy_kcal
            ELSE COALESCE(fn.energy_kcal, ucf.energy_kcal)
          END as display_energy_kcal,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_protein_g
            ELSE COALESCE(fn.protein_g, ucf.protein_g)
          END as display_protein_g,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_fat_g
            ELSE COALESCE(fn.fat_g, ucf.fat_g)
          END as display_fat_g,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_carbohydrate_g
            ELSE COALESCE(fn.carbohydrate_g, ucf.carbohydrate_g)
          END as display_carbohydrate_g,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_image_url
            ELSE COALESCE(fn.image_url, ucf.image_url)
          END as display_image_url
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
          dr.record_type,
          dr.food_id,
          dr.custom_food_id,
          dr.quantity_g,
          dr.record_date,
          dr.record_time,
          dr.notes,
          dr.created_at,
          dr.quick_food_name,
          dr.quick_energy_kcal,
          dr.quick_protein_g,
          dr.quick_fat_g,
          dr.quick_carbohydrate_g,
          dr.quick_image_url,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_food_name
            ELSE COALESCE(fn.food_name, ucf.food_name)
          END as display_name,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_energy_kcal
            ELSE COALESCE(fn.energy_kcal, ucf.energy_kcal)
          END as display_energy_kcal,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_protein_g
            ELSE COALESCE(fn.protein_g, ucf.protein_g)
          END as display_protein_g,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_fat_g
            ELSE COALESCE(fn.fat_g, ucf.fat_g)
          END as display_fat_g,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_carbohydrate_g
            ELSE COALESCE(fn.carbohydrate_g, ucf.carbohydrate_g)
          END as display_carbohydrate_g,
          CASE 
            WHEN dr.record_type = 'quick' THEN dr.quick_image_url
            ELSE COALESCE(fn.image_url, ucf.image_url)
          END as display_image_url
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
    const { 
      food_id, 
      custom_food_id, 
      quantity_g, 
      record_date, 
      record_time, 
      notes,
      record_type,
      quick_food_name,
      quick_energy_kcal,
      quick_protein_g,
      quick_fat_g,
      quick_carbohydrate_g,
      quick_image_url
    } = req.body;
    
    const client = await pool.connect();
    let query, values;
    
    if (record_type === 'quick') {
      // 快速记录更新
      query = `
        UPDATE diet_records
        SET 
          quick_food_name = $1,
          quick_energy_kcal = $2,
          quick_protein_g = $3,
          quick_fat_g = $4,
          quick_carbohydrate_g = $5,
          quick_image_url = $6,
          record_date = $7,
          record_time = $8,
          notes = $9,
          updated_at = NOW()
        WHERE id = $10 AND user_id = $11
        RETURNING *;
      `;
      values = [
        quick_food_name || '快速记录',
        quick_energy_kcal,
        quick_protein_g,
        quick_fat_g,
        quick_carbohydrate_g,
        quick_image_url,
        record_date,
        record_time ? record_time.substring(0, 5) : record_time,
        notes,
        id,
        payload.userId
      ];
    } else {
      // 标准食物或自定义食物更新
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
    
    // 先查询记录信息，包括图片URL
    const selectQuery = `
      SELECT id, record_type, quick_image_url
      FROM diet_records
      WHERE id = $1 AND user_id = $2
    `;
    
    const selectResult = await client.query(selectQuery, [id, payload.userId]);
    
    if (selectResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: '记录不存在或无权限删除' });
    }
    
    const record = selectResult.rows[0];
    console.log('=== 删除饮食记录调试 ===');
    console.log('记录信息:', record);
    console.log('记录类型:', record.record_type);
    console.log('图片URL:', record.quick_image_url);
    
    let imagePath = null;
    
    // 如果是快速记录且有图片，提取图片路径
    if (record.record_type === 'quick' && record.quick_image_url) {
      console.log('检测到快速记录且有图片URL');
      try {
        // quick_image_url 可能是完整URL或路径，统一转为文件系统路径
        const pathname = normalizeToPathOnly(record.quick_image_url); // /uploads/...
        if (pathname && pathname.startsWith('/uploads/')) {
          const relative = pathname.replace('/uploads/', '');
          imagePath = path.join(UPLOAD_DIR, relative);
          console.log('解析出的图片路径:', imagePath);
        }
      } catch (error) {
        console.error('解析图片路径失败:', error);
      }
    } else {
      console.log('不是快速记录或没有图片URL');
    }
    
    // 删除数据库记录
    const deleteQuery = `
      DELETE FROM diet_records
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    
    const deleteResult = await client.query(deleteQuery, [id, payload.userId]);
    client.release();
    
    // 删除对应的图片文件（如果存在）
    console.log('准备删除图片文件，imagePath:', imagePath);
    if (imagePath) {
      try {
        if (fs.existsSync(imagePath)) {
          console.log('图片文件存在，开始删除');
          fs.unlinkSync(imagePath);
          console.log('删除图片文件成功:', imagePath);
        } else {
          console.log('图片文件不存在，跳过删除:', imagePath);
        }
      } catch (error) {
        console.error('删除图片文件失败:', error);
        // 图片删除失败不影响记录删除的成功
      }
    } else {
      console.log('没有图片路径，跳过图片删除');
    }
    
    res.json({ 
      message: '删除成功',
      imageDeleted: !!imagePath
    });
  } catch (error) {
    console.error('删除饮食记录出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// GET /api/daily-calorie-summary 获取每日卡路里汇总接口
//------------------弃用
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
      SELECT id, food_name, energy_kcal, protein_g, fat_g, carbohydrate_g, fiber_g,
             moisture_g, vitamin_a_ug, vitamin_b1_mg, vitamin_b2_mg, vitamin_b3_mg, vitamin_e_mg,
             na_mg, ca_mg, fe_mg, vitamin_c_mg, cholesterol_mg, image_url, created_at, updated_at
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
    
    const { 
      food_name, 
      energy_kcal, 
      protein_g, 
      fat_g, 
      carbohydrate_g, 
      fiber_g,
      moisture_g,
      vitamin_a_ug,
      vitamin_b1_mg,
      vitamin_b2_mg,
      vitamin_b3_mg,
      vitamin_e_mg,
      na_mg,
      ca_mg,
      fe_mg,
      vitamin_c_mg,
      cholesterol_mg,
      image_url
    } = req.body;
    
    if (!food_name || !energy_kcal) {
      return res.status(400).json({ error: '缺少必要参数：食物名称和卡路里' });
    }
    
    const client = await pool.connect();
    const query = `
      INSERT INTO user_custom_foods (
        user_id, food_name, energy_kcal, protein_g, fat_g, carbohydrate_g, fiber_g,
        moisture_g, vitamin_a_ug, vitamin_b1_mg, vitamin_b2_mg, vitamin_b3_mg, vitamin_e_mg,
        na_mg, ca_mg, fe_mg, vitamin_c_mg, cholesterol_mg, image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *;
    `;
    
    const result = await client.query(query, [
      payload.userId, 
      food_name, 
      energy_kcal, 
      protein_g || 0, 
      fat_g || 0, 
      carbohydrate_g || 0, 
      fiber_g || 0,
      moisture_g || 0,
      vitamin_a_ug || 0,
      vitamin_b1_mg || 0,
      vitamin_b2_mg || 0,
      vitamin_b3_mg || 0,
      vitamin_e_mg || 0,
      na_mg || 0,
      ca_mg || 0,
      fe_mg || 0,
      vitamin_c_mg || 0,
      cholesterol_mg || 0,
      normalizeToPathOnly(image_url) || null
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
    const { 
      food_name, 
      energy_kcal, 
      protein_g, 
      fat_g, 
      carbohydrate_g, 
      fiber_g,
      moisture_g,
      vitamin_a_ug,
      vitamin_b1_mg,
      vitamin_b2_mg,
      vitamin_b3_mg,
      vitamin_e_mg,
      na_mg,
      ca_mg,
      fe_mg,
      vitamin_c_mg,
      cholesterol_mg,
      image_url
    } = req.body;
    
    if (!food_name || !energy_kcal) {
      return res.status(400).json({ error: '缺少必要参数：食物名称和卡路里' });
    }
    
    const client = await pool.connect();

    // 先取旧图片路径以便更新后删除
    const selectQuery = `SELECT image_url FROM user_custom_foods WHERE id = $1 AND user_id = $2`;
    const selectRes = await client.query(selectQuery, [id, payload.userId]);
    if (selectRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: '自定义食物不存在或无权限修改' });
    }
    const oldImagePathname = normalizeToPathOnly(selectRes.rows[0].image_url);

    // 准备新图片路径（若请求体包含 image_url 字段）
    const imageProvided = Object.prototype.hasOwnProperty.call(req.body, 'image_url');
    const newImagePathname = imageProvided ? (normalizeToPathOnly(image_url) || null) : oldImagePathname;

    const query = `
      UPDATE user_custom_foods
      SET food_name = $1, energy_kcal = $2, protein_g = $3, fat_g = $4, carbohydrate_g = $5, fiber_g = $6,
          moisture_g = $7, vitamin_a_ug = $8, vitamin_b1_mg = $9, vitamin_b2_mg = $10, vitamin_b3_mg = $11, vitamin_e_mg = $12,
          na_mg = $13, ca_mg = $14, fe_mg = $15, vitamin_c_mg = $16, cholesterol_mg = $17, image_url = $18, updated_at = NOW()
      WHERE id = $19 AND user_id = $20
      RETURNING *;
    `;

    const result = await client.query(query, [
      food_name, energy_kcal, protein_g || 0, fat_g || 0, carbohydrate_g || 0, fiber_g || 0,
      moisture_g || 0, vitamin_a_ug || 0, vitamin_b1_mg || 0, vitamin_b2_mg || 0, vitamin_b3_mg || 0, vitamin_e_mg || 0,
      na_mg || 0, ca_mg || 0, fe_mg || 0, vitamin_c_mg || 0, cholesterol_mg || 0, newImagePathname, id, payload.userId
    ]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '自定义食物不存在或无权限修改' });
    }

    // 若请求包含 image_url 且新旧不同，或显式清空图片，则删除旧文件
    try {
      if (imageProvided) {
        const changed = oldImagePathname !== newImagePathname;
        if (oldImagePathname && changed && oldImagePathname.startsWith('/uploads/')) {
          const relative = oldImagePathname.replace('/uploads/', '');
          const filePath = path.join(UPLOAD_DIR, relative);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('更新自定义食物：已删除旧图片文件', filePath);
          } else {
            console.log('更新自定义食物：旧图片文件不存在，跳过删除', filePath);
          }
        }
      }
    } catch (delErr) {
      console.error('更新自定义食物：删除旧图片失败（不影响更新结果）:', delErr.message);
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
    
    // 先查询要删除的食物信息，包括图片URL
    const selectQuery = `
      SELECT image_url FROM user_custom_foods
      WHERE id = $1 AND user_id = $2
    `;
    
    const selectResult = await client.query(selectQuery, [id, payload.userId]);
    
    if (selectResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: '自定义食物不存在或无权限删除' });
    }
    
    const food = selectResult.rows[0];
    
    // 删除数据库记录
    const deleteQuery = `
      DELETE FROM user_custom_foods
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    
    const result = await client.query(deleteQuery, [id, payload.userId]);
    client.release();
    
    // 如果有图片URL，删除对应的图片文件
    console.log('=== 删除自定义食物调试 ===');
    console.log('食物信息:', food);
    console.log('图片URL:', food.image_url);
    
    if (food.image_url) {
      console.log('检测到图片URL，准备删除图片文件');
      try {
        // 兼容完整URL或仅路径
        const pathname = normalizeToPathOnly(food.image_url); // 例如 /uploads/31/xxx.png
        let filePath = null;
        if (pathname && pathname.startsWith('/uploads/')) {
          const relative = pathname.replace('/uploads/', ''); // 31/xxx.png
          filePath = path.join(UPLOAD_DIR, relative);
        }
        console.log('解析出的图片路径:', filePath);
        
        // 检查文件是否存在并删除
        if (filePath && fs.existsSync(filePath)) {
          console.log('图片文件存在，开始删除');
          fs.unlinkSync(filePath);
          console.log('删除图片文件成功:', filePath);
        } else {
          console.log('图片文件不存在，跳过删除:', filePath);
        }
      } catch (fileError) {
        console.error('删除图片文件失败:', fileError);
        // 图片删除失败不影响数据库删除的成功
      }
    } else {
      console.log('没有图片URL，跳过图片删除');
    }
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除自定义食物出错:', error);
    
    // 检查是否是外键约束错误（食物被饮食记录引用）
    if (error.code === '23503' && error.constraint && error.constraint.includes('custom_food_id')) {
      res.status(400).json({ 
        error: '无法删除该自定义食物',
        message: '该食物已在饮食记录中使用，请先删除相关的饮食记录后再删除此食物'
      });
    } else {
      res.status(500).json({ error: '服务器内部错误', message: error.message });
    }
  }
});

// --- 百度OCR文字识别相关接口 ---

// 百度OCR访问令牌管理
let baiduAccessToken = null;
let tokenExpireTime = 0;

async function getBaiduAccessToken() {
  // 检查令牌是否还有效
  if (baiduAccessToken && Date.now() < tokenExpireTime) {
    return baiduAccessToken;
  }
  
  try {
    const url = `${BAIDU_OCR_CONFIG.BASE_URL}/oauth/2.0/token`;
    const params = {
      grant_type: 'client_credentials',
      client_id: BAIDU_OCR_CONFIG.API_KEY,
      client_secret: BAIDU_OCR_CONFIG.SECRET_KEY
    };
    
    const response = await axios.post(url, null, { params });
    
    if (response.data.access_token) {
      baiduAccessToken = response.data.access_token;
      tokenExpireTime = Date.now() + (response.data.expires_in * 1000) - 60000; // 提前1分钟过期
      console.log('百度OCR访问令牌获取成功');
      return baiduAccessToken;
    } else {
      throw new Error('获取访问令牌失败');
    }
  } catch (error) {
    console.error('获取百度OCR访问令牌失败:', error.message);
    throw error;
  }
}

// POST /api/baidu-ocr/upload 百度OCR图片识别
app.post('/api/baidu-ocr/upload', ocrUpload.single('image'), async (req, res) => {
  try {
    console.log('=== 百度OCR图片识别API调试 ===');
    
    // 验证用户身份
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'token 无效或已过期' });
    }
    
    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片文件' });
    }
    
    console.log('接收到图片文件:', req.file.originalname, '大小:', req.file.size);
    
    // 检查百度OCR配置
    if (!BAIDU_OCR_CONFIG.API_KEY || !BAIDU_OCR_CONFIG.SECRET_KEY) {
      return res.status(500).json({ error: '百度OCR配置未完成，请检查环境变量' });
    }
    
    // 获取访问令牌
    const accessToken = await getBaiduAccessToken();
    
    // 将图片转为base64（不保存文件）
    const imageBase64 = req.file.buffer.toString('base64');
    
    // 调用百度OCR API（高精度版）
    const ocrUrl = `${BAIDU_OCR_CONFIG.OCR_URL}/accurate_basic`;
    const ocrParams = {
      access_token: accessToken
    };
    
    const ocrData = {
      image: imageBase64,
      language_type: 'CHN_ENG',      // 中英文混合
      detect_direction: 'true',       // 检测图像朝向
      detect_language: 'true',        // 检测语言
      vertexes_location: 'true',      // 返回文字外接多边形顶点位置
      probability: 'true'             // 返回识别结果中每一行的置信度
    };
    
    console.log('调用百度OCR API...');
    const ocrResponse = await axios.post(ocrUrl, ocrData, {
      params: ocrParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000 // 30秒超时
    });
    
    console.log('百度OCR API返回结果');
    
    // 检查API响应
    if (ocrResponse.data.error_code) {
      console.error('百度OCR API错误:', ocrResponse.data);
      return res.status(500).json({
        error: '百度OCR识别失败',
        message: ocrResponse.data.error_msg || '未知错误'
      });
    }
    
    // 处理识别结果
    const wordsResult = ocrResponse.data.words_result || [];
    const texts = wordsResult.map(item => item.words);
    const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
    
    // 计算平均置信度
    const confidences = wordsResult.map(item => item.probability?.average || 0);
    const avgConfidence = confidences.length > 0 ? 
      confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0;
    
    const result = {
      success: true,
      engine: 'BaiduOCR',
      method: 'accurate_basic',
      texts: texts,
      words_result: wordsResult,
      statistics: {
        total_lines: wordsResult.length,
        total_chars: totalChars,
        avg_confidence: avgConfidence,
        direction: ocrResponse.data.direction || 0
      },
      user_id: payload.userId,
      filename: req.file.originalname,
      file_size: req.file.size
    };
    
    console.log('识别完成:', {
      total_lines: result.statistics.total_lines,
      total_chars: result.statistics.total_chars,
      avg_confidence: result.statistics.avg_confidence.toFixed(3)
    });
    
    // 注意：这里不保存图片文件，直接返回识别结果
    res.json(result);
    
  } catch (error) {
    console.error('百度OCR识别失败:', error);
    res.status(500).json({
      error: 'OCR识别失败',
      message: error.message
    });
  }
});

// GET /api/baidu-ocr/health 百度OCR健康检查
app.get('/api/baidu-ocr/health', async (req, res) => {
  try {
    // 检查配置
    const configStatus = {
      api_key: !!BAIDU_OCR_CONFIG.API_KEY,
      secret_key: !!BAIDU_OCR_CONFIG.SECRET_KEY
    };
    
    if (!configStatus.api_key || !configStatus.secret_key) {
      return res.status(503).json({
        success: false,
        error: '百度OCR配置不完整',
        config_status: configStatus,
        message: '请检查BAIDU_OCR_API_KEY和BAIDU_OCR_SECRET_KEY环境变量'
      });
    }
    
    // 尝试获取访问令牌
    try {
      const accessToken = await getBaiduAccessToken();
      res.json({
        success: true,
        service: 'BaiduOCR',
        status: 'healthy',
        config_status: configStatus,
        access_token: accessToken ? 'valid' : 'invalid',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        error: '百度OCR服务不可用',
        config_status: configStatus,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('百度OCR健康检查失败:', error);
    res.status(500).json({
      success: false,
      error: '健康检查失败',
      message: error.message
    });
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
  console.log(`百度OCR接口: http://localhost:${port}/api/baidu-ocr/upload`);
  console.log(`图片上传接口: http://localhost:${port}/api/upload-image`);
}); 