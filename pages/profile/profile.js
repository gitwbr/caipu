// pages/profile/profile.js
Page({
  data: {
    userInfo: null,
    token: '',
    localAvatar: ''
  },

  onLoad: function () {
    // 读取本地头像
    const localAvatar = wx.getStorageSync('localAvatar') || '';
    let token = wx.getStorageSync('token');
    if (typeof token !== 'string') token = token ? String(token) : '';
    this.setData({ localAvatar, token });
    console.log('onLoad token:', this.data.token);
    if (this.data.token) {
      this.getUserInfoFromServer();
    }
  },

  onShow: function () {
    // 每次页面显示时都刷新用户信息和本地头像
    const localAvatar = wx.getStorageSync('localAvatar') || '';
    let token = wx.getStorageSync('token');
    if (typeof token !== 'string') token = token ? String(token) : '';
    this.setData({ localAvatar, token });
    console.log('onShow token:', this.data.token);
    if (this.data.token) {
      this.getUserInfoFromServer();
    }
  },

  handleLogin: function() {
    wx.showLoading({ title: '正在登录...' });
    wx.login({
      success: (res) => {
        if (res.code) {
          wx.request({
            url: `${getApp().globalData.serverUrl}/api/wx-login`,
            method: 'POST',
            data: { code: res.code },
            success: (loginRes) => {
              wx.hideLoading();
              if (loginRes.statusCode === 200 && loginRes.data.token) {
                wx.setStorageSync('token', loginRes.data.token);
                this.setData({ token: loginRes.data.token }, () => {
                  console.log('登录后 token:', this.data.token);
                  wx.showToast({ title: '登录成功', icon: 'success' });
                  this.getUserInfoFromServer();
                });
              } else {
                wx.showModal({ title: '登录失败', content: loginRes.data.error || '服务器返回错误', showCancel: false });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showModal({ title: '请求失败', content: '无法连接到服务器，请检查网络或服务器地址是否正确。', showCancel: false });
              console.error("请求后端失败", err);
            }
          });
        } else {
          wx.hideLoading();
          console.error('获取用户登录态失败！' + res.errMsg);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("wx.login 失败", err);
      }
    });
  },

  getUserInfoFromServer: function() {
    if (!this.data.token) return;
    wx.request({
      url: `${getApp().globalData.serverUrl}/api/user-info`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${this.data.token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          this.setData({ userInfo: res.data });
        } else {
          this.setData({ userInfo: null });
        }
      },
      fail: (err) => {
        this.setData({ userInfo: null });
      }
    });
  },
}); 