// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    localAvatar: '',
    bmr: 0,
    calculatedAge: null, // 新增：用于存储计算出的年龄
    formattedBirthday: null, // 新增：用于存储格式化后的生日
    bmi: null
  },

  onLoad: function () {
    // 读取本地头像
    const localAvatar = wx.getStorageSync('localAvatar') || '';
    this.setData({ localAvatar });
    this.updateLoginStatus();
  },

  onShow: function () {
    // 每次页面显示时都刷新用户信息和本地头像，并统一弹出登录框
    const localAvatar = wx.getStorageSync('localAvatar') || '';
    this.setData({ localAvatar });
    if (!app.globalData.isLoggedIn && typeof app.checkLoginAndShowModal === 'function') {
      app.checkLoginAndShowModal()
        .then(() => this.updateLoginStatus())
        .catch(() => this.updateLoginStatus());
    } else {
      this.updateLoginStatus();
    }
  },

  // 更新登录状态
  updateLoginStatus() {
    const userInfo = app.globalData.userInfo;
    
    console.log('=== 个人资料页面数据更新 ===');
    console.log('全局用户信息:', userInfo);
    console.log('登录状态:', app.globalData.isLoggedIn);
    console.log('BMR值:', userInfo ? userInfo.bmr || 1500 : 1500);
    
    // 计算年龄（如果生日存在）
    let calculatedAge = null;
    let formattedBirthday = null;
    if (userInfo && userInfo.birthday) {
      // 格式化生日显示
      formattedBirthday = getApp().toLocalYMD(userInfo.birthday); // 转换为 YYYY-MM-DD 格式
      calculatedAge = this.calculateAge(userInfo.birthday);
    }
    
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: userInfo,
      bmr: userInfo ? userInfo.bmr || 1500 : 1500,
      calculatedAge: calculatedAge,
      formattedBirthday: formattedBirthday,
      bmi: this.calcBMI(userInfo)
    });
    
    console.log('页面数据已更新:', this.data);
  },

  // 计算 BMI = 体重(kg) / 身高(m)^2
  calcBMI(userInfo) {
    if (!userInfo || !userInfo.height_cm || !userInfo.weight_kg) return null;
    const h = Number(userInfo.height_cm) / 100;
    const w = Number(userInfo.weight_kg);
    if (!h || !w) return null;
    return (w / (h * h)).toFixed(1);
  },

  // 从生日计算年龄
  calculateAge(birthday) {
    if (!birthday) return null;
    
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  },

  // 处理登录
  handleLogin: function() {
    wx.showLoading({ title: '正在登录...' });
    app.wxLogin().then(() => {
      wx.hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success' });
      this.updateLoginStatus();
    }).catch((error) => {
      wx.hideLoading();
      wx.showModal({ 
        title: '登录失败', 
        content: error.message || '登录失败，请重试', 
        showCancel: false 
      });
    });
  },

  // 处理登出
  handleLogout: function() {
    wx.showModal({
      title: '确认登出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          this.updateLoginStatus();
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  // 编辑用户信息
  editUserInfo: function() {
    console.log('点击编辑按钮');
    
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    wx.navigateTo({
      url: '/pages/profile/edit'
    });
  }
  ,
  // 顶部卡片点击 → 进入编辑
  goEdit() { this.editUserInfo(); },
  // 收藏
  goFavorites() { wx.navigateTo({ url: '/pages/favorites/favorites' }); },

  // 网络连接测试
  testNetworkConnection() {
    wx.showLoading({ title: '测试连接中...' });
    
    console.log('=== 开始网络连接测试 ===');
    console.log('测试URL:', app.globalData.serverUrl);
    
    // 测试1: 基础连接测试
    wx.request({
      url: app.globalData.serverUrl + '/api/login-config',
      method: 'GET',
      timeout: 10000,
      success: (res) => {
        console.log('连接测试成功:', res);
        wx.hideLoading();
        wx.showModal({
          title: '连接测试成功',
          content: `服务器响应正常\n状态码: ${res.statusCode}\n配置状态: ${JSON.stringify(res.data.config, null, 2)}`,
          showCancel: false
        });
      },
      fail: (error) => {
        console.error('连接测试失败:', error);
        wx.hideLoading();
        wx.showModal({
          title: '连接测试失败',
          content: `错误信息: ${error.errMsg || '未知错误'}\n\n可能原因:\n1. 服务器域名未配置\n2. SSL证书问题\n3. 服务器未启动\n4. 网络连接问题`,
          showCancel: false
        });
      }
    });
  },

  // 测试微信登录流程
  testWxLogin() {
    wx.showLoading({ title: '测试登录流程...' });
    
    console.log('=== 开始测试微信登录流程 ===');
    
    wx.login({
      success: (loginRes) => {
        console.log('微信登录成功:', loginRes);
        wx.hideLoading();
        wx.showModal({
          title: '微信登录测试成功',
          content: `获取到code: ${loginRes.code ? loginRes.code.substring(0, 10) + '...' : 'null'}\n\n下一步需要测试服务器端登录接口`,
          confirmText: '测试服务器登录',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.testServerLogin(loginRes.code);
            }
          }
        });
      },
      fail: (error) => {
        console.error('微信登录失败:', error);
        wx.hideLoading();
        wx.showModal({
          title: '微信登录测试失败',
          content: `错误信息: ${error.errMsg || '未知错误'}`,
          showCancel: false
        });
      }
    });
  },

  // 测试服务器登录接口
  testServerLogin(code) {
    wx.showLoading({ title: '测试服务器登录...' });
    
    console.log('=== 测试服务器登录接口 ===');
    console.log('使用code:', code ? code.substring(0, 10) + '...' : 'null');
    
    wx.request({
      url: app.globalData.serverUrl + '/api/wx-login',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { code: code },
      timeout: 10000,
      success: (res) => {
        console.log('服务器登录响应:', res);
        wx.hideLoading();
        wx.showModal({
          title: '服务器登录测试完成',
          content: `状态码: ${res.statusCode}\n响应: ${JSON.stringify(res.data, null, 2)}`,
          showCancel: false
        });
      },
      fail: (error) => {
        console.error('服务器登录失败:', error);
        wx.hideLoading();
        wx.showModal({
          title: '服务器登录测试失败',
          content: `错误信息: ${error.errMsg || '未知错误'}\n\n这可能是导致正式版登录失败的原因`,
          showCancel: false
        });
      }
    });
  },
  // 帮助与反馈
  goHelp() { wx.showToast({ title: '敬请期待', icon: 'none' }); },
  // 关于我们
  goAbout() { wx.showModal({ title: '关于我们', content: '卡路里记录小助手', showCancel: false }); }
}); 