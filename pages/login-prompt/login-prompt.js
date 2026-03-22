const app = getApp();

Page({
  data: {
    kicker: 'ACCOUNT ACCESS',
    title: '需要登录',
    content: '此功能需要登录后才能使用，是否立即登录？',
    confirmText: '立即登录',
    cancelText: '稍后再说',
    showCancel: true,
    loadingTitle: '正在连接微信账号',
    loadingHint: '我们会同步你的个人资料、记录和收藏，慢一点是正常的。',
    progressHint: '',
    isSubmitting: false,
    errorText: '',
    benefitList: [
      '同步收藏与最近菜谱',
      '保存饮食和运动记录',
      '云端保留你的个人资料'
    ]
  },

  onLoad() {
    const config = app.buildLoginPromptConfig(app.globalData.loginPromptConfig || {});
    this.setData({
      ...config,
      progressHint: config.loadingHint || ''
    });
  },

  onUnload() {
    this.clearProgressTimers();

    if (!this._settled) {
      app.rejectPendingLoginPrompt(new Error('用户取消登录'));
    }
  },

  handleBackdropTap() {
    this.handleCancel();
  },

  handleCancel() {
    if (this.data.isSubmitting) {
      return;
    }

    this._settled = true;
    app.rejectPendingLoginPrompt(new Error('用户取消登录'));
    wx.navigateBack({
      delta: 1
    });
  },

  handleConfirm() {
    if (this.data.isSubmitting) {
      return;
    }

    this.setData({
      isSubmitting: true,
      errorText: '',
      progressHint: this.data.loadingHint
    });

    this.startProgressTimers();

    app.wxLogin().then(() => {
      this.clearProgressTimers();
      this._settled = true;
      app.resolvePendingLoginPrompt(true);
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1200
      });
      wx.navigateBack({
        delta: 1
      });
    }).catch((error) => {
      this.clearProgressTimers();
      this.setData({
        isSubmitting: false,
        progressHint: '',
        errorText: error && error.message ? error.message : '登录失败，请稍后重试'
      });
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    });
  },

  startProgressTimers() {
    this.clearProgressTimers();

    this._progressTimers = [
      setTimeout(() => {
        this.setData({
          progressHint: '正在和微信确认身份，第一次会稍慢一点。'
        });
      }, 1200),
      setTimeout(() => {
        this.setData({
          progressHint: '正在同步你的收藏、记录和个人资料，请再稍等一下。'
        });
      }, 2800)
    ];
  },

  clearProgressTimers() {
    if (!Array.isArray(this._progressTimers)) {
      return;
    }

    this._progressTimers.forEach((timer) => clearTimeout(timer));
    this._progressTimers = null;
  }
});
