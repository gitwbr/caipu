// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    localAvatar: '',
    bmr: 0,
    calculatedAge: null, // 新增：用于存储计算出的年龄
    formattedBirthday: null // 新增：用于存储格式化后的生日
  },

  onLoad: function () {
    // 读取本地头像
    const localAvatar = wx.getStorageSync('localAvatar') || '';
    this.setData({ localAvatar });
    this.updateLoginStatus();
  },

  onShow: function () {
    // 每次页面显示时都刷新用户信息和本地头像
    const localAvatar = wx.getStorageSync('localAvatar') || '';
    this.setData({ localAvatar });
    this.updateLoginStatus();
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
      const birthDate = new Date(userInfo.birthday);
      formattedBirthday = birthDate.toISOString().split('T')[0]; // 转换为 YYYY-MM-DD 格式
      calculatedAge = this.calculateAge(userInfo.birthday);
    }
    
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: userInfo,
      bmr: userInfo ? userInfo.bmr || 1500 : 1500,
      calculatedAge: calculatedAge,
      formattedBirthday: formattedBirthday
    });
    
    console.log('页面数据已更新:', this.data);
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
}); 