const app = getApp()

Page({
  data: {
    recipe: {},
    isFavorite: false,
    originalNutrition: {},
    isLoggedIn: false,
    imagePath: ''
  },

  onLoad(options) {
    if (options.recipe) {
      const recipe = JSON.parse(decodeURIComponent(options.recipe));
      const fromFavorites = options.from === 'favorites';
      // 若本地已收藏，优先用收藏里的 recipe_data 覆盖（保持最新编辑状态）
      const fav = app.isRecipeFavorited && app.isRecipeFavorited(recipe.id) ? app.findFavoriteByRecipeId(recipe.id) : null;
      const recipeToUse = fav ? { ...fav } : recipe;
      // 初始化每个食材的weight和unit
      if (recipeToUse.ingredients) {
        recipeToUse.ingredients.forEach(item => {
          // weight
          if (!item.weight) {
            const match = item.amount && item.amount.match(/\d+/);
            if (match) {
              item.weight = parseInt(match[0]);
            } else {
              item.weight = '';
            }
          }
          // unit
          if (!item.unit) {
            const unitMatch = item.amount && item.amount.replace(/\d+/g, '');
            item.unit = unitMatch && unitMatch.trim() ? unitMatch.trim() : 'g';
          }
        });
      }
      // 组装图片完整URL（用于 <image src>）
      if (recipeToUse.image_url) {
        recipeToUse.image_full_url = app.buildImageUrl(recipeToUse.image_url);
      }
      this.setData({
        recipe: recipeToUse,
        originalNutrition: { ...recipe.nutrition },
        fromFavorites
      }, () => {
        this.recalculateNutrition();
      });
      this.updateLoginStatus();
      this.checkFavoriteStatus();
    }
  },

  // 选择/替换菜谱图片（仅本地预览；不立即上传，等收藏/更新时再上传）
  chooseRecipeImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album','camera'],
      success: (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath;
        if (!filePath) return;
        // 仅本地预览，记录为待上传路径
        this.setData({ imagePath: filePath });
      }
    });
  },

  onRecipeImgError() {
    // 图片加载失败占位
    const recipe = { ...this.data.recipe };
    delete recipe.image_full_url;
    this.setData({ recipe });
  },

  // 删除缩略图
  removeRecipeImage() {
    const recipe = { ...this.data.recipe };
    delete recipe.image_url;
    delete recipe.image_full_url;
    this.setData({ recipe, imagePath: '' });
  },

  // 点击“更新”（仅从收藏进入时可见）：更新本地与云端收藏的 recipe_data
  updateFavoriteRecipe() {
    if (!app.globalData.isLoggedIn) {
      app.checkLoginAndShowModal().then(() => this.updateFavoriteRecipe());
      return;
    }
    const updatedRecipe = { ...this.data.recipe };
    // 确保 ingredients 的 amount 与 weight 同步为数值+单位（默认g）
    updatedRecipe.ingredients = (updatedRecipe.ingredients || []).map(it => {
      const unit = it.unitNormalized || it.unit || 'g';
      const weight = Number(it.weight) || 0;
      return { ...it, unitNormalized: unit, unit, weight, amount: `${weight}${unit}` };
    });
    const doUpdate = (imagePathOnly) => {
      if (imagePathOnly) {
        updatedRecipe.image_url = imagePathOnly;
        updatedRecipe.image_full_url = app.buildImageUrl(imagePathOnly);
      }
      wx.showLoading({ title: '更新中...' });
      app.updateFavoriteWithSync(updatedRecipe)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已更新', icon: 'success' });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '更新失败', icon: 'none' });
      });
    };

    // 若本地选择了新图片，则先上传获取 /uploads/...，否则沿用已有 image_url
    if (this.data.imagePath) {
      wx.showLoading({ title: '上传图片...' });
      app.uploadImageToServer(this.data.imagePath)
        .then(pathOnly => { wx.hideLoading(); doUpdate(pathOnly); })
        .catch(err => { wx.hideLoading(); wx.showToast({ title: err.message || '上传失败', icon: 'none' }); });
    } else {
      doUpdate(null);
    }
  },

  // 更新登录状态
  updateLoginStatus() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn });
  },

  // 检查收藏状态
  checkFavoriteStatus() {
    // 改为本地判断，避免每次进入详情都请求云端
    const recipeId = this.data.recipe && this.data.recipe.id;
    const isFavorite = recipeId ? (app.isRecipeFavorited ? app.isRecipeFavorited(recipeId) : false) : false;
    this.setData({ isFavorite });
  },

  // 切换收藏状态
  toggleFavorite() {
    if (!app.globalData.isLoggedIn) {
      // 未登录，弹出登录确认
      app.checkLoginAndShowModal().then(() => {
        this.updateLoginStatus();
        this.toggleFavorite();
      }).catch(() => {
        // 用户取消登录
      });
      return;
    }

    const recipe = this.data.recipe;
    
    if (this.data.isFavorite) {
      // 取消收藏
      this.removeFromFavorites(recipe.id);
    } else {
      // 添加收藏
      this.addToFavorites(recipe);
    }
  },

  // 添加到收藏（统一接口：云端成功→本地同步）
  addToFavorites(recipe) {
    const recipeToSave = { ...recipe };
    const proceedFavorite = (pathOnly) => {
      if (pathOnly) {
        recipeToSave.image_url = pathOnly;
      }
      wx.showLoading({ title: '收藏中...' });
      app.addFavoriteWithSync(recipeToSave)
        .then(() => {
          wx.hideLoading();
          // 将持久化后的路径回写到本地状态，并清空本地预览
          if (pathOnly) {
            const r = { ...this.data.recipe, image_url: pathOnly, image_full_url: app.buildImageUrl(pathOnly) };
            this.setData({ recipe: r, imagePath: '' });
          }
          this.setData({ isFavorite: true });
          wx.showToast({ title: '收藏成功', icon: 'success' });
        })
        .catch((err) => {
          wx.hideLoading();
          wx.showToast({ title: err.message || '收藏失败', icon: 'none' });
        });
    };

    // 参考记录页：若有本地图片，先上传→拿 /uploads/... 再入库
    if (this.data.imagePath) {
      wx.showLoading({ title: '上传图片...' });
      app.uploadImageToServer(this.data.imagePath)
        .then((pathOnly) => { wx.hideLoading(); proceedFavorite(pathOnly); })
        .catch((err) => { wx.hideLoading(); wx.showToast({ title: err.message || '上传失败', icon: 'none' }); });
    } else {
      proceedFavorite(null);
    }
  },

  // 取消收藏
  removeFromFavorites(recipeId) {
    app.removeFavoriteWithSync(recipeId)
      .then(() => {
        this.setData({ isFavorite: false });
        wx.showToast({ title: '已取消收藏', icon: 'success' });
      })
      .catch(err => {
        wx.showToast({ title: err.message || '取消收藏失败', icon: 'none' });
      });
  },

  // deleteFavorite 不再暴露（由统一接口内部处理）

  // 重新计算营养信息
  recalculateNutrition() {
    function parseNutritionValue(val) {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const match = String(val).match(/-?\d+(\.\d+)?/);
      return match ? parseFloat(match[0]) : 0;
    }
    const recipe = this.data.recipe;
    let totalCalories = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0;
    recipe.ingredients.forEach(item => {
      //console.log('食材:', item.name, 'amount:', item.amount, 'nutritionInfo:', item.nutritionInfo);
      // Unify nutrition data source for WXML
      item.nutritionInfo = item.nutrition_per_100g || item.nutrition || {};

      // Add a flag to control UI visibility
      const match = item.amount && String(item.amount).match(/\d+/);
      item.hasNumericAmount = !!match;
      const amount = match ? parseFloat(match[0]) : null;

      const nutritionData = item.nutritionInfo;
      if (nutritionData) {
        if (item.hasNumericAmount && amount !== null) {
          item.actualNutrition = {
            calories: Math.round((amount / 100) * parseNutritionValue(nutritionData.calories)),
            protein: Math.round((amount / 100) * parseNutritionValue(nutritionData.protein) * 10) / 10,
            fat: Math.round((amount / 100) * parseNutritionValue(nutritionData.fat) * 10) / 10,
            carbs: Math.round((amount / 100) * (parseNutritionValue(nutritionData.carbohydrates) || parseNutritionValue(nutritionData.carbs)) * 10) / 10
          };
          totalCalories += item.actualNutrition.calories;
          totalProtein += item.actualNutrition.protein;
          totalFat += item.actualNutrition.fat;
          totalCarbs += item.actualNutrition.carbs;
        } else {
          item.actualNutrition = null;
        }
      }
    });
    recipe.nutrition = {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10
    };
    this.setData({ recipe });
  },

  // 更新食材重量（实时计算营养）
  updateIngredientWeight(e) {
    const index = e.currentTarget.dataset.index;
    const newWeight = parseInt(e.detail.value) || 0;
    const recipe = this.data.recipe;
    const ingredient = recipe.ingredients[index];
    
    ingredient.weight = newWeight;
    ingredient.amount = newWeight + (ingredient.unit || 'g'); // Keep amount and weight in sync

    this.setData({ recipe }, () => {
      this.recalculateNutrition();
    });
  },

  // 分享菜谱
  shareRecipe() {
    const recipe = this.data.recipe;
    const shareText = `${recipe.name}\n\n${recipe.description}\n\n营养信息：\n热量：${recipe.nutrition.calories}千卡\n蛋白质：${recipe.nutrition.protein}g\n脂肪：${recipe.nutrition.fat}g\n碳水化合物：${recipe.nutrition.carbs}g\n\n食材：\n${recipe.ingredients.map(item => `${item.name} ${item.amount}`).join('\n')}\n\n制作步骤：\n${recipe.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\n小贴士：${recipe.tips ? recipe.tips : ''}`;
    
    wx.setClipboardData({
      data: shareText,
      success: () => {
        wx.showToast({
          title: '菜谱已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  },

  // 保存到服务器（预留功能）
  saveToServer() {
    const recipe = this.data.recipe;
    
    // 这里预留服务器保存功能
    // 用户需要自己实现服务器端API
    wx.showModal({
      title: '功能提示',
      content: '此功能需要配置服务器端API，请根据您的服务器实现相应的保存逻辑。',
      showCancel: false
    });
    
    // 示例代码（需要根据实际服务器API调整）
    /*
    wx.request({
      url: app.globalData.serverUrl + '/recipes',
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: recipe,
      success: (res) => {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      },
      fail: (error) => {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    });
    */
  },

  // 页面分享
  onShareAppMessage() {
    const recipe = this.data.recipe;
    return {
      title: recipe.name,
      desc: recipe.description,
      path: `/pages/recipe/recipe?recipe=${encodeURIComponent(JSON.stringify(recipe))}`
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const recipe = this.data.recipe;
    return {
      title: recipe.name,
      query: `recipe=${encodeURIComponent(JSON.stringify(recipe))}`
    };
  }
}) 