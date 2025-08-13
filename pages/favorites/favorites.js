const app = getApp();

Page({
  data: {
    favorites: [],
    isLoading: false,
    isLoggedIn: false
  },

  onLoad() {
    this.updateLoginStatus();
  },

  onShow() {
    this.updateLoginStatus();
    if (app.globalData.isLoggedIn) {
      this.loadFavorites();
    }
  },

  // 更新登录状态
  updateLoginStatus() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn });
  },

  // 登录弹窗
  showLoginModal() {
    app.checkLoginAndShowModal().then(() => {
      this.updateLoginStatus();
      this.loadFavorites();
    }).catch(() => {
      // 用户取消登录
    });
  },

  // 加载收藏列表
  loadFavorites() {
    // 仅读本地（与记录页一致：页面渲染一律从本地读取；登录后由全量刷新覆盖本地）
    console.log('=== loadFavorites() 调用 ===');
    console.log('[globalData.favorites]', app.globalData.favorites);
    const storageList = wx.getStorageSync('favorites') || [];
    console.log('[wxStorage favorites]', storageList);
    const local = app.globalData.favorites && app.globalData.favorites.length > 0
      ? app.globalData.favorites
      : (app.loadFavorites() || []);
    console.log('[local (before enrich)]', local);
    const enriched = (local || []).map(it => {
      const calories = (it && it.nutrition && it.nutrition.calories != null)
        ? it.nutrition.calories
        : (it && it.nutrition_total && it.nutrition_total.calories != null
          ? it.nutrition_total.calories
          : null);
      return {
        ...it,
        image_full_url: it && it.image_url ? app.buildImageUrl(it.image_url) : '',
        calorie_display: calories != null ? `${Number(calories).toFixed(0)}千卡` : '-- 千卡'
      };
    });
    console.log('[enriched for render]', enriched);
    this.setData({ favorites: enriched, isLoading: false });
  },

  // 查看菜谱详情
  viewRecipe(e) {
    const recipe = e.currentTarget.dataset.recipe;
    wx.navigateTo({
      url: `/pages/recipe/recipe?from=favorites&recipe=${encodeURIComponent(JSON.stringify(recipe))}`
    });
  },

  // 缩略图加载失败回退
  onThumbError(e) {
    const { index } = e.currentTarget.dataset;
    const list = [...this.data.favorites];
    if (list[index]) {
      list[index].image_full_url = '';
      this.setData({ favorites: list });
    }
  },

  // 删除收藏
  removeFavorite(e) {
    const favoriteId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个收藏的菜谱吗？',
      success: (res) => {
        if (res.confirm) {
          this.deleteFavoriteFromServer(favoriteId);
        }
      }
    });
  },

  // 从服务器删除收藏
  deleteFavoriteFromServer(favoriteId) {
    wx.showLoading({ title: '删除中...' });
    // 通过统一接口：根据 recipeId 删除本地+云端
    const item = this.data.favorites.find(f => f.favoriteId === favoriteId);
    const recipeId = item ? item.id : favoriteId;
    app.removeFavoriteWithSync(recipeId)
      .then(() => {
        wx.hideLoading();
        const favorites = this.data.favorites.filter(it => (it.favoriteId || it.id) !== favoriteId && it.id !== recipeId);
        this.setData({ favorites });
        wx.showToast({ title: '删除成功', icon: 'success' });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '删除失败', icon: 'none' });
      });
  },

  

  // 下拉刷新：登录状态下可手动同步云端覆盖本地
  onPullDownRefresh() {
    if (!app.globalData.isLoggedIn) {
      wx.stopPullDownRefresh();
      return;
    }
    app.getFavorites()
      .then(list => {
        app.saveFavoritesToLocal(list);
        const enriched = (list || []).map(it => {
          const calories = (it && it.nutrition && it.nutrition.calories != null)
            ? it.nutrition.calories
            : (it && it.nutrition_total && it.nutrition_total.calories != null
              ? it.nutrition_total.calories
              : null);
          return {
            ...it,
            image_full_url: it && it.image_url ? app.buildImageUrl(it.image_url) : '',
            calorie_display: calories != null ? `${Number(calories).toFixed(0)}千卡` : '-- 千卡'
          };
        });
        this.setData({ favorites: enriched });
      })
      .finally(() => wx.stopPullDownRefresh());
  },

  // 跳转到首页（未登录时按钮用弹窗，不跳转）
  goToHome() {
    if (!this.data.isLoggedIn) {
      this.showLoginModal();
      return;
    }
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
}) 