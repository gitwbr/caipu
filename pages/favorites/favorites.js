const app = getApp();

function getRecipeId(recipeOrId) {
  if (!recipeOrId) return '';
  if (typeof recipeOrId === 'object') {
    return recipeOrId.id || recipeOrId.recipe_id || recipeOrId.recipeId || '';
  }
  return recipeOrId;
}

function getCalories(recipe) {
  if (!recipe || typeof recipe !== 'object') {
    return null;
  }

  if (recipe.nutrition && recipe.nutrition.calories != null) {
    return recipe.nutrition.calories;
  }

  if (recipe.nutrition_total && recipe.nutrition_total.calories != null) {
    return recipe.nutrition_total.calories;
  }

  return null;
}

function buildRecipeCard(recipe, options = {}) {
  const recipeId = getRecipeId(recipe);
  const favoriteRecipe = recipeId && app.findFavoriteByRecipeId
    ? app.findFavoriteByRecipeId(recipeId)
    : null;
  const merged = favoriteRecipe
    ? { ...recipe, ...favoriteRecipe }
    : { ...recipe };
  const imagePath = merged.image_url || recipe.image_url || '';
  const calories = getCalories(merged);

  return {
    ...merged,
    id: recipeId || recipe.id || Date.now().toString(),
    favoriteId: merged.favoriteId || recipe.favoriteId || '',
    image_full_url: imagePath ? app.buildImageUrl(imagePath) : '',
    calorie_display: calories != null ? `${Number(calories).toFixed(0)}千卡` : '-- 千卡',
    isFavorited: !!favoriteRecipe,
    originLabel: options.originLabel || '',
    actionLabel: options.actionLabel || ''
  };
}

Page({
  data: {
    activeRecipeTab: 'recent',
    recentRecipes: [],
    favorites: [],
    isLoading: false,
    isLoggedIn: false
  },

  onLoad() {
    this.refreshPageData();
  },

  onShow() {
    app.syncTabBar(this);
    this.refreshPageData();
  },

  refreshPageData() {
    this.updateLoginStatus();
    this.loadRecentRecipes();

    if (app.globalData.isLoggedIn) {
      this.loadFavorites();
      return;
    }

    this.setData({
      favorites: [],
      isLoading: false
    });
  },

  updateLoginStatus() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn });
  },

  onRecipeTabChange(e) {
    const { tab } = e.currentTarget.dataset;
    if (!tab || tab === this.data.activeRecipeTab) {
      return;
    }

    this.setData({ activeRecipeTab: tab });
  },

  loadRecentRecipes() {
    const history = wx.getStorageSync('history') || [];
    const recentRecipes = history.map((recipe) => buildRecipeCard(recipe, {
      originLabel: '最近生成',
      actionLabel: '删'
    }));

    this.setData({ recentRecipes });
  },

  loadFavorites() {
    const local = app.globalData.favorites && app.globalData.favorites.length > 0
      ? app.globalData.favorites
      : (app.loadFavorites() || []);
    const favorites = (local || []).map((recipe) => buildRecipeCard(recipe, {
      originLabel: '已收藏',
      actionLabel: '取消'
    }));

    this.setData({
      favorites,
      isLoading: false
    });
  },

  syncFavoritesFromServer() {
    if (!app.globalData.isLoggedIn) {
      return Promise.resolve();
    }

    this.setData({ isLoading: true });

    return app.getFavorites()
      .then((list) => {
        app.saveFavoritesToLocal(list);
        const favorites = (list || []).map((recipe) => buildRecipeCard(recipe, {
          originLabel: '已收藏',
          actionLabel: '取消'
        }));
        this.setData({ favorites });
      })
      .finally(() => {
        this.setData({ isLoading: false });
      });
  },

  showLoginModal() {
    app.checkLoginAndShowModal().then(() => {
      this.updateLoginStatus();
      this.syncFavoritesFromServer();
    }).catch(() => {
      // 用户取消登录
    });
  },

  viewRecipe(e) {
    const recipe = e.currentTarget.dataset.recipe;
    const scope = e.currentTarget.dataset.scope;
    const from = scope === 'favorites' ? 'favorites' : 'library';
    wx.navigateTo({
      url: `/pages/recipe/recipe?from=${from}&recipe=${encodeURIComponent(JSON.stringify(recipe))}`
    });
  },

  onThumbError(e) {
    const { index, scope } = e.currentTarget.dataset;
    const key = scope === 'favorites' ? 'favorites' : 'recentRecipes';
    const list = [...this.data[key]];

    if (list[index]) {
      list[index].image_full_url = '';
      this.setData({ [key]: list });
    }
  },

  deleteRecent(e) {
    const recipeId = e.currentTarget.dataset.id;
    const index = Number(e.currentTarget.dataset.index);
    const history = wx.getStorageSync('history') || [];
    const nextHistory = recipeId
      ? history.filter((recipe) => String(getRecipeId(recipe)) !== String(recipeId))
      : history.filter((_, itemIndex) => itemIndex !== index);

    wx.setStorageSync('history', nextHistory);
    this.loadRecentRecipes();
    wx.showToast({ title: '已删除', icon: 'success' });
  },

  removeFavorite(e) {
    const favoriteId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认取消收藏',
      content: '确定要把这道菜谱移出收藏吗？',
      success: (res) => {
        if (res.confirm) {
          this.deleteFavoriteFromServer(favoriteId);
        }
      }
    });
  },

  deleteFavoriteFromServer(favoriteId) {
    wx.showLoading({ title: '更新中...' });
    const item = this.data.favorites.find((favorite) => favorite.favoriteId === favoriteId);
    const recipeId = item ? item.id : favoriteId;

    app.removeFavoriteWithSync(recipeId)
      .then(() => {
        wx.hideLoading();
        this.loadFavorites();
        this.loadRecentRecipes();
        wx.showToast({ title: '已取消', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '取消失败', icon: 'none' });
      });
  },

  onPullDownRefresh() {
    const tasks = [Promise.resolve().then(() => this.loadRecentRecipes())];

    if (app.globalData.isLoggedIn) {
      tasks.push(this.syncFavoritesFromServer());
    }

    Promise.all(tasks)
      .finally(() => wx.stopPullDownRefresh());
  },

  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
