const app = getApp()

function parseNutritionValue(val) {
  if (typeof val === 'number') {
    return val
  }
  if (!val) {
    return 0
  }
  const match = String(val).match(/-?\d+(\.\d+)?/)
  return match ? parseFloat(match[0]) : 0
}

function normalizeUnit(unit, fallback = 'g') {
  const normalized = String(unit || '').trim().toLowerCase()
  if (normalized === 'ml') {
    return 'ml'
  }
  if (normalized === 'g') {
    return 'g'
  }
  return fallback
}

function parseAmount(amount) {
  const raw = String(amount || '').trim()
  const match = raw.match(/(-?\d+(?:\.\d+)?)\s*(g|ml)/i)

  if (!match) {
    return {
      raw,
      value: null,
      unit: ''
    }
  }

  return {
    raw,
    value: Number(match[1]),
    unit: normalizeUnit(match[2])
  }
}

function normalizeNutritionInfo(source) {
  const calories = parseNutritionValue(source && source.calories)
  const protein = parseNutritionValue(source && source.protein)
  const fat = parseNutritionValue(source && source.fat)
  const carbohydrates = parseNutritionValue(source && (source.carbohydrates ?? source.carbs))

  return {
    calories,
    protein,
    fat,
    carbohydrates,
    carbs: carbohydrates
  }
}

function normalizeIngredient(item = {}, index = 0) {
  const parsedAmount = parseAmount(item.amount)
  const weight = item.weight !== undefined && item.weight !== null && item.weight !== '' && !Number.isNaN(Number(item.weight))
    ? Number(item.weight)
    : parsedAmount.value
  const basisUnit = normalizeUnit(
    item.nutrition_basis_unit || item.nutritionBasisUnit || parsedAmount.unit || 'g',
    parsedAmount.unit || 'g'
  )
  const unitNormalized = normalizeUnit(item.unitNormalized || item.unit || parsedAmount.unit || basisUnit, basisUnit)
  const nutritionInfo = normalizeNutritionInfo(
    item.nutrition_per_100 || item.nutritionPer100 || item.nutrition_per_100g || item.nutrition || {}
  )
  const amount = weight !== null && weight !== undefined && weight !== ''
    ? `${weight}${unitNormalized}`
    : String(item.amount || '').trim()

  return {
    ...item,
    name: item.name || `食材${index + 1}`,
    amount,
    weight: weight !== null && weight !== undefined ? weight : '',
    unit: unitNormalized,
    unitNormalized,
    nutrition_per_100: nutritionInfo,
    nutrition_basis_unit: basisUnit,
    nutritionInfo,
    nutritionBasisLabel: `每100${basisUnit}`,
    hasNumericAmount: weight !== null && weight !== undefined && weight !== '',
    nutritionCalculationBlocked: false,
    actualNutrition: null
  }
}

function normalizeRecipeForView(recipe = {}) {
  const nutrition = recipe.nutrition || recipe.nutrition_total || {}

  return {
    ...recipe,
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((item, index) => normalizeIngredient(item, index))
      : [],
    nutrition: {
      calories: parseNutritionValue(nutrition.calories),
      protein: parseNutritionValue(nutrition.protein),
      fat: parseNutritionValue(nutrition.fat),
      carbs: parseNutritionValue(nutrition.carbs ?? nutrition.carbohydrates)
    }
  }
}

function serializeIngredient(item = {}) {
  const normalizedItem = normalizeIngredient(item)
  const {
    actualNutrition,
    hasNumericAmount,
    nutritionCalculationBlocked,
    nutritionBasisLabel,
    nutritionInfo,
    ...rest
  } = normalizedItem

  return {
    ...rest,
    amount: normalizedItem.weight !== '' ? `${normalizedItem.weight}${normalizedItem.unitNormalized}` : normalizedItem.amount,
    nutrition_per_100: nutritionInfo,
    nutrition_basis_unit: normalizedItem.nutrition_basis_unit
  }
}

function serializeRecipeForStorage(recipe = {}) {
  const normalizedRecipe = normalizeRecipeForView(recipe)
  const recipeId = normalizedRecipe.id || normalizedRecipe.recipe_id || normalizedRecipe.recipeId || Date.now().toString()
  const carbs = parseNutritionValue(normalizedRecipe.nutrition.carbs ?? normalizedRecipe.nutrition.carbohydrates)

  return {
    ...normalizedRecipe,
    id: recipeId,
    recipe_id: normalizedRecipe.recipe_id || recipeId,
    ingredients: Array.isArray(normalizedRecipe.ingredients)
      ? normalizedRecipe.ingredients.map((item) => serializeIngredient(item))
      : [],
    nutrition: {
      calories: parseNutritionValue(normalizedRecipe.nutrition.calories),
      protein: parseNutritionValue(normalizedRecipe.nutrition.protein),
      fat: parseNutritionValue(normalizedRecipe.nutrition.fat),
      carbs,
      carbohydrates: carbs
    }
  }
}

Page({
  data: {
    recipe: {},
    isFavorite: false,
    isLocalHistoryRecipe: false,
    originalNutrition: {},
    isLoggedIn: false,
    imagePath: '',
    recordDate: '',
    recordTime: ''
  },

  getRecipeId(recipe = this.data.recipe) {
    if (app.getRecipeId) {
      return app.getRecipeId(recipe);
    }
    if (!recipe) return '';
    return recipe.id || recipe.recipe_id || recipe.recipeId || '';
  },

  onLoad(options) {
    // 处理日期：有传入则用传入日期，否则用今天
    try {
      const dateStr = options && options.date ? getApp().toLocalYMD(options.date) : getApp().toLocalYMD(new Date());
      // 默认时间 HH:MM
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      this.setData({ recordDate: dateStr, recordTime: `${hh}:${mi}` });
      try { wx.setNavigationBarTitle({ title: dateStr }); } catch (_) {}
    } catch (e) {}
    if (options.recipe) {
      const recipe = JSON.parse(decodeURIComponent(options.recipe));
      const fromFavorites = options.from === 'favorites';
      const fromRecent = options.from === 'recent' || options.from === 'library';
      const incomingRecipeId = this.getRecipeId(recipe);
      // 若本地已收藏，优先用收藏里的 recipe_data 覆盖（保持最新编辑状态）
      const fav = incomingRecipeId && app.isRecipeFavorited && app.isRecipeFavorited(incomingRecipeId)
        ? app.findFavoriteByRecipeId(incomingRecipeId)
        : null;
      const recipeToUse = normalizeRecipeForView(fav ? { ...fav } : { ...recipe });
      const normalizedRecipeId = this.getRecipeId(recipeToUse);
      if (normalizedRecipeId) {
        recipeToUse.id = normalizedRecipeId;
        recipeToUse.recipe_id = recipeToUse.recipe_id || normalizedRecipeId;
      }
      // 组装图片完整URL（用于 <image src>）
      if (recipeToUse.image_url) {
        recipeToUse.image_full_url = app.buildImageUrl(recipeToUse.image_url);
      }
      const isFavorite = !!(
        fromFavorites ||
        recipeToUse.favoriteId ||
        (normalizedRecipeId && app.isRecipeFavorited && app.isRecipeFavorited(normalizedRecipeId))
      );
      const isLocalHistoryRecipe = !!(
        normalizedRecipeId &&
        fromRecent &&
        app.isRecipeInHistory &&
        app.isRecipeInHistory(normalizedRecipeId)
      );
      this.setData({
        recipe: recipeToUse,
        originalNutrition: { ...(recipeToUse.nutrition || recipe.nutrition || {}) },
        fromFavorites,
        isFavorite,
        isLocalHistoryRecipe
      }, () => {
        this.recalculateNutrition(() => {
          if (isLocalHistoryRecipe) {
            this.persistRecipeToLocalHistory({ showToast: false, moveToTop: false })
          }
        });
      });
      this.updateLoginStatus();
      this.checkFavoriteStatus();
    }
  },

  // 选择记录时间
  onTimeChange(e) {
    this.setData({ recordTime: e.detail.value });
  },

  // 将当前菜谱作为“菜谱记录”写入饮食记录（record_type='recipe'，复用 quick_* 字段）
  recordRecipeToDiet() {
    if (!app.globalData.isLoggedIn) {
      app.checkLoginAndShowModal().then(() => this.recordRecipeToDiet());
      return;
    }
    try {
      const r = this.data.recipe || {};
      const dateStr = this.data.recordDate || getApp().toLocalYMD(new Date());
      const timeStr = (this.data.recordTime && String(this.data.recordTime).substring(0,5)) || (new Date().toTimeString().substring(0,5));
      // 取总营养（已在 recalculateNutrition 中汇总到 recipe.nutrition）
      const total = r.nutrition || { calories: 0, protein: 0, fat: 0, carbs: 0 };
      const payload = {
        record_type: 'recipe',
        quick_food_name: r.name || '菜谱',
        quick_energy_kcal: Number(total.calories || 0),
        quick_protein_g: Number(total.protein || 0),
        quick_fat_g: Number(total.fat || 0),
        quick_carbohydrate_g: Number(total.carbs || 0),
        quick_image_url: r.image_url || r.image_full_url || '',
        quantity_value: null,
        quantity_unit: null,
        record_date: dateStr,
        record_time: timeStr,
        notes: ''
      };
      wx.showLoading({ title: '记录中...' });
      wx.request({
        url: app.globalData.serverUrl + '/api/diet-records',
        method: 'POST',
        header: { 'Authorization': 'Bearer ' + app.globalData.token, 'Content-Type': 'application/json' },
        data: payload,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            wx.showToast({ title: '已记录', icon: 'success' });
            // 本地追加并刷新当日汇总
            try {
              const created = res.data && res.data.record ? res.data.record : null;
              if (created) {
                const local = app.globalData.dietRecords || [];
                local.push(created);
                app.globalData.dietRecords = local;
                app.saveDietRecordsToLocal && app.saveDietRecordsToLocal(local);
                app.calculateDailyCalorieSummary && app.calculateDailyCalorieSummary(dateStr);
                // 跳转到当天记录列表并高亮新纪录
                const hid = created.id ? `&highlightId=${encodeURIComponent(created.id)}` : '';
                const url = `/pages/record/record-detail-list?date=${encodeURIComponent(dateStr)}${hid}`;
                setTimeout(() => {
                  wx.redirectTo({ url }).catch(() => wx.navigateTo({ url }));
                }, 600);
              }
            } catch(_) {}
          } else {
            wx.showToast({ title: res.data && res.data.error ? res.data.error : '记录失败', icon: 'none' });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      });
    } catch (e) {
      wx.showToast({ title: '记录失败', icon: 'none' });
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

  persistRecipeToLocalHistory(options = {}) {
    const { showToast = true, moveToTop = false } = options
    const currentRecipe = this.data.recipe || {}
    const recipeId = this.getRecipeId(currentRecipe)

    if (!recipeId) {
      if (showToast) {
        wx.showToast({ title: '缺少菜谱ID', icon: 'none' })
      }
      return null
    }

    const recipeToSave = serializeRecipeForStorage(currentRecipe)
    const savedRecipe = app.upsertHistoryRecipe
      ? app.upsertHistoryRecipe(recipeToSave, { moveToTop })
      : recipeToSave
    const recipeForView = normalizeRecipeForView(savedRecipe)

    if (recipeForView.image_url) {
      recipeForView.image_full_url = app.buildImageUrl(recipeForView.image_url)
    }

    this.setData({
      recipe: recipeForView,
      isLocalHistoryRecipe: true
    })

    if (showToast) {
      wx.showToast({ title: '已保存', icon: 'success' })
    }

    return savedRecipe
  },

  saveRecentRecipe() {
    this.persistRecipeToLocalHistory({ showToast: true, moveToTop: false })
  },

  // 点击“更新”（仅从收藏进入时可见）：更新本地与云端收藏的 recipe_data
  updateFavoriteRecipe() {
    if (!app.globalData.isLoggedIn) {
      app.checkLoginAndShowModal().then(() => this.updateFavoriteRecipe());
      return;
    }
    const updatedRecipe = { ...this.data.recipe };
    const recipeId = this.getRecipeId(updatedRecipe);
    if (!recipeId) {
      wx.showToast({ title: '缺少菜谱ID', icon: 'none' });
      return;
    }
    updatedRecipe.id = recipeId;
    updatedRecipe.recipe_id = updatedRecipe.recipe_id || recipeId;
    updatedRecipe.ingredients = (updatedRecipe.ingredients || []).map((item) => serializeIngredient(item));
    const doUpdate = (imagePathOnly) => {
      if (imagePathOnly) {
        updatedRecipe.image_url = imagePathOnly;
        updatedRecipe.image_full_url = app.buildImageUrl(imagePathOnly);
      }
      wx.showLoading({ title: '更新中...' });
      app.updateFavoriteWithSync(updatedRecipe)
      .then(() => {
        if (imagePathOnly) {
          const nextRecipe = { ...this.data.recipe, image_url: imagePathOnly, image_full_url: app.buildImageUrl(imagePathOnly) }
          this.setData({ recipe: nextRecipe, imagePath: '' })
        }
        if (this.data.isLocalHistoryRecipe) {
          this.persistRecipeToLocalHistory({ showToast: false, moveToTop: false })
        }
        wx.hideLoading();
        wx.showToast({ title: '已更新', icon: 'success' });
        // 从收藏进入则返回收藏页，便于查看最新列表
        if (this.data.fromFavorites) {
          setTimeout(() => {
            wx.switchTab({ url: '/pages/favorites/favorites' });
          }, 600);
        }
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
    const recipe = this.data.recipe || {};
    const recipeId = this.getRecipeId(recipe);
    const isFavorite = !!(
      this.data.fromFavorites ||
      recipe.favoriteId ||
      (recipeId && app.isRecipeFavorited ? app.isRecipeFavorited(recipeId) : false)
    );
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
    const recipeId = this.getRecipeId(recipe);
    
    if (this.data.isFavorite) {
      // 取消收藏
      this.removeFromFavorites(recipeId || recipe.favoriteId);
    } else {
      // 添加收藏
      this.addToFavorites(recipe);
    }
  },

  // 添加到收藏（统一接口：云端成功→本地同步）
  addToFavorites(recipe) {
    const recipeToSave = { ...recipe };
    const recipeId = this.getRecipeId(recipeToSave);
    if (!recipeId) {
      wx.showToast({ title: '缺少菜谱ID', icon: 'none' });
      return;
    }
    recipeToSave.id = recipeId;
    recipeToSave.recipe_id = recipeToSave.recipe_id || recipeId;
    recipeToSave.ingredients = (recipeToSave.ingredients || []).map((item) => serializeIngredient(item));
    const proceedFavorite = (pathOnly) => {
      if (pathOnly) {
        recipeToSave.image_url = pathOnly;
      }
      wx.showLoading({ title: '收藏中...' });
      app.addFavoriteWithSync(recipeToSave)
        .then(() => {
          // 将持久化后的路径回写到本地状态，并清空本地预览
          if (pathOnly) {
            const r = { ...this.data.recipe, image_url: pathOnly, image_full_url: app.buildImageUrl(pathOnly) };
            this.setData({ recipe: r, imagePath: '' });
          }
          if (this.data.isLocalHistoryRecipe) {
            this.persistRecipeToLocalHistory({ showToast: false, moveToTop: false })
          }
          wx.hideLoading();
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
  recalculateNutrition(callback) {
    const recipe = normalizeRecipeForView(this.data.recipe);
    let totalCalories = 0
    let totalProtein = 0
    let totalFat = 0
    let totalCarbs = 0

    recipe.ingredients.forEach((item) => {
      const parsedAmount = parseAmount(item.amount)
      const amountValue = item.weight !== '' && item.weight !== null && item.weight !== undefined
        ? Number(item.weight)
        : parsedAmount.value
      const amountUnit = normalizeUnit(item.unitNormalized || parsedAmount.unit || item.nutrition_basis_unit, item.nutrition_basis_unit)
      const nutritionData = normalizeNutritionInfo(item.nutrition_per_100 || item.nutritionInfo || {})
      const canCalculate = amountValue !== null && amountValue !== undefined && amountValue !== '' && amountUnit === item.nutrition_basis_unit

      item.weight = amountValue !== null && amountValue !== undefined ? amountValue : ''
      item.unit = amountUnit
      item.unitNormalized = amountUnit
      item.amount = amountValue !== null && amountValue !== undefined && amountValue !== ''
        ? `${amountValue}${amountUnit}`
        : item.amount
      item.nutritionInfo = nutritionData
      item.nutritionBasisLabel = `每100${item.nutrition_basis_unit}`
      item.hasNumericAmount = amountValue !== null && amountValue !== undefined && amountValue !== ''
      item.nutritionCalculationBlocked = !!(item.hasNumericAmount && amountUnit !== item.nutrition_basis_unit)

      if (canCalculate) {
        item.actualNutrition = {
          calories: Math.round((amountValue / 100) * parseNutritionValue(nutritionData.calories)),
          protein: Math.round((amountValue / 100) * parseNutritionValue(nutritionData.protein) * 10) / 10,
          fat: Math.round((amountValue / 100) * parseNutritionValue(nutritionData.fat) * 10) / 10,
          carbs: Math.round((amountValue / 100) * parseNutritionValue(nutritionData.carbohydrates) * 10) / 10
        }
        totalCalories += item.actualNutrition.calories
        totalProtein += item.actualNutrition.protein
        totalFat += item.actualNutrition.fat
        totalCarbs += item.actualNutrition.carbs
      } else {
        item.actualNutrition = null
      }
    })

    recipe.nutrition = {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10
    }
    this.setData({ recipe }, () => {
      if (typeof callback === 'function') {
        callback(recipe)
      }
    })
  },

  // 更新食材重量（实时计算营养）
  updateIngredientWeight(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    const newWeight = value === '' ? '' : parseNutritionValue(value)
    const recipe = this.data.recipe
    const ingredient = recipe.ingredients[index]

    ingredient.weight = newWeight
    ingredient.amount = newWeight === '' ? '' : `${newWeight}${ingredient.unitNormalized || ingredient.unit || 'g'}`

    this.setData({ recipe }, () => {
      this.recalculateNutrition()
    })
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
