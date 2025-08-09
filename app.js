App({
  globalData: {
    // ChatGPT API配置
    //openaiApiKey: '', // 可选，后端已统一管理
    //openaiApiUrl: 'https://api.openai.com/v1/chat/completions', // 可选，后端已统一管理
    serverUrl: 'http://43.154.185.163:3001',
    // 登录状态管理
    isLoggedIn: false,
    userInfo: null,
    token: null,
    // 食物营养数据
    foodNutritionData: [],
    foodNutritionLastUpdate: null,
    // 饮食记录数据
    dietRecords: [],
    dietRecordsLastUpdate: null,
    // 个人自定义食物数据
    customFoods: [],
    customFoodsLastUpdate: null,
    recentFoods: [] // 最近选择的食物
  },
  // --- URL/图片工具 ---
  // 将完整URL转换为仅路径（去掉协议与域名），用于存库
  normalizeImageUrlToPath(url) {
    if (!url) return '';
    try {
      // 已经是路径
      if (url.startsWith('/')) return url;
      // 绝对URL -> 取pathname + search（通常没有search）
      const u = new URL(url);
      return u.pathname + (u.search || '');
    } catch (e) {
      // 非法URL，原样返回
      return url;
    }
  },

  // 读取时拼接成完整URL（若已是绝对URL则原样返回）
  buildImageUrl(pathOrUrl) {
    if (!pathOrUrl) return '';
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const base = this.globalData.serverUrl.replace(/\/$/, '');
    const path = pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl;
    return base + path;
  },


  onLaunch() {
    // 检查API密钥配置
    //this.checkApiKey();
    
    // 初始化用户数据
    this.initUserData();
    
    // 检查登录状态
    this.checkLoginStatus();
    
    // 获取食物营养数据
    this.loadFoodNutritionData();
    
    // 加载本地饮食记录数据
    this.loadDietRecords();
    
    // 加载本地自定义食物数据
    this.loadCustomFoods();
    
    // 加载最近食物数据
    this.loadRecentFoods();
  },

  // 检查API密钥是否已配置
/*   checkApiKey() {
    const apiKey = this.globalData.openaiApiKey;
    if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
      wx.showModal({
        title: '配置提示',
        content: '请在app.js中配置OpenAI API密钥',
        showCancel: false
      });
    }
  }, */

  // 初始化用户数据
  initUserData() {
    // 初始化收藏列表
    if (!wx.getStorageSync('favorites')) {
      wx.setStorageSync('favorites', []);
    }
    
    // 初始化历史记录
    if (!wx.getStorageSync('history')) {
      wx.setStorageSync('history', []);
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.isLoggedIn = true;
      
      // 检查本地存储的用户信息是否包含BMR，如果没有则重新计算
      if (!userInfo.bmr && userInfo.birthday && userInfo.height_cm && userInfo.weight_kg && userInfo.gender) {
        console.log('本地用户信息缺少BMR，重新计算...');
        const bmr = this.calculateBMR(userInfo.birthday, userInfo.height_cm, userInfo.weight_kg, userInfo.gender);
        const userInfoWithBMR = { 
          ...userInfo,
          height: userInfo.height_cm,
          weight: userInfo.weight_kg,
          bmr: bmr 
        };
        this.globalData.userInfo = userInfoWithBMR;
        wx.setStorageSync('userInfo', userInfoWithBMR);
        console.log('本地用户信息BMR已更新:', bmr);
      } else {
        this.globalData.userInfo = userInfo;
      }
      
      // 验证token是否有效
      this.validateToken();
    }
  },

  // 验证token有效性
  validateToken() {
    wx.request({
      url: this.globalData.serverUrl + '/api/user-info',
      method: 'GET',
      header: {
        'Authorization': 'Bearer ' + this.globalData.token,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // token有效，更新用户信息并重新计算BMR
          const userInfo = res.data;
          const bmr = this.calculateBMR(userInfo.birthday, userInfo.height_cm, userInfo.weight_kg, userInfo.gender);
          
          // 转换为本地使用的字段名并添加BMR
          const userInfoWithBMR = { 
            ...userInfo,
            height: userInfo.height_cm, // 转换为本地使用的字段名
            weight: userInfo.weight_kg, // 转换为本地使用的字段名
            bmr: bmr 
          };
          
          this.globalData.userInfo = userInfoWithBMR;
          wx.setStorageSync('userInfo', userInfoWithBMR);
          
          console.log('Token验证成功，用户信息已更新，BMR:', bmr);
        } else {
          // token无效，清除登录状态
          console.log('Token验证失败，状态码:', res.statusCode);
          this.logout();
        }
      },
      fail: (error) => {
        // 网络错误时，保持登录状态，允许离线使用
        console.log('网络错误，保持登录状态以支持离线使用:', error);
        // 不调用logout()，保持用户登录状态
      }
    });
  },

  // 微信登录
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginRes) => {
          if (loginRes.code) {
            // 发送code到服务器换取token
            wx.request({
              url: this.globalData.serverUrl + '/api/wx-login',
              method: 'POST',
              header: { 'Content-Type': 'application/json' },
              data: { code: loginRes.code },
              success: (res) => {
                if (res.statusCode === 200 && res.data.token) {
                  // 登录成功，保存token
                  this.globalData.token = res.data.token;
                  this.globalData.isLoggedIn = true;
                  wx.setStorageSync('token', res.data.token);
                  
                  // 获取用户信息、所有饮食记录与自定义食物，并一次性写入本地
                  Promise.all([
                    this.getUserInfo(),
                    this.getDietRecords(), // 获取所有历史记录
                    this.getCustomFoods()  // 获取自定义食物
                  ]).then(([userInfo, dietRecords, customFoods]) => {
                    console.log('登录成功，获取到用户信息和饮食记录');
                    console.log('用户信息:', userInfo);
                    console.log('饮食记录原始数据:', dietRecords);
                    console.log('饮食记录类型:', typeof dietRecords);
                    console.log('饮食记录是否为数组:', Array.isArray(dietRecords));
                    console.log('饮食记录数量:', dietRecords ? (Array.isArray(dietRecords) ? dietRecords.length : '不是数组') : 'null/undefined');
                    
                    // 保存饮食记录到本地
                    let recordsToSave = [];
                    if (dietRecords && Array.isArray(dietRecords)) {
                      recordsToSave = dietRecords;
                    } else if (dietRecords && dietRecords.data && Array.isArray(dietRecords.data)) {
                      recordsToSave = dietRecords.data;
                    } else if (dietRecords && dietRecords.records && Array.isArray(dietRecords.records)) {
                      recordsToSave = dietRecords.records;
                    } else {
                      console.log('没有获取到饮食记录或格式不正确，使用空数组');
                      recordsToSave = [];
                    }
                    
                    console.log('准备保存的记录数量:', recordsToSave.length);
                    this.saveDietRecordsToLocal(recordsToSave);

                    // 保存自定义食物到本地
                    const customFoodsArray = Array.isArray(customFoods) ? customFoods : (customFoods?.custom_foods || []);
                    console.log('准备保存的自定义食物数量:', customFoodsArray.length);
                    this.saveCustomFoodsToLocal(customFoodsArray);
                    
                    resolve(res.data);
                  }).catch(reject);
                } else {
                  reject(new Error(res.data.error || '登录失败'));
                }
              },
              fail: reject
            });
          } else {
            reject(new Error('获取微信登录code失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 获取用户信息
  getUserInfo() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.serverUrl + '/api/user-info',
        method: 'GET',
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            console.log('=== 获取用户信息调试 ===');
            console.log('服务器返回的原始数据:', res.data);
            
            // 计算BMR并添加到用户信息中
            const userInfo = res.data;
            const bmr = this.calculateBMR(userInfo.birthday, userInfo.height_cm, userInfo.weight_kg, userInfo.gender);
            
            // 转换为本地使用的字段名
            const userInfoWithBMR = { 
              ...userInfo,
              height: userInfo.height_cm, // 转换为本地使用的字段名
              weight: userInfo.weight_kg, // 转换为本地使用的字段名
              bmr: bmr 
            };
            
            console.log('转换后的用户信息:', userInfoWithBMR);
            
            this.globalData.userInfo = userInfoWithBMR;
            wx.setStorageSync('userInfo', userInfoWithBMR);
            
            console.log('用户信息获取成功，BMR:', bmr);
            resolve(userInfoWithBMR);
          } else {
            reject(new Error(res.data.error || '获取用户信息失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 计算基础代谢率 (BMR) - 统一方法
  calculateBMR(birthday, height, weight, gender) {
    if (!birthday || !height || !weight || !gender) {
      return 1500; // 默认值
    }

    // 从生日计算年龄
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Mifflin-St Jeor 公式
    let bmr;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    return Math.round(bmr);
  },

  // 更新用户信息
  updateUserInfo(userData) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      console.log('=== updateUserInfo 调试 ===');
      console.log('接收到的用户数据:', userData);
      console.log('当前Token:', this.globalData.token);
      console.log('服务器URL:', this.globalData.serverUrl);

      // 计算基础代谢率
      const bmr = this.calculateBMR(userData.birthday, userData.height_cm, userData.weight_kg, userData.gender);
      console.log('计算的BMR:', bmr);
      
      // 更新本地用户信息（包含BMR）- 使用正确的字段名
      const updatedUserInfo = { 
        ...this.globalData.userInfo, 
        nickname: userData.nickname,
        height: userData.height_cm, // 转换为本地使用的字段名
        weight: userData.weight_kg, // 转换为本地使用的字段名
        gender: userData.gender,
        birthday: userData.birthday,
        bmr: bmr 
      };
      console.log('更新后的本地用户信息:', updatedUserInfo);
      
      this.globalData.userInfo = updatedUserInfo;
      wx.setStorageSync('userInfo', updatedUserInfo);

      wx.request({
        url: this.globalData.serverUrl + '/api/update-user-info',
        method: 'POST',
        data: userData,
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          console.log('服务器响应状态码:', res.statusCode);
          console.log('服务器响应数据:', res.data);
          if (res.statusCode === 200) {
            console.log('用户信息更新成功，BMR:', bmr);
            resolve(res.data);
          } else {
            console.error('服务器返回错误状态码:', res.statusCode);
            reject(new Error(res.data.error || '更新用户信息失败'));
          }
        },
        fail: (error) => {
          console.error('网络请求失败:', error);
          reject(error);
        }
      });
    });
  },

  // 登出
  logout() {
    this.globalData.isLoggedIn = false;
    this.globalData.userInfo = null;
    this.globalData.token = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
  },

  // 检查登录状态，如果未登录则弹出登录确认
  checkLoginAndShowModal() {
    return new Promise((resolve, reject) => {
      if (this.globalData.isLoggedIn) {
        resolve(true);
        return;
      }

      wx.showModal({
        title: '需要登录',
        content: '此功能需要登录后才能使用，是否立即登录？',
        confirmText: '登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户点击登录
            this.wxLogin().then(() => {
              resolve(true);
            }).catch((error) => {
              wx.showToast({
                title: '登录失败',
                icon: 'none'
              });
              reject(error);
            });
          } else {
            // 用户取消登录
            reject(new Error('用户取消登录'));
          }
        }
      });
    });
  },

  // 检查用户生成限制
  checkUserLimits() {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('用户未登录'));
        return;
      }

      wx.request({
        url: this.globalData.serverUrl + '/api/user-limits',
        method: 'GET',
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            const limits = res.data;
            resolve(limits);
          } else {
            reject(new Error(res.data.error || '获取限制信息失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 增加生成次数
  incrementGenerationCount() {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('用户未登录'));
        return;
      }

      wx.request({
        url: this.globalData.serverUrl + '/api/increment-generation',
        method: 'POST',
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(res.data.error || '更新生成次数失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 获取API密钥
  getApiKey() {
    return this.globalData.openaiApiKey;
  },

  // 设置API密钥（预留方法，用于动态更新）
  setApiKey(apiKey) {
    this.globalData.openaiApiKey = apiKey;
  },

  // 获取食物营养数据
  loadFoodNutritionData() {
    const lastUpdate = wx.getStorageSync('foodNutritionLastUpdate');
    const now = Date.now();

    // 检查缓存是否有效（24小时）
    if (lastUpdate && now - lastUpdate < 24 * 60 * 60 * 1000) {
      const cachedData = wx.getStorageSync('foodNutritionData');
      if (cachedData && cachedData.length > 0) {
        this.globalData.foodNutritionData = cachedData;
        console.log('使用缓存的食物营养数据，共', cachedData.length, '条');
        return;
      }
    }

    console.log('开始获取食物营养数据...');
    wx.request({
      url: this.globalData.serverUrl + '/api/food-nutrition',
      method: 'GET',
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          const foodData = res.data.data;
          this.globalData.foodNutritionData = foodData;
          wx.setStorageSync('foodNutritionData', foodData);
          wx.setStorageSync('foodNutritionLastUpdate', now);
          console.log('食物营养数据获取成功，共', foodData.length, '条');
        } else {
          console.error('获取食物营养数据失败:', res.data.error);
        }
      },
      fail: (error) => {
        console.error('网络错误，获取食物营养数据失败:', error);
      }
    });
  },

  // 搜索食物营养数据
  searchFoodNutrition(keyword, foodGroup = null) {
    return new Promise((resolve, reject) => {
      const params = {};
      if (keyword) params.keyword = keyword;
      if (foodGroup) params.food_group = foodGroup;

      wx.request({
        url: this.globalData.serverUrl + '/api/food-nutrition/search',
        method: 'GET',
        data: params,
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.success) {
            resolve(res.data.data);
          } else {
            reject(new Error(res.data.error || '搜索失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 获取本地缓存的食物营养数据
  getLocalFoodNutritionData() {
    return this.globalData.foodNutritionData || [];
  },

  // 根据食物名称查找营养数据
  findFoodNutritionByName(foodName) {
    const data = this.getLocalFoodNutritionData();
    return data.find(item => item.food_name === foodName);
  },

  // 根据ID查找营养数据
  findFoodNutritionById(id) {
    const data = this.getLocalFoodNutritionData();
    return data.find(item => item.id === id);
  },

  // --- 用户资料相关API ---



  // --- 饮食记录相关API ---

  // 添加饮食记录
  addDietRecord(recordData) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      wx.request({
        url: this.globalData.serverUrl + '/api/diet-records',
        method: 'POST',
        data: recordData,
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            // 后端返回格式: { message: '添加成功', record: {...} }
            // 我们需要返回记录对象本身
            const record = res.data.record || res.data;
            // 兜底补齐本地所需字段
            if (!record.record_date) record.record_date = recordData.record_date;
            if (!record.record_time && recordData.record_time) record.record_time = recordData.record_time;
            if (!record.record_type && recordData.record_type) record.record_type = recordData.record_type;
            if (record.quantity_g === undefined && recordData.quantity_g !== undefined) record.quantity_g = recordData.quantity_g;
            if (record.food_id === undefined && recordData.food_id !== undefined) record.food_id = recordData.food_id;
            if (record.custom_food_id === undefined && recordData.custom_food_id !== undefined) record.custom_food_id = recordData.custom_food_id;
            // 规范日期为 YYYY-MM-DD
            if (typeof record.record_date === 'string' && record.record_date.includes('T')) {
              record.record_date = record.record_date.split('T')[0];
            }
            console.log('添加记录成功，返回数据:', record);
            resolve(record);
          } else {
            reject(new Error(res.data.error || '添加饮食记录失败'));
          }
        },
        fail: (error) => {
          console.log('网络错误，尝试离线保存:', error);
          // 网络错误时，创建本地记录
          const localRecord = {
            ...recordData,
            id: Date.now(), // 使用时间戳作为临时ID
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_offline: true // 标记为离线记录
          };
          
          // 添加到本地记录
          const localRecords = [...this.globalData.dietRecords, localRecord];
          this.saveDietRecordsToLocal(localRecords);
          
          resolve(localRecord);
        }
      });
    });
  },

  // 获取饮食记录
  getDietRecords(date) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      const params = date ? { date: date } : {};
      console.log('=== 获取饮食记录 ===');
      console.log('请求参数:', params);
      console.log('请求URL:', this.globalData.serverUrl + '/api/diet-records');
      console.log('Token:', this.globalData.token);
      
      wx.request({
        url: this.globalData.serverUrl + '/api/diet-records',
        method: 'GET',
        data: params,
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          console.log('API响应状态码:', res.statusCode);
          console.log('API响应数据:', res.data);
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            console.error('API返回错误状态码:', res.statusCode);
            reject(new Error(res.data.error || '获取饮食记录失败'));
          }
        },
        fail: (error) => {
          console.error('API请求失败:', error);
          reject(error);
        }
      });
    });
  },

  // 更新饮食记录
  updateDietRecord(recordId, recordData) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      wx.request({
        url: this.globalData.serverUrl + '/api/diet-records/' + recordId,
        method: 'PUT',
        data: recordData,
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            // 后端返回格式: { message: '更新成功', record: {...} }
            // 我们需要返回记录对象本身
            const record = res.data.record || res.data;
            // 兜底补齐
            if (!record.record_date) record.record_date = recordData.record_date;
            if (!record.record_time && recordData.record_time) record.record_time = recordData.record_time;
            if (!record.record_type && recordData.record_type) record.record_type = recordData.record_type;
            if (record.quantity_g === undefined && recordData.quantity_g !== undefined) record.quantity_g = recordData.quantity_g;
            if (record.food_id === undefined && recordData.food_id !== undefined) record.food_id = recordData.food_id;
            if (record.custom_food_id === undefined && recordData.custom_food_id !== undefined) record.custom_food_id = recordData.custom_food_id;
            if (typeof record.record_date === 'string' && record.record_date.includes('T')) {
              record.record_date = record.record_date.split('T')[0];
            }
            console.log('更新记录成功，返回数据:', record);
            resolve(record);
          } else {
            reject(new Error(res.data.error || '更新饮食记录失败'));
          }
        },
        fail: (error) => {
          console.log('网络错误，尝试离线更新:', error);
          // 网络错误时，更新本地记录
          const localRecords = this.globalData.dietRecords.map(record => 
            record.id == recordId ? {
              ...record,
              ...recordData,
              updated_at: new Date().toISOString(),
              is_offline: true
            } : record
          );
          
          this.saveDietRecordsToLocal(localRecords);
          
          const updatedRecord = localRecords.find(r => r.id == recordId);
          resolve(updatedRecord);
        }
      });
    });
  },

  // 删除饮食记录
  deleteDietRecord(recordId) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      wx.request({
        url: this.globalData.serverUrl + '/api/diet-records/' + recordId,
        method: 'DELETE',
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(res.data.error || '删除饮食记录失败'));
          }
        },
        fail: (error) => {
          console.log('网络错误，尝试离线删除:', error);
          // 网络错误时，从本地记录中删除
          const localRecords = this.globalData.dietRecords.filter(record => record.id != recordId);
          this.saveDietRecordsToLocal(localRecords);
          
          resolve({ success: true });
        }
      });
    });
  },

  // 获取每日卡路里汇总（本地计算）
  getDailyCalorieSummary(date) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      // 使用本地计算方法
      const summary = this.calculateDailyCalorieSummary(date);
      resolve(summary);
    });
  },

  // 加载本地饮食记录数据
  loadDietRecords() {
    console.log('=== 加载本地饮食记录数据 ===');
    
    const records = wx.getStorageSync('dietRecords') || [];
    const lastUpdate = wx.getStorageSync('dietRecordsLastUpdate');
    
    console.log('从 wx.getStorageSync("dietRecords") 加载的记录:', records);
    console.log('记录数量:', records.length);
    console.log('最后更新时间:', lastUpdate);
    
    // 检查数据格式，如果不是数组则重置
    let validRecords = records;
    if (!Array.isArray(records)) {
      console.error('本地存储的dietRecords不是数组，重置为空数组:', records);
      validRecords = [];
      // 立即保存修复后的数据
      wx.setStorageSync('dietRecords', validRecords);
    }
    
    // 清理无效记录（没有record_date的记录）
    validRecords = validRecords.filter(record => {
      if (!record.record_date) {
        console.log('发现无效记录，缺少record_date:', record);
        return false;
      }
      return true;
    });
    
    if (validRecords.length !== records.length) {
      console.log(`清理了 ${records.length - validRecords.length} 条无效记录`);
      // 保存清理后的数据
      this.saveDietRecordsToLocal(validRecords);
    }
    
    this.globalData.dietRecords = validRecords;
    this.globalData.dietRecordsLastUpdate = lastUpdate;
    
    console.log('已加载到 globalData.dietRecords:', this.globalData.dietRecords);
    
    return validRecords;
  },

  // 保存饮食记录到本地
  saveDietRecordsToLocal(records) {
    console.log('=== 保存饮食记录到本地 ===');
    console.log('记录数量:', records.length);
    console.log('记录内容:', records);
    
    this.globalData.dietRecords = records;
    this.globalData.dietRecordsLastUpdate = new Date().toISOString();
    
    wx.setStorageSync('dietRecords', records);
    wx.setStorageSync('dietRecordsLastUpdate', this.globalData.dietRecordsLastUpdate);
    
    console.log('已保存到 globalData.dietRecords');
    console.log('已保存到 wx.setStorageSync("dietRecords")');
    console.log('当前 globalData.dietRecords:', this.globalData.dietRecords);
  },

  // 本地计算每日卡路里汇总
  calculateDailyCalorieSummary(date) {
    let targetDate = date || new Date().toISOString().split('T')[0];
    
    // 确保日期格式为 YYYY-MM-DD
    if (targetDate && targetDate.includes('T')) {
      // 如果是ISO时间戳格式，提取日期部分
      targetDate = targetDate.split('T')[0];
    }
    
    // 检查数据格式，确保是数组
    let records = this.globalData.dietRecords || [];
    if (!Array.isArray(records)) {
      console.error('globalData.dietRecords不是数组，重置为空数组:', records);
      records = [];
    }
    
    // 修复日期格式匹配问题
    const filteredRecords = records.filter(record => {
      // 检查record_date是否存在
      if (!record.record_date) {
        console.log(`计算汇总时发现记录${record.id}的record_date为undefined或null，跳过`);
        return false;
      }
      
      let recordDate;
      if (typeof record.record_date === 'string') {
        if (record.record_date.includes('T')) {
          // ISO格式: "2025-08-01T00:00:00.000Z"
          recordDate = record.record_date.split('T')[0];
        } else {
          // 简单格式: "2025-08-01"
          recordDate = record.record_date;
        }
      } else if (record.record_date instanceof Date) {
        // Date对象
        recordDate = record.record_date.toISOString().split('T')[0];
      } else {
        console.log(`计算汇总时发现记录${record.id}的record_date格式未知:`, record.record_date);
        recordDate = '';
      }
      
      return recordDate === targetDate;
    });
    
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    
    filteredRecords.forEach(record => {
      let energyKcal, proteinG, fatG, carbG;
      
      if (record.record_type === 'quick') {
        // 快速记录，直接使用记录中的营养数据
        energyKcal = parseFloat(record.quick_energy_kcal) || 0;
        proteinG = parseFloat(record.quick_protein_g) || 0;
        fatG = parseFloat(record.quick_fat_g) || 0;
        carbG = parseFloat(record.quick_carbohydrate_g) || 0;
        
        // 快速记录直接累加，不需要计算比例
        totalCalories += energyKcal;
        totalProtein += proteinG;
        totalFat += fatG;
        totalCarbs += carbG;
      } else if (record.food_id) {
        // 标准食物，从食物营养表获取数据
        const food = this.findFoodNutritionById(record.food_id);
        if (food) {
          energyKcal = food.energy_kcal;
          proteinG = food.protein_g;
          fatG = food.fat_g;
          carbG = food.carbohydrate_g;
        }
        
        if (energyKcal && record.quantity_g) {
          const ratio = record.quantity_g / 100;
          totalCalories += energyKcal * ratio;
          totalProtein += (proteinG || 0) * ratio;
          totalFat += (fatG || 0) * ratio;
          totalCarbs += (carbG || 0) * ratio;
        }
      } else if (record.custom_food_id) {
        // 自定义食物，从自定义食物表获取数据
        const customFood = this.findCustomFoodById(record.custom_food_id);
        if (customFood) {
          energyKcal = customFood.energy_kcal;
          proteinG = customFood.protein_g;
          fatG = customFood.fat_g;
          carbG = customFood.carbohydrate_g;
        }
        
        if (energyKcal && record.quantity_g) {
          const ratio = record.quantity_g / 100;
          totalCalories += energyKcal * ratio;
          totalProtein += (proteinG || 0) * ratio;
          totalFat += (fatG || 0) * ratio;
          totalCarbs += (carbG || 0) * ratio;
        }
      }
    });
    
    return {
      success: true,
      date: targetDate,
      total_calories: parseFloat(totalCalories).toFixed(2),
      total_protein: parseFloat(totalProtein).toFixed(2),
      total_fat: parseFloat(totalFat).toFixed(2),
      total_carbs: parseFloat(totalCarbs).toFixed(2),
      record_count: filteredRecords.length
    };
  },

  // 同步饮食记录（本地和云端）
  syncDietRecords() {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      // 获取云端数据
      this.getDietRecords().then(cloudResponse => {
        console.log('云端返回的完整响应:', cloudResponse);
        
        // 提取记录数组
        let recordsArray;
        if (cloudResponse && Array.isArray(cloudResponse)) {
          // 直接是数组
          recordsArray = cloudResponse;
        } else if (cloudResponse && cloudResponse.data && Array.isArray(cloudResponse.data)) {
          // 包含在data字段中
          recordsArray = cloudResponse.data;
        } else if (cloudResponse && cloudResponse.records && Array.isArray(cloudResponse.records)) {
          // 包含在records字段中
          recordsArray = cloudResponse.records;
        } else {
          console.error('云端返回的数据格式不正确:', cloudResponse);
          recordsArray = [];
        }
        
        console.log('提取的记录数组:', recordsArray);
        
        // 同步离线记录到云端
        this.syncOfflineRecords(recordsArray).then(() => {
          // 更新本地数据
          this.saveDietRecordsToLocal(recordsArray);
          resolve(recordsArray);
        }).catch(reject);
      }).catch(error => {
        console.log('获取云端数据失败，使用本地数据:', error);
        // 网络错误时，使用本地数据
        resolve(this.globalData.dietRecords || []);
      });
    });
  },

  // 同步离线记录到云端
  syncOfflineRecords(cloudRecords) {
    return new Promise((resolve, reject) => {
      const offlineRecords = this.globalData.dietRecords.filter(record => record.is_offline);
      
      if (offlineRecords.length === 0) {
        resolve();
        return;
      }

      console.log('发现离线记录，开始同步:', offlineRecords.length, '条');
      
      // 逐个同步离线记录
      const syncPromises = offlineRecords.map(record => {
        const recordData = {
          quantity_g: record.quantity_g,
          record_time: record.record_time,
          record_date: record.record_date,
          notes: record.notes,
          food_id: record.food_id,
          custom_food_id: record.custom_food_id
        };

        return this.addDietRecord(recordData).then(cloudRecord => {
          console.log('离线记录同步成功:', record.id, '->', cloudRecord.id);
          return { oldId: record.id, newRecord: cloudRecord };
        });
      });

      Promise.all(syncPromises).then(results => {
        console.log('所有离线记录同步完成');
        resolve();
      }).catch(error => {
        console.error('同步离线记录失败:', error);
        // 即使同步失败，也不阻止应用继续运行
        resolve();
      });
    });
  },

  // 添加饮食记录（同时更新本地和云端）
  addDietRecordWithSync(recordData) {
    return new Promise((resolve, reject) => {
      console.log('=== 添加饮食记录（同步） ===');
      console.log('记录数据:', recordData);
      console.log('当前本地记录数量:', this.globalData.dietRecords.length);
      
      this.addDietRecord(recordData).then(cloudRecord => {
        console.log('云端保存成功:', cloudRecord);
        
        // 添加到本地记录
        const localRecords = [...this.globalData.dietRecords, cloudRecord];
        console.log('更新后的本地记录数量:', localRecords.length);
        console.log('本地记录内容:', localRecords);
        
        this.saveDietRecordsToLocal(localRecords);
        resolve(cloudRecord);
      }).catch(reject);
    });
  },

  // 更新饮食记录（同时更新本地和云端）
  updateDietRecordWithSync(recordId, recordData) {
    return new Promise((resolve, reject) => {
      this.updateDietRecord(recordId, recordData).then(updatedRecord => {
        console.log('=== 更新饮食记录同步调试 ===');
        console.log('记录ID:', recordId, '类型:', typeof recordId);
        console.log('更新后的记录:', updatedRecord);
        console.log('本地记录数量:', this.globalData.dietRecords.length);
        
        // 更新本地记录，确保类型匹配
        const localRecords = this.globalData.dietRecords.map(record => {
          const recordIdStr = String(record.id);
          const targetIdStr = String(recordId);
          const isMatch = recordIdStr === targetIdStr;
          
          if (isMatch) {
            console.log('找到匹配记录:', record.id, '-> 更新为:', updatedRecord);
          }
          
          return isMatch ? updatedRecord : record;
        });
        
        console.log('更新后的本地记录数量:', localRecords.length);
        this.saveDietRecordsToLocal(localRecords);
        resolve(updatedRecord);
      }).catch(reject);
    });
  },

  // 删除饮食记录（同时更新本地和云端）
  deleteDietRecordWithSync(recordId) {
    return new Promise((resolve, reject) => {
      this.deleteDietRecord(recordId).then(() => {
        console.log('=== 删除饮食记录同步调试 ===');
        console.log('记录ID:', recordId, '类型:', typeof recordId);
        console.log('删除前本地记录数量:', this.globalData.dietRecords.length);
        
        // 从本地记录中删除，确保类型匹配
        const localRecords = this.globalData.dietRecords.filter(record => {
          const recordIdStr = String(record.id);
          const targetIdStr = String(recordId);
          const isMatch = recordIdStr === targetIdStr;
          
          if (isMatch) {
            console.log('找到要删除的记录:', record.id);
          }
          
          return !isMatch; // 保留不匹配的记录
        });
        
        console.log('删除后本地记录数量:', localRecords.length);
        this.saveDietRecordsToLocal(localRecords);
        resolve();
      }).catch(reject);
    });
  },

  // --- 个人自定义食物相关方法 ---

  // 加载本地自定义食物数据
  loadCustomFoods() {
    try {
      const customFoods = wx.getStorageSync('customFoods') || [];
      const lastUpdate = wx.getStorageSync('customFoodsLastUpdate');
      
      this.globalData.customFoods = customFoods;
      this.globalData.customFoodsLastUpdate = lastUpdate;
    } catch (error) {
      console.error('加载自定义食物数据失败:', error);
    }
  },

  // 保存自定义食物数据到本地
  saveCustomFoodsToLocal(customFoods) {
    try {
      // 统一将图片URL规范为仅路径后再存库
      const normalized = (customFoods || []).map(food => {
        const f = { ...food };
        if (f.image_url) {
          f.image_url = this.normalizeImageUrlToPath(f.image_url);
        }
        return f;
      });
      wx.setStorageSync('customFoods', normalized);
      wx.setStorageSync('customFoodsLastUpdate', new Date().toISOString());
      this.globalData.customFoods = normalized;
      this.globalData.customFoodsLastUpdate = new Date().toISOString();
    } catch (error) {
      console.error('保存自定义食物数据失败:', error);
    }
  },

  // 获取自定义食物列表
  getCustomFoods() {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      wx.request({
        url: this.globalData.serverUrl + '/api/user-custom-foods',
        method: 'GET',
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data.custom_foods);
          } else {
            reject(new Error(res.data.error || '获取自定义食物列表失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 添加自定义食物
  addCustomFood(foodData) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      wx.request({
        url: this.globalData.serverUrl + '/api/user-custom-foods',
        method: 'POST',
        data: foodData,
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data.custom_food);
          } else {
            reject(new Error(res.data.error || '添加自定义食物失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 更新自定义食物
  updateCustomFood(foodId, foodData) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      wx.request({
        url: this.globalData.serverUrl + '/api/user-custom-foods/' + foodId,
        method: 'PUT',
        data: foodData,
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data.custom_food);
          } else {
            reject(new Error(res.data.error || '更新自定义食物失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 删除自定义食物
  deleteCustomFood(foodId) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      wx.request({
        url: this.globalData.serverUrl + '/api/user-custom-foods/' + foodId,
        method: 'DELETE',
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            // 优先使用服务器返回的详细错误信息
            const errorMessage = res.data.message || res.data.error || '删除自定义食物失败';
            reject(new Error(errorMessage));
          }
        },
        fail: reject
      });
    });
  },

  // 同步自定义食物（本地和云端）
  syncCustomFoods() {
    return new Promise((resolve, reject) => {
      if (!this.globalData.isLoggedIn) {
        reject(new Error('请先登录'));
        return;
      }

      // 获取云端数据
      this.getCustomFoods().then(cloudFoods => {
        // 更新本地数据
        this.saveCustomFoodsToLocal(cloudFoods);
        resolve(cloudFoods);
      }).catch(reject);
    });
  },

  // 添加自定义食物（同时更新本地和云端）
  addCustomFoodWithSync(foodData) {
    return new Promise((resolve, reject) => {
      this.addCustomFood(foodData).then(cloudFood => {
        // 添加到本地记录
        const localFoods = [...this.globalData.customFoods, cloudFood];
        this.saveCustomFoodsToLocal(localFoods);
        resolve(cloudFood);
      }).catch(reject);
    });
  },

  // 更新自定义食物（同时更新本地和云端）
  updateCustomFoodWithSync(foodId, foodData) {
    return new Promise((resolve, reject) => {
      this.updateCustomFood(foodId, foodData).then(updatedFood => {
        // 更新本地记录
        const localFoods = this.globalData.customFoods.map(food => 
          food.id === foodId ? updatedFood : food
        );
        this.saveCustomFoodsToLocal(localFoods);
        resolve(updatedFood);
      }).catch(reject);
    });
  },

  // 删除自定义食物（同时更新本地和云端）
  deleteCustomFoodWithSync(foodId) {
    return new Promise((resolve, reject) => {
      this.deleteCustomFood(foodId).then(() => {
        // 从本地记录中删除
        const localFoods = this.globalData.customFoods.filter(food => food.id !== foodId);
        this.saveCustomFoodsToLocal(localFoods);
        resolve();
      }).catch(reject);
    });
  },

  // 根据ID查找自定义食物
  findCustomFoodById(id) {
    return this.globalData.customFoods.find(food => food.id === id);
  },

  // 根据名称查找自定义食物
  findCustomFoodByName(name) {
    return this.globalData.customFoods.find(food => 
      food.food_name.toLowerCase().includes(name.toLowerCase())
    );
  },

  // 搜索自定义食物
  searchCustomFoods(keyword) {
    if (!keyword) return this.globalData.customFoods;
    
    return this.globalData.customFoods.filter(food => 
      food.food_name.toLowerCase().includes(keyword.toLowerCase())
    );
  },

  // 添加到最近食物（仅保存引用：type + id + ts）
  addToRecentFoods(food) {
    // 兼容旧调用：传入完整对象时提取引用
    const refType = food.type;
    const refId = food.id;
    if (!refType || !refId) return;
    const recentRefs = this.globalData.recentFoods || [];
    // 去重
    const filtered = recentRefs.filter(item => !(String(item.id) === String(refId) && item.type === refType));
    // 压入引用
    filtered.unshift({ type: refType, id: refId, ts: Date.now() });
    // 限制数量
    if (filtered.length > 20) filtered.splice(20);
    this.globalData.recentFoods = filtered;
    wx.setStorageSync('recentFoods', filtered);
  },

  // 加载最近食物数据
  loadRecentFoods() {
    const recentRefs = wx.getStorageSync('recentFoods') || [];
    // 历史迁移：若存的是完整对象，转换为引用
    const migrated = recentRefs.map(item => {
      if (item && item.type && item.id) return { type: item.type, id: item.id, ts: item.ts || Date.now() };
      // 兜底：尝试从标准/自定义字段推断
      if (item && item.food_id) return { type: 'standard', id: item.food_id, ts: Date.now() };
      if (item && item.custom_food_id) return { type: 'custom', id: item.custom_food_id, ts: Date.now() };
      return null;
    }).filter(Boolean);
    this.globalData.recentFoods = migrated;
    wx.setStorageSync('recentFoods', migrated);
  }
}) 