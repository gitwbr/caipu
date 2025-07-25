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
    // 1. 解析 Authorization 头部
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    const token = authHeader.replace('Bearer ', '');

    // 2. 校验 token
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'token 无效或已过期' });
    }

    // 3. 查询数据库
    const client = await pool.connect();
    const query = 'SELECT id, openid, nickname, avatar_url, last_login_at, created_at FROM users WHERE id = $1';
    const result = await client.query(query, [payload.userId]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 4. 返回用户信息
    res.json(result.rows[0]);
  } catch (error) {
    console.error('获取用户信息出错:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  }
});

// --- 更新用户昵称和头像接口 ---
app.post('/api/update-user-info', async (req, res) => {
  try {
    // 关键日志：打印 Authorization 头部
    console.log('Authorization header:', req.headers['authorization']);
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供有效的 token' });
    }
    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      // 关键日志：打印 token payload
      console.log('JWT payload:', payload);
    } catch (err) {
      console.log('JWT 校验失败:', err.message);
      return res.status(401).json({ error: 'token 无效或已过期' });
    }

    const { nickname, avatar_url } = req.body;
    if (!nickname || !avatar_url) {
      return res.status(400).json({ error: '缺少昵称或头像' });
    }

    // 限制 avatar_url 长度，防止 base64 过大导致数据库异常
    if (typeof avatar_url === 'string' && avatar_url.length > 1000000) { // 约1MB
      return res.status(400).json({ error: '头像图片过大，请选择较小的图片' });
    }

    const client = await pool.connect();
    const query = `
      UPDATE users
      SET nickname = $1, avatar_url = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, openid, nickname, avatar_url, last_login_at, created_at;
    `;
    const result = await client.query(query, [nickname, avatar_url, payload.userId]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

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