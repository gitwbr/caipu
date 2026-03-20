const app = getApp()

const TAB_OPTIONS = [
  {
    key: 'ingredients',
    label: '食材',
    desc: '先把今天想处理的食材挑出来',
    eyebrow: 'INGREDIENTS',
    panelTitle: '先定主角食材',
    note: '支持多选，越贴近冰箱现状，结果越实用'
  },
  {
    key: 'dishType',
    label: '菜品类型',
    desc: '先决定是炒菜、汤还是小吃',
    eyebrow: 'DISH TYPE',
    panelTitle: '给这道菜一个类型',
    note: '适合先定餐桌氛围，再补食材'
  },
  {
    key: 'cuisine',
    label: '菜系风格',
    desc: '让成品更偏家常、川味或轻食',
    eyebrow: 'CUISINE',
    panelTitle: '锁定味型方向',
    note: '不选也可以，系统默认按家常菜生成'
  },
  {
    key: 'method',
    label: '烹饪方式',
    desc: '决定它更像一份清蒸、红烧或凉拌',
    eyebrow: 'METHOD',
    panelTitle: '补上做法偏好',
    note: '当你已经想好做法时，这一步最省时间'
  }
]

const QUICK_SCENES = [
  {
    key: 'weekday-fast',
    kicker: '快',
    label: '家常快手',
    desc: '炒菜 + 家常菜',
    dishTypeIndex: 0,
    typeIndex: 0,
    methodIndex: 4
  },
  {
    key: 'fit-light',
    kicker: '轻',
    label: '轻盈健身',
    desc: '炒菜 + 健身餐 + 清蒸',
    dishTypeIndex: 0,
    typeIndex: 1,
    methodIndex: 1
  },
  {
    key: 'warm-soup',
    kicker: '汤',
    label: '暖胃热汤',
    desc: '汤 + 家常菜 + 炖',
    dishTypeIndex: 1,
    typeIndex: 0,
    methodIndex: 2
  },
  {
    key: 'weekend-snack',
    kicker: '馋',
    label: '周末解馋',
    desc: '小吃 + 家常菜 + 烤',
    dishTypeIndex: 4,
    typeIndex: 0,
    methodIndex: 5
  }
]

const CUSTOM_INPUT_CONFIG = {
  ingredient: {
    title: '添加自定义食材',
    placeholder: '请输入自定义食材'
  },
  dishType: {
    title: '添加菜品类型',
    placeholder: '请输入自定义类型'
  },
  type: {
    title: '添加菜系风格',
    placeholder: '请输入自定义菜系'
  },
  method: {
    title: '添加烹饪方式',
    placeholder: '请输入自定义方式'
  }
}

Page({
  data: {
    isLoading: false,
    categorizedIngredients: [],
    typeNames: [],
    methodNames: [],
    dishTypeNames: [],
    recentRecipes: [],
    tabOptions: TAB_OPTIONS,
    quickScenes: QUICK_SCENES,
    activeTab: 0,
    selectedIngredientNames: [],
    selectedTypeIndex: null,
    selectedTypeName: '',
    selectedMethodIndex: null,
    selectedMethodName: '',
    selectedDishTypeIndex: null,
    selectedDishTypeName: '',
    selectedSummaryItems: [],
    selectionCount: 0,
    selectedMetaCount: 0,
    ingredientCategoryTabs: ['肉类蛋类', '水产海鲜', '蔬菜菌菇', '豆制品', '主食'],
    activeIngredientCategoryTab: 0,
    activePresetKey: '',
    showAddCustomInput: false,
    addCustomType: '',
    addCustomValue: '',
    customInputTitle: '添加自定义选项',
    customInputPlaceholder: '请输入内容',
    userLimits: null,
    remainingGenerationCount: null,
    isLoggedIn: false
  },

  onLoad() {
    this.generateRequestLocked = false
    this.initOptions()
    this.loadRecentRecipes()
    this.updateLoginStatus()
  },

  onShow() {
    app.syncTabBar(this)
    this.loadRecentRecipes()
    this.updateLoginStatus()
  },

  applyUserLimits(limits) {
    if (!limits) {
      return
    }

    const remainingGenerationCount = Math.max(
      Number(limits.daily_generation_limit || 0) - Number(limits.daily_generation_count || 0),
      0
    )

    this.setData({
      userLimits: limits,
      remainingGenerationCount
    })
  },

  updateLoginStatus() {
    const currentApp = getApp()
    const isLoggedIn = currentApp.globalData.isLoggedIn

    this.setData({
      isLoggedIn,
      remainingGenerationCount: null
    })

    if (isLoggedIn) {
      currentApp.checkUserLimits().then((limits) => {
        this.applyUserLimits(limits)
      }).catch((error) => {
        console.error('获取用户限制失败:', error)
        const cachedLimits = wx.getStorageSync('userLimits')
        if (cachedLimits) {
          this.applyUserLimits(cachedLimits)
        }
      })
    } else {
      this.setData({
        userLimits: null,
        remainingGenerationCount: null
      })
      wx.removeStorageSync('userLimits')
    }
  },

  initOptions() {
    const categorizedIngredients = [
      {
        categoryName: '肉类蛋类',
        ingredients: [
          { name: '鸡胸肉', selected: false }, { name: '鸡腿肉', selected: false }, { name: '鸡翅', selected: false }, { name: '鸡蛋', selected: false }, { name: '鹌鹑蛋', selected: false },
          { name: '牛腩', selected: false }, { name: '牛腱子', selected: false }, { name: '牛肋条', selected: false }, { name: '牛里脊', selected: false }, { name: '牛排', selected: false }, { name: '瘦牛肉', selected: false }, { name: '肥牛', selected: false },
          { name: '猪里脊', selected: false }, { name: '五花肉', selected: false }, { name: '排骨', selected: false },
          { name: '羊肉', selected: false }, { name: '鸭肉', selected: false }
        ]
      },
      {
        categoryName: '水产海鲜',
        ingredients: [
          { name: '草鱼', selected: false }, { name: '鲫鱼', selected: false }, { name: '鲈鱼', selected: false }, { name: '带鱼', selected: false }, { name: '三文鱼', selected: false }, { name: '鳕鱼', selected: false },
          { name: '基围虾', selected: false }, { name: '明虾', selected: false }, { name: '虾仁', selected: false },
          { name: '鱿鱼', selected: false }, { name: '蛤蜊', selected: false }, { name: '螃蟹', selected: false }, { name: '扇贝', selected: false }, { name: '生蚝', selected: false }
        ]
      },
      {
        categoryName: '蔬菜菌菇',
        ingredients: [
          { name: '土豆', selected: false }, { name: '西红柿', selected: false }, { name: '青椒', selected: false }, { name: '胡萝卜', selected: false },
          { name: '洋葱', selected: false }, { name: '青菜', selected: false }, { name: '茄子', selected: false }, { name: '黄瓜', selected: false },
          { name: '冬瓜', selected: false }, { name: '南瓜', selected: false }, { name: '菠菜', selected: false }, { name: '西兰花', selected: false },
          { name: '蘑菇', selected: false }, { name: '香菇', selected: false }, { name: '金针菇', selected: false }, { name: '杏鲍菇', selected: false }, { name: '木耳', selected: false }
        ]
      },
      {
        categoryName: '豆制品',
        ingredients: [
          { name: '豆腐', selected: false }, { name: '豆皮', selected: false }, { name: '腐竹', selected: false }, { name: '豆芽', selected: false }, { name: '油豆腐', selected: false }
        ]
      },
      {
        categoryName: '主食',
        ingredients: [
          { name: '面条', selected: false }, { name: '米饭', selected: false }, { name: '米粉', selected: false }, { name: '年糕', selected: false },
          { name: '饺子', selected: false }, { name: '馒头', selected: false }
        ]
      }
    ]
    const dishTypeNames = ['炒菜', '汤', '凉菜', '主食', '小吃']
    const typeNames = ['家常菜', '健身餐', '儿童营养餐', '川菜', '粤菜', '鲁菜', '苏菜', '浙菜', '闽菜', '湘菜', '徽菜', '东北菜', '西北菜', '日式料理', '韩式料理', '西餐', '东南亚风味']
    const methodNames = ['红烧', '清蒸', '炖', '煎', '炒', '烤', '凉拌']

    this.setData({
      categorizedIngredients,
      dishTypeNames,
      typeNames,
      methodNames,
      selectedIngredientNames: []
    }, () => {
      this.refreshSelectionSummary()
    })
  },

  buildSelectedSummaryItems(state) {
    const ingredientItems = state.selectedIngredientNames.map((name, index) => ({
      id: `ingredient-${index}-${name}`,
      label: name,
      prefix: '',
      kind: 'ingredient'
    }))
    const metaItems = []

    if (state.selectedDishTypeName) {
      metaItems.push({
        id: 'dishType',
        label: state.selectedDishTypeName,
        prefix: '类型',
        kind: 'meta'
      })
    }

    if (state.selectedTypeName) {
      metaItems.push({
        id: 'type',
        label: state.selectedTypeName,
        prefix: '菜系',
        kind: 'meta'
      })
    }

    if (state.selectedMethodName) {
      metaItems.push({
        id: 'method',
        label: state.selectedMethodName,
        prefix: '做法',
        kind: 'meta'
      })
    }

    return ingredientItems.concat(metaItems)
  },

  refreshSelectionSummary(extraState = {}) {
    const snapshot = { ...this.data, ...extraState }
    const selectedSummaryItems = this.buildSelectedSummaryItems(snapshot)
    const matchedPreset = QUICK_SCENES.find((scene) =>
      snapshot.selectedDishTypeIndex === scene.dishTypeIndex &&
      snapshot.selectedTypeIndex === scene.typeIndex &&
      snapshot.selectedMethodIndex === scene.methodIndex
    )

    this.setData({
      selectedSummaryItems,
      selectionCount: selectedSummaryItems.length,
      selectedMetaCount: [
        snapshot.selectedDishTypeName,
        snapshot.selectedTypeName,
        snapshot.selectedMethodName
      ].filter(Boolean).length,
      activePresetKey: matchedPreset ? matchedPreset.key : ''
    })
  },

  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ activeTab: index })
  },

  onApplyPreset(e) {
    const { key } = e.currentTarget.dataset
    const preset = QUICK_SCENES.find((item) => item.key === key)

    if (!preset) {
      return
    }

    const nextData = {
      activeTab: 0,
      selectedDishTypeIndex: preset.dishTypeIndex,
      selectedDishTypeName: this.data.dishTypeNames[preset.dishTypeIndex] || '',
      selectedTypeIndex: preset.typeIndex,
      selectedTypeName: this.data.typeNames[preset.typeIndex] || '',
      selectedMethodIndex: preset.methodIndex,
      selectedMethodName: this.data.methodNames[preset.methodIndex] || ''
    }

    this.setData(nextData, () => {
      this.refreshSelectionSummary()
      wx.showToast({
        title: `${preset.label}已应用`,
        icon: 'none'
      })
    })
  },

  onIngredientTagTap(e) {
    const { categoryIndex, ingredientIndex } = e.currentTarget.dataset
    const categorizedIngredients = this.data.categorizedIngredients
    const ingredient = categorizedIngredients[categoryIndex].ingredients[ingredientIndex]

    ingredient.selected = !ingredient.selected

    const selectedNames = categorizedIngredients
      .flatMap((category) => category.ingredients)
      .filter((selectedIngredient) => selectedIngredient.selected)
      .map((selectedIngredient) => selectedIngredient.name)

    this.setData({
      categorizedIngredients,
      selectedIngredientNames: selectedNames
    }, () => {
      this.refreshSelectionSummary()
    })
  },

  onDishTypeTagTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const nextData = this.data.selectedDishTypeIndex === index ? {
      selectedDishTypeIndex: null,
      selectedDishTypeName: ''
    } : {
      selectedDishTypeIndex: index,
      selectedDishTypeName: this.data.dishTypeNames[index]
    }

    this.setData(nextData, () => {
      this.refreshSelectionSummary()
    })
  },

  onTypeTagTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const nextData = this.data.selectedTypeIndex === index ? {
      selectedTypeIndex: null,
      selectedTypeName: ''
    } : {
      selectedTypeIndex: index,
      selectedTypeName: this.data.typeNames[index]
    }

    this.setData(nextData, () => {
      this.refreshSelectionSummary()
    })
  },

  onMethodTagTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const nextData = this.data.selectedMethodIndex === index ? {
      selectedMethodIndex: null,
      selectedMethodName: ''
    } : {
      selectedMethodIndex: index,
      selectedMethodName: this.data.methodNames[index]
    }

    this.setData(nextData, () => {
      this.refreshSelectionSummary()
    })
  },

  onGenerateRecipe() {
    if (this.generateRequestLocked || this.data.isLoading) {
      return
    }

    this.generateRequestLocked = true
    this.setData({ isLoading: true })

    const params = this.buildGenerateParams()
    this.generateRecipeWithParams(params).catch((error) => {
      if (!error || error.message !== '用户取消登录') {
        console.error('生成菜谱失败:', error)
      }
    }).finally(() => {
      this.generateRequestLocked = false
      this.setData({ isLoading: false })
    })
  },

  buildGenerateParams() {
    const {
      categorizedIngredients,
      selectedIngredientNames,
      selectedTypeIndex,
      selectedTypeName,
      selectedMethodIndex,
      selectedMethodName,
      selectedDishTypeIndex,
      selectedDishTypeName
    } = this.data

    const main = selectedIngredientNames.length > 0
      ? selectedIngredientNames.join('、')
      : this.getRandomIngredientName(categorizedIngredients)

    const type = selectedTypeIndex !== null && selectedTypeIndex !== undefined
      ? selectedTypeName
      : '家常菜'

    const method = selectedMethodIndex !== null && selectedMethodIndex !== undefined
      ? selectedMethodName
      : ''

    const dishType = selectedDishTypeIndex !== null && selectedDishTypeIndex !== undefined
      ? selectedDishTypeName
      : ''

    return { main, type, method, dishType }
  },

  getRandomIngredientName(categorizedIngredients) {
    const allIngredientNames = categorizedIngredients.flatMap((category) =>
      category.ingredients.map((ingredient) => ingredient.name)
    )
    const randIdx = Math.floor(Math.random() * allIngredientNames.length)
    return allIngredientNames[randIdx]
  },

  loadRecentRecipes() {
    const history = wx.getStorageSync('history') || []
    const take = history.slice(0, 3)
    const favorites = app.globalData.favorites || []
    const enriched = take.map((recipe) => ({
      ...recipe,
      isFavorited: app.isRecipeFavorited
        ? app.isRecipeFavorited(recipe.id)
        : favorites.some((favorite) => String(favorite.id) === String(recipe.id))
    }))

    this.setData({ recentRecipes: enriched })
  },

  deleteRecent(e) {
    const idx = Number(e.currentTarget.dataset.index)
    const history = wx.getStorageSync('history') || []
    const toDelete = this.data.recentRecipes[idx]
    let newHistory = history

    if (toDelete && toDelete.id) {
      newHistory = history.filter((recipe) => String(recipe.id) !== String(toDelete.id))
    } else {
      newHistory.splice(idx, 1)
    }

    wx.setStorageSync('history', newHistory)
    this.loadRecentRecipes()
    wx.showToast({
      title: '已删除',
      icon: 'success'
    })
  },

  generateRecipeWithParams(params) {
    const currentApp = getApp()

    return currentApp.checkLoginAndShowModal().then(() => {
      return currentApp.checkUserLimits()
    }).then((limits) => {
      this.applyUserLimits(limits)

      if (Number(limits.daily_generation_count || 0) >= Number(limits.daily_generation_limit || 0)) {
        wx.showModal({
          title: '生成次数已达上限',
          content: `今日已生成 ${limits.daily_generation_count} 次菜谱，每日限制 ${limits.daily_generation_limit} 次。明天再来吧！`,
          showCancel: false
        })
        return Promise.reject(new Error('生成次数已达上限'))
      }

      const requestData = this.buildRecipeRequestData(params)
      return this.requestGeneratedRecipe(currentApp, requestData)
    })
  },

  buildRecipeRequestData(params) {
    const randomSeed = Math.floor(Math.random() * 1000000)
    let prompt = `请用${params.main}为食材，`

    if (params.method) {
      prompt += `采用${params.method}的方式，`
    }

    prompt += '做一道'

    if (params.dishType) {
      prompt += `属于"${params.dishType}"的`
    }

    prompt += `${params.type}。你收到的随机数是：${randomSeed}，请基于它生成不一样的搭配。严格要求：
1) ingredients 为数组，数组中“每一项”必须是 { name, amount, nutrition_per_100g }，其中 nutrition_per_100g = { calories, protein, fat, carbohydrates }（单位：千卡/g/g/g，按每100g或每100ml）；
2) amount 仅允许 g 或 ml（示例："150g"、"200ml"），严禁出现“个/勺/适量/约xxg”等文字；
3) 顶层对象不要返回 nutrition 或 nutrition_per_100g，只在每个食材项内提供 nutrition_per_100g；
4) 若某项难以给出，请依据常识合理估算，切勿省略字段；
5) 仅返回纯 JSON（name/description/ingredients/steps/tips/tags）。`

    return {
      prompt,
      system: '你是一个专业的中国菜谱生成助手，请严格按照JSON格式返回菜谱信息。请以JSON格式返回，包含以下字段:name(菜名), description(描述), ingredients(食材数组，包含name和amount), steps(步骤数组), tips(烹饪技巧), tags(标签数组)。'
    }
  },

  requestGeneratedRecipe(currentApp, requestData) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: currentApp.globalData.serverUrl + '/api/ai',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: requestData,
        success: (res) => {
          if (res.statusCode !== 200) {
            wx.showToast({
              title: (res.data && res.data.error) || '生成失败，请重试',
              icon: 'none'
            })
            reject(new Error((res.data && res.data.error) || '生成失败，请重试'))
            return
          }

          const content = this.extractRecipeContent(res)
          if (!content) {
            wx.showToast({
              title: '生成失败，请重试',
              icon: 'none'
            })
            reject(new Error('生成失败，请重试'))
            return
          }

          const recipe = this.parseRecipeResponse(content)

          if (!recipe || !recipe.name || !Array.isArray(recipe.steps) || recipe.steps.length === 0) {
            wx.showToast({
              title: '生成失败，请重试',
              icon: 'none'
            })
            reject(new Error('生成失败，请重试'))
            return
          }

          currentApp.incrementGenerationCount().catch((error) => {
            console.error('增加生成次数失败:', error)
          }).finally(() => {
            this.saveToHistory(recipe)
            this.navigateToGeneratedRecipe(recipe)
            resolve(recipe)
          })
        },
        fail: () => {
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none'
          })
          reject(new Error('网络错误，请重试'))
        }
      })
    })
  },

  extractRecipeContent(res) {
    if (res.data && res.data.result && res.data.result.choices && res.data.result.choices[0] && res.data.result.choices[0].message) {
      return res.data.result.choices[0].message.content
    }

    if (res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message) {
      return res.data.choices[0].message.content
    }

    if (res.data && res.data.result && res.data.result.content) {
      return res.data.result.content
    }

    return ''
  },

  navigateToGeneratedRecipe(recipe) {
    wx.navigateTo({
      url: `/pages/recipe/recipe?recipe=${encodeURIComponent(JSON.stringify(recipe))}`
    })
  },

  parseRecipeResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const recipe = JSON.parse(jsonMatch[0])
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
          recipe.ingredients = recipe.ingredients.map((item) => ({
            ...item,
            nutrition_per_100g: item.nutrition_per_100g || item.nutrition || item.nutritionPer100g || {}
          }))
        }
        if (recipe.name && recipe.ingredients && recipe.steps) {
          return {
            ...recipe,
            id: Date.now().toString(),
            createTime: new Date().toISOString(),
            nutrition: recipe.nutrition || {
              calories: 0,
              protein: 0,
              fat: 0,
              carbs: 0
            },
            tags: recipe.tags || [],
            tips: recipe.tips || ''
          }
        }
      }
      return this.parseRecipeText(content)
    } catch (error) {
      return this.parseRecipeText(content)
    }
  },

  parseRecipeText(content) {
    const lines = content.split('\n').filter((line) => line.trim())
    const recipe = {
      id: Date.now().toString(),
      createTime: new Date().toISOString(),
      name: 'AI生成菜谱',
      description: '',
      ingredients: [],
      steps: [],
      nutrition: {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0
      },
      tags: [],
      tips: ''
    }
    let currentSection = ''

    for (let line of lines) {
      line = line.trim()
      if (line.includes('食材') || line.includes('原料')) {
        currentSection = 'ingredients'
      } else if (line.includes('步骤') || line.includes('做法')) {
        currentSection = 'steps'
      } else if (line.includes('营养') || line.includes('热量')) {
        currentSection = 'nutrition'
      } else if (line.includes('技巧') || line.includes('注意')) {
        currentSection = 'tips'
      } else if (line && currentSection === 'ingredients') {
        recipe.ingredients.push({
          name: line.replace(/^\d+\.\s*/, ''),
          amount: '适量'
        })
      } else if (line && currentSection === 'steps') {
        recipe.steps.push(line.replace(/^\d+\.\s*/, ''))
      } else if (line && currentSection === 'tips') {
        recipe.tips += `${line}\n`
      }
    }

    return recipe
  },

  saveToHistory(recipe) {
    const history = wx.getStorageSync('history') || []
    history.unshift(recipe)
    if (history.length > 20) {
      history.splice(20)
    }
    wx.setStorageSync('history', history)
  },

  viewRecipe(e) {
    const recipe = e.currentTarget.dataset.recipe
    wx.navigateTo({
      url: `/pages/recipe/recipe?recipe=${encodeURIComponent(JSON.stringify(recipe))}`
    })
  },

  onIngredientCategoryTabChange(e) {
    this.setData({
      activeIngredientCategoryTab: Number(e.currentTarget.dataset.index)
    })
  },

  onClearAllSelections() {
    const categorizedIngredients = this.data.categorizedIngredients.map((category) => ({
      ...category,
      ingredients: category.ingredients.map((ingredient) => ({ ...ingredient, selected: false }))
    }))

    this.setData({
      categorizedIngredients,
      selectedIngredientNames: [],
      selectedDishTypeIndex: null,
      selectedDishTypeName: '',
      selectedTypeIndex: null,
      selectedTypeName: '',
      selectedMethodIndex: null,
      selectedMethodName: ''
    }, () => {
      this.refreshSelectionSummary()
    })
  },

  onShowAddCustomInput(e) {
    const type = e.currentTarget.dataset.type
    const config = CUSTOM_INPUT_CONFIG[type] || {
      title: '添加自定义选项',
      placeholder: '请输入内容'
    }

    this.setData({
      showAddCustomInput: true,
      addCustomType: type,
      addCustomValue: '',
      customInputTitle: config.title,
      customInputPlaceholder: config.placeholder
    })
  },

  onAddCustomInput(e) {
    this.setData({
      addCustomValue: e.detail.value
    })
  },

  onAddCustomConfirm() {
    const {
      addCustomType,
      addCustomValue,
      categorizedIngredients,
      activeIngredientCategoryTab,
      dishTypeNames,
      typeNames,
      methodNames
    } = this.data
    const value = addCustomValue.trim()

    if (!value) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      })
      return
    }

    if (addCustomType === 'ingredient') {
      const newIngredients = [...categorizedIngredients]
      newIngredients[activeIngredientCategoryTab].ingredients.push({
        name: value,
        selected: false
      })
      this.setData({
        categorizedIngredients: newIngredients,
        showAddCustomInput: false,
        addCustomValue: ''
      })
    } else if (addCustomType === 'dishType') {
      this.setData({
        dishTypeNames: [...dishTypeNames, value],
        showAddCustomInput: false,
        addCustomValue: ''
      })
    } else if (addCustomType === 'type') {
      this.setData({
        typeNames: [...typeNames, value],
        showAddCustomInput: false,
        addCustomValue: ''
      })
    } else if (addCustomType === 'method') {
      this.setData({
        methodNames: [...methodNames, value],
        showAddCustomInput: false,
        addCustomValue: ''
      })
    }
  },

  onAddCustomCancel() {
    this.setData({
      showAddCustomInput: false,
      addCustomValue: ''
    })
  },

  onModalContentTap() {},

  onGoToFoodNutrition() {
    wx.navigateTo({
      url: '/pages/ingredients/ingredients'
    })
  }
})
