// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    localAvatar: ''
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
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: app.globalData.userInfo
    });
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
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/profile/edit'
    });
  }
}); 