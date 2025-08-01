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
  },

  onLaunch() {
    // 检查API密钥配置
    //this.checkApiKey();
    
    // 初始化用户数据
    this.initUserData();
    
    // 检查登录状态
    this.checkLoginStatus();
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
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
      
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
          // token有效，更新用户信息
          this.globalData.userInfo = res.data;
          wx.setStorageSync('userInfo', res.data);
        } else {
          // token无效，清除登录状态
          this.logout();
        }
      },
      fail: () => {
        // 网络错误，清除登录状态
        this.logout();
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
                  
                  // 获取用户信息
                  this.getUserInfo().then(() => {
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
            this.globalData.userInfo = res.data;
            wx.setStorageSync('userInfo', res.data);
            resolve(res.data);
          } else {
            reject(new Error(res.data.error || '获取用户信息失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 更新用户信息
  updateUserInfo(nickname) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.serverUrl + '/api/update-user-info',
        method: 'POST',
        header: {
          'Authorization': 'Bearer ' + this.globalData.token,
          'Content-Type': 'application/json'
        },
        data: { nickname },
        success: (res) => {
          if (res.statusCode === 200) {
            this.globalData.userInfo = res.data;
            wx.setStorageSync('userInfo', res.data);
            resolve(res.data);
          } else {
            reject(new Error(res.data.error || '更新用户信息失败'));
          }
        },
        fail: reject
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
  }
}) 