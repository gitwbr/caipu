// pages/profile/edit.js
Page({
  data: {
    serverUrl: 'http://43.154.185.163:3001', // 替换为你的服务器IP
    userInfo: null,
    token: null,
    nickname: '',
    avatarPreview: '', // 本地预览
  },

  onLoad: function () {
    // 始终用最新 token
    const token = wx.getStorageSync('token') || null;
    this.setData({ token });
    // 优先读取本地头像
    const localAvatar = wx.getStorageSync('localAvatar') || '';
    this.setData({ avatarPreview: localAvatar });
    if (token) {
      this.getUserInfoFromServer();
    }
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
    // 始终用最新 token
    const token = wx.getStorageSync('token') || this.data.token;
    if (!this.data.nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.request({
      url: `${this.data.serverUrl}/api/update-user-info`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        nickname: this.data.nickname,
        avatar_url: this.data.userInfo && this.data.userInfo.avatar_url ? this.data.userInfo.avatar_url : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          wx.showToast({ title: '保存成功', icon: 'success' });
          this.getUserInfoFromServer();
          setTimeout(() => {
            wx.navigateBack();
          }, 500);
        }
      }
    });
  },

  getUserInfoFromServer: function() {
    const token = wx.getStorageSync('token') || this.data.token;
    if (!token) return;
    wx.request({
      url: `${this.data.serverUrl}/api/user-info`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 只更新昵称和数据库头像，不覆盖本地头像
          this.setData({
            userInfo: res.data,
            nickname: res.data.nickname || this.data.nickname,
          });
        } else {
          this.setData({ userInfo: null, nickname: '', avatarPreview: '' });
        }
      },
      fail: (err) => {
        this.setData({ userInfo: null, nickname: '', avatarPreview: '' });
      }
    });
  },
}); 