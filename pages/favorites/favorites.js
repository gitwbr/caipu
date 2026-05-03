const app = getApp();

function parseNumericValue(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

function normalizeUnit(unit, fallback = 'g') {
  const normalized = String(unit || '').trim().toLowerCase();
  if (normalized === 'ml') {
    return 'ml';
  }
  if (normalized === 'g') {
    return 'g';
  }
  return fallback;
}

function parseAmount(amount) {
  const raw = String(amount || '').trim();
  const match = raw.match(/(-?\d+(?:\.\d+)?)\s*(g|ml)/i);

  if (!match) {
    return {
      raw,
      value: null,
      unit: ''
    };
  }

  return {
    raw,
    value: Number(match[1]),
    unit: normalizeUnit(match[2])
  };
}

function getCalculatedCalories(recipe) {
  if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return null;
  }

  let totalCalories = 0;
  let hasCalculatedIngredient = false;

  recipe.ingredients.forEach((item = {}) => {
    const parsedAmount = parseAmount(item.amount);
    const amountValue = item.weight !== undefined && item.weight !== null && item.weight !== '' && !Number.isNaN(Number(item.weight))
      ? Number(item.weight)
      : parsedAmount.value;

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return;
    }

    const basisUnit = normalizeUnit(
      item.nutrition_basis_unit || item.nutritionBasisUnit || parsedAmount.unit || 'g',
      parsedAmount.unit || 'g'
    );
    const amountUnit = normalizeUnit(
      item.unitNormalized || item.unit || parsedAmount.unit || basisUnit,
      basisUnit
    );

    if (amountUnit !== basisUnit) {
      return;
    }

    const nutrition = item.nutrition_per_100 || item.nutritionPer100 || item.nutrition_per_100g || item.nutritionInfo || item.nutrition || {};
    const caloriesPer100 = parseNumericValue(nutrition.calories);

    if (caloriesPer100 <= 0) {
      return;
    }

    totalCalories += (amountValue / 100) * caloriesPer100;
    hasCalculatedIngredient = true;
  });

  return hasCalculatedIngredient ? Math.round(totalCalories) : null;
}

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

  if (recipe.nutrition && parseNumericValue(recipe.nutrition.calories) > 0) {
    return recipe.nutrition.calories;
  }

  if (recipe.nutrition_total && parseNumericValue(recipe.nutrition_total.calories) > 0) {
    return recipe.nutrition_total.calories;
  }

  return getCalculatedCalories(recipe);
}

function buildRecipeCard(recipe, options = {}) {
  const recipeId = getRecipeId(recipe);
  const favoriteRecipe = recipeId && app.findFavoriteByRecipeId
    ? app.findFavoriteByRecipeId(recipeId)
    : null;
  const merged = favoriteRecipe
    ? {
        ...favoriteRecipe,
        ...recipe,
        favoriteId: favoriteRecipe.favoriteId || recipe.favoriteId || '',
        image_url: favoriteRecipe.image_url || recipe.image_url || ''
      }
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
    const history = app.loadHistory ? app.loadHistory() : (wx.getStorageSync('history') || []);
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
    const from = scope === 'favorites' ? 'favorites' : 'recent';
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
    if (recipeId && app.removeHistoryRecipe) {
      app.removeHistoryRecipe(recipeId);
    } else {
      const history = app.loadHistory ? app.loadHistory() : (wx.getStorageSync('history') || []);
      const nextHistory = history.filter((_, itemIndex) => itemIndex !== index);
      if (app.saveHistoryToLocal) {
        app.saveHistoryToLocal(nextHistory);
      } else {
        wx.setStorageSync('history', nextHistory);
      }
    }
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
