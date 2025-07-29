// pages/profile/edit.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    nickname: '',
    avatarPreview: '', // 本地预览
  },

  onLoad: function () {
    // 检查登录状态
    if (!app.globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 优先读取本地头像
    const localAvatar = wx.getStorageSync('localAvatar') || '';
    this.setData({ avatarPreview: localAvatar });
    
    // 获取用户信息
    this.getUserInfoFromServer();
  },

  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        const { nickName, avatarUrl } = res.userInfo;
        this.setData({
          nickname: nickName,
          avatarPreview: avatarUrl
        });
        wx.setStorageSync('localAvatar', avatarUrl);
      },
      fail: (err) => {
        wx.showToast({ title: '授权失败', icon: 'none' });
      }
    });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths[0];
        this.setData({ avatarPreview: filePath });
        wx.setStorageSync('localAvatar', filePath);
      }
    });
  },

  saveProfile() {
    if (!this.data.nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    if (!app.globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    
    // 只更新昵称到服务器，头像保存在本地
    app.updateUserInfo(this.data.nickname).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 500);
    }).catch((error) => {
      wx.hideLoading();
      wx.showToast({ 
        title: error.message || '保存失败', 
        icon: 'none' 
      });
    });
  },

  getUserInfoFromServer: function() {
    if (!app.globalData.isLoggedIn) return;
    
    // 使用全局用户信息
    const userInfo = app.globalData.userInfo;
    if (userInfo) {
      this.setData({
        userInfo: userInfo,
        nickname: userInfo.nickname || this.data.nickname,
      });
    }
  },
}); 