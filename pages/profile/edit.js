// pages/profile/edit.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    nickname: '',
    avatarPreview: '', // 本地预览
    height: '',
    weight: '',
    gender: '',
    birthday: ''
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

  onHeightInput(e) {
    this.setData({ height: e.detail.value });
  },

  onWeightInput(e) {
    this.setData({ weight: e.detail.value });
  },

  onGenderChange(e) {
    const genderMap = ['male', 'female'];
    this.setData({ gender: genderMap[e.detail.value] });
  },

  onBirthdayChange(e) {
    this.setData({ birthday: e.detail.value });
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
    
    // 更新用户信息到服务器
    const updateData = {
      nickname: this.data.nickname,
      height_cm: parseFloat(this.data.height) || null,
      weight_kg: parseFloat(this.data.weight) || null,
      gender: this.data.gender || null,
      birthday: this.data.birthday || null
    };
    
    console.log('=== 保存个人资料调试 ===');
    console.log('当前页面数据:', this.data);
    console.log('准备发送的更新数据:', updateData);
    console.log('登录状态:', app.globalData.isLoggedIn);
    console.log('Token:', app.globalData.token);
    
    app.updateUserInfo(updateData)
      .then((result) => {
        console.log('保存成功，服务器返回:', result);
        // 强制刷新一次用户信息，确保BMR/BMI/体重重算
        return app.getUserInfo();
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存成功', icon: 'success' });
        // 延迟返回，确保Toast显示完成
        setTimeout(() => {
          // 尝试多种返回方式
          wx.navigateBack({
            fail: () => {
              // 如果navigateBack失败，尝试switchTab到个人资料页面
              wx.switchTab({
                url: '/pages/profile/profile',
                fail: () => {
                  // 最后的备选方案，使用redirectTo
                  wx.redirectTo({
                    url: '/pages/profile/profile'
                  });
                }
              });
            }
          });
        }, 1500);
      })
      .catch((error) => {
      console.error('保存失败:', error);
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
      console.log('=== 编辑页面加载用户信息 ===');
      console.log('原始用户信息:', userInfo);
      
      // 格式化生日显示
      let formattedBirthday = null;
      if (userInfo.birthday) {
        formattedBirthday = getApp().toLocalYMD(userInfo.birthday);
      }
      
      this.setData({
        userInfo: userInfo,
        nickname: userInfo.nickname || this.data.nickname,
        height: userInfo.height_cm ? userInfo.height_cm.toString() : '',
        weight: userInfo.weight_kg ? userInfo.weight_kg.toString() : '',
        gender: userInfo.gender || '',
        birthday: formattedBirthday || ''
      });
      
      console.log('设置到页面的数据:', {
        nickname: userInfo.nickname || this.data.nickname,
        height: userInfo.height_cm ? userInfo.height_cm.toString() : '',
        weight: userInfo.weight_kg ? userInfo.weight_kg.toString() : '',
        gender: userInfo.gender || '',
        birthday: formattedBirthday || ''
      });
    }
  },
}); 