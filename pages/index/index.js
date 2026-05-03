const app = getApp()

const TASTE_NAMES = ['清淡', '开胃', '下饭', '解馋', '暖胃']
const KITCHEN_ENVIRONMENT_NAMES = ['炒锅', '平底锅', '汤锅/炖锅', '蒸锅', '电饭煲', '砂锅', '烤箱', '空气炸锅', '微波炉']
const METHOD_KITCHEN_REQUIREMENTS = {
  清蒸: ['蒸锅'],
  炖: ['汤锅/炖锅', '砂锅', '电饭煲'],
  煎: ['平底锅', '炒锅'],
  炒: ['炒锅', '平底锅'],
  红烧: ['炒锅', '汤锅/炖锅', '砂锅'],
  烤: ['烤箱', '空气炸锅'],
  凉拌: []
}
const AUTO_FILL_LABELS = {
  dishType: '菜品类型',
  cuisine: '菜系风格',
  taste: '口味',
  method: '烹饪方式',
  kitchenEnvironment: '厨房环境'
}
const SUPPORTING_INGREDIENTS = ['葱', '姜', '蒜', '鸡蛋', '青椒', '洋葱', '番茄', '淀粉']
const BASIC_SEASONINGS = ['食用油', '盐', '糖', '生抽', '老抽', '料酒', '醋', '蚝油', '胡椒']

const RECIPE_MODES = [
  {
    key: 'home',
    label: '家常',
    desc: '稳妥经典，优先好做'
  },
  {
    key: 'creative',
    label: '创意',
    desc: '轻巧新颖，但不离谱'
  }
]

const RECIPE_MODE_CONFIG = {
  home: {
    label: '家常',
    stickyLabel: '家常模式',
    emptyStickySummary: '还没选主料，AI 会按家常路线补全。',
    autoFillLogicText: '普通家庭厨房逻辑',
    systemInstruction: '请优先生成普通家庭真能做、步骤能照着做的菜谱，不要写得像餐厅菜单或创意料理。',
    autoFillRule: '5. 如果只选了部分维度，未选项要自动补成最自然、最家常、最能做成的组合，不是随机乱发挥。',
    executionRule: '8. 成品必须符合普通家庭可执行标准：食材数量控制在家常范围，步骤数量控制在 4 到 7 步左右，避免过度复杂。',
    extraRules: [],
    temperature: 0.66
  },
  creative: {
    label: '创意',
    stickyLabel: '创意模式',
    emptyStickySummary: '还没选主料，AI 会按轻创意路线补全。',
    autoFillLogicText: '家庭厨房里的轻创意逻辑',
    systemInstruction: '请生成在普通家庭厨房里真正能做成、但比常规答案更有新意的菜谱。允许轻创意，但不要写得像餐厅菜单、网红摆盘菜或华而不实的创意料理。',
    autoFillRule: '5. 如果只选了部分维度，未选项要自动补成合理顺口、带一点新意但依然家常可做的组合，不是随机乱发挥。',
    executionRule: '8. 成品必须符合普通家庭可执行标准：食材数量控制在家常范围，步骤数量控制在 4 到 7 步左右，避免过度复杂；新意优先落在搭配、调味结构、口感层次、切配形式或收汁方式里，最多体现 1 到 2 个创意点。',
    extraRules: [
      '11. 创意必须是轻创意：尽量避开最常见的标准答案，但不要为了新而新。',
      '12. 不允许写成餐厅菜单、分子料理、网红摆盘菜，或堆砌很多额外主菜食材的版本。'
    ],
    temperature: 0.82
  }
}

function getRecipeModeConfig(modeKey = 'home') {
  return RECIPE_MODE_CONFIG[modeKey] || RECIPE_MODE_CONFIG.home
}

function createEmptyNutrition() {
  return {
    calories: 0,
    protein: 0,
    fat: 0,
    carbohydrates: 0,
    carbs: 0
  }
}

function parseNumericValue(value) {
  if (typeof value === 'number') {
    return value
  }

  if (value === null || value === undefined || value === '') {
    return 0
  }

  const match = String(value).match(/-?\d+(\.\d+)?/)
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
  const empty = createEmptyNutrition()
  if (!source || typeof source !== 'object') {
    return empty
  }

  const calories = Number(source.calories || 0)
  const protein = parseNumericValue(source.protein)
  const fat = parseNumericValue(source.fat)
  const carbohydrates = parseNumericValue(source.carbohydrates ?? source.carbs)

  return {
    calories: Number.isFinite(calories) ? calories : parseNumericValue(source.calories),
    protein: Number.isFinite(protein) ? protein : 0,
    fat: Number.isFinite(fat) ? fat : 0,
    carbohydrates: Number.isFinite(carbohydrates) ? carbohydrates : 0,
    carbs: Number.isFinite(carbohydrates) ? carbohydrates : 0
  }
}

function normalizeIngredientItem(item = {}, index = 0) {
  const parsedAmount = parseAmount(item.amount)
  const amountValue = item.weight !== undefined && item.weight !== null && item.weight !== '' && !Number.isNaN(Number(item.weight))
    ? Number(item.weight)
    : parsedAmount.value
  const basisUnit = normalizeUnit(
    item.nutrition_basis_unit || item.nutritionBasisUnit || parsedAmount.unit || 'g',
    parsedAmount.unit || 'g'
  )
  const unitNormalized = normalizeUnit(item.unitNormalized || item.unit || parsedAmount.unit || basisUnit, basisUnit)
  const nutritionPer100 = normalizeNutritionInfo(
    item.nutrition_per_100 || item.nutritionPer100 || item.nutrition_per_100g || item.nutrition
  )
  const amount = amountValue !== null && amountValue !== undefined && amountValue !== ''
    ? `${amountValue}${unitNormalized}`
    : String(item.amount || '').trim()

  return {
    ...item,
    name: item.name || `食材${index + 1}`,
    amount,
    weight: amountValue !== null && amountValue !== undefined ? amountValue : '',
    unit: unitNormalized,
    unitNormalized,
    nutrition_per_100: nutritionPer100,
    nutrition_basis_unit: basisUnit,
    nutritionInfo: nutritionPer100
  }
}

function calculateRecipeNutritionFromIngredients(ingredients = []) {
  let totalCalories = 0
  let totalProtein = 0
  let totalFat = 0
  let totalCarbs = 0

  ingredients.forEach((item = {}) => {
    const parsedAmount = parseAmount(item.amount)
    const amountValue = item.weight !== undefined && item.weight !== null && item.weight !== '' && !Number.isNaN(Number(item.weight))
      ? Number(item.weight)
      : parsedAmount.value

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return
    }

    const basisUnit = normalizeUnit(
      item.nutrition_basis_unit || item.nutritionBasisUnit || parsedAmount.unit || 'g',
      parsedAmount.unit || 'g'
    )
    const amountUnit = normalizeUnit(
      item.unitNormalized || item.unit || parsedAmount.unit || basisUnit,
      basisUnit
    )

    if (amountUnit !== basisUnit) {
      return
    }

    const nutritionPer100 = normalizeNutritionInfo(
      item.nutrition_per_100 || item.nutritionPer100 || item.nutrition_per_100g || item.nutritionInfo || item.nutrition
    )
    const ratio = amountValue / 100

    totalCalories += ratio * parseNumericValue(nutritionPer100.calories)
    totalProtein += ratio * parseNumericValue(nutritionPer100.protein)
    totalFat += ratio * parseNumericValue(nutritionPer100.fat)
    totalCarbs += ratio * parseNumericValue(nutritionPer100.carbohydrates ?? nutritionPer100.carbs)
  })

  const roundedCarbs = Math.round(totalCarbs * 10) / 10

  return {
    calories: Math.round(totalCalories),
    protein: Math.round(totalProtein * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
    carbs: roundedCarbs,
    carbohydrates: roundedCarbs
  }
}

function normalizeRecipePayload(recipe = {}) {
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((item, index) => normalizeIngredientItem(item, index))
    : []
  const nutrition = recipe.nutrition || recipe.nutrition_total || {}
  const normalizedNutrition = {
    calories: parseNumericValue(nutrition.calories),
    protein: parseNumericValue(nutrition.protein),
    fat: parseNumericValue(nutrition.fat),
    carbs: parseNumericValue(nutrition.carbs ?? nutrition.carbohydrates)
  }
  const calculatedNutrition = calculateRecipeNutritionFromIngredients(ingredients)
  const mergedNutrition = {
    calories: normalizedNutrition.calories > 0 ? normalizedNutrition.calories : calculatedNutrition.calories,
    protein: normalizedNutrition.protein > 0 ? normalizedNutrition.protein : calculatedNutrition.protein,
    fat: normalizedNutrition.fat > 0 ? normalizedNutrition.fat : calculatedNutrition.fat,
    carbs: normalizedNutrition.carbs > 0 ? normalizedNutrition.carbs : calculatedNutrition.carbs
  }

  return {
    ...recipe,
    id: recipe.id || Date.now().toString(),
    createTime: recipe.createTime || new Date().toISOString(),
    description: recipe.description || '',
    ingredients,
    steps: Array.isArray(recipe.steps)
      ? recipe.steps.map((step) => String(step || '').trim()).filter(Boolean)
      : [],
    nutrition: mergedNutrition,
    tags: Array.isArray(recipe.tags) ? recipe.tags.filter(Boolean) : [],
    tips: recipe.tips || ''
  }
}

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
    note: '不选也可以，AI 会按最自然的家常路线自动补全'
  },
  {
    key: 'taste',
    label: '口味',
    desc: '给成菜定下清淡、开胃或暖胃方向',
    eyebrow: 'TASTE',
    panelTitle: '补上入口风味',
    note: '口味只控制风味，不会盖过主料本身'
  },
  {
    key: 'method',
    label: '烹饪方式',
    desc: '决定它更像一份清蒸、红烧或凉拌',
    eyebrow: 'METHOD',
    panelTitle: '补上做法偏好',
    note: '当你已经想好做法时，这一步最省时间'
  },
  {
    key: 'kitchenEnvironment',
    label: '厨房环境',
    desc: '多选你手头有的锅具设备，避开做不到的方案',
    eyebrow: 'KITCHEN',
    panelTitle: '限定可用设备',
    note: '不选时默认按普通家庭厨房自动补全，优先灶台路线'
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
    methodIndex: 4,
    tasteIndex: 2
  },
  {
    key: 'fit-light',
    kicker: '轻',
    label: '轻盈健身',
    desc: '炒菜 + 健身餐 + 清蒸',
    dishTypeIndex: 0,
    typeIndex: 1,
    methodIndex: 1,
    tasteIndex: 0
  },
  {
    key: 'warm-soup',
    kicker: '汤',
    label: '暖胃热汤',
    desc: '汤 + 家常菜 + 炖',
    dishTypeIndex: 1,
    typeIndex: 0,
    methodIndex: 2,
    tasteIndex: 4
  },
  {
    key: 'weekend-snack',
    kicker: '馋',
    label: '周末解馋',
    desc: '小吃 + 家常菜 + 烤',
    dishTypeIndex: 4,
    typeIndex: 0,
    methodIndex: 5,
    tasteIndex: 3
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
    tasteNames: TASTE_NAMES,
    kitchenEnvironmentNames: KITCHEN_ENVIRONMENT_NAMES,
    kitchenEnvironmentOptions: [],
    tabOptions: TAB_OPTIONS,
    quickScenes: QUICK_SCENES,
    recipeModes: RECIPE_MODES,
    selectedRecipeMode: 'home',
    activeTab: 0,
    selectedIngredientNames: [],
    selectedTypeIndex: null,
    selectedTypeName: '',
    selectedMethodIndex: null,
    selectedMethodName: '',
    selectedDishTypeIndex: null,
    selectedDishTypeName: '',
    selectedTasteIndex: null,
    selectedTasteName: '',
    selectedKitchenEnvironmentIndexes: [],
    selectedKitchenEnvironmentNames: [],
    selectedSummaryItems: [],
    selectionCount: 0,
    selectedMetaCount: 0,
    stickyGenerateSummaryText: '还没选主料，AI 会按普通家庭厨房路线补全。',
    autoFillSummaryText: '',
    methodKitchenConflictMessage: '',
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
    this.updateLoginStatus()
  },

  onShow() {
    app.syncTabBar(this)
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
    const cachedLimits = isLoggedIn
      ? (currentApp.globalData.userLimits || wx.getStorageSync('userLimits') || null)
      : null

    if (cachedLimits) {
      this.setData({ isLoggedIn })
      this.applyUserLimits(cachedLimits)
    } else {
      this.setData({
        isLoggedIn,
        userLimits: null,
        remainingGenerationCount: null
      })
    }

    if (isLoggedIn) {
      currentApp.checkUserLimits().then((limits) => {
        this.applyUserLimits(limits)
      }).catch((error) => {
        console.error('获取用户限制失败:', error)
        const fallbackLimits = currentApp.globalData.userLimits || wx.getStorageSync('userLimits')
        if (fallbackLimits) {
          this.applyUserLimits(fallbackLimits)
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
          { name: '嫩豆腐', selected: false },{ name: '老豆腐', selected: false },  { name: '豆皮', selected: false }, { name: '腐竹', selected: false }, { name: '豆芽', selected: false }, { name: '油豆腐', selected: false }
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
    const kitchenEnvironmentOptions = KITCHEN_ENVIRONMENT_NAMES.map((name) => ({
      name,
      selected: false
    }))

    this.setData({
      categorizedIngredients,
      dishTypeNames,
      typeNames,
      methodNames,
      tasteNames: TASTE_NAMES,
      kitchenEnvironmentNames: KITCHEN_ENVIRONMENT_NAMES,
      kitchenEnvironmentOptions,
      selectedIngredientNames: []
    }, () => {
      this.refreshSelectionSummary()
    })
  },

  getAutoFillSummaryText(state) {
    const autoFillFields = []

    if (!state.selectedDishTypeName) {
      autoFillFields.push(AUTO_FILL_LABELS.dishType)
    }
    if (!state.selectedTypeName) {
      autoFillFields.push(AUTO_FILL_LABELS.cuisine)
    }
    if (!state.selectedTasteName) {
      autoFillFields.push(AUTO_FILL_LABELS.taste)
    }
    if (!state.selectedMethodName) {
      autoFillFields.push(AUTO_FILL_LABELS.method)
    }
    if (!state.selectedKitchenEnvironmentNames.length) {
      autoFillFields.push(AUTO_FILL_LABELS.kitchenEnvironment)
    }

    if (!autoFillFields.length) {
      return '约束已经足够完整，AI 会优先贴合你的设定来生成。'
    }

    return `未选的 ${autoFillFields.join(' / ')} 会由 AI 按普通家庭厨房逻辑自动补全。`
  },

  getStickyGenerateSummaryText(state) {
    const ingredientCount = Array.isArray(state.selectedIngredientNames) ? state.selectedIngredientNames.length : 0
    const metaCount = Array.isArray(state.selectedSummaryItems)
      ? state.selectedSummaryItems.filter((item) => item.kind === 'meta').length
      : 0

    if (ingredientCount > 0) {
      return `已选 ${ingredientCount} 个食材 / ${metaCount} 项约束`
    }

    if (metaCount > 0) {
      return `还没选主料，已加 ${metaCount} 项约束`
    }

    return '还没选主料，AI 会按普通家庭厨房路线补全'
  },

  getModeAwareAutoFillSummaryText(state) {
    const modeConfig = getRecipeModeConfig(state.selectedRecipeMode)
    const autoFillFields = []

    if (!state.selectedDishTypeName) {
      autoFillFields.push(AUTO_FILL_LABELS.dishType)
    }
    if (!state.selectedTypeName) {
      autoFillFields.push(AUTO_FILL_LABELS.cuisine)
    }
    if (!state.selectedTasteName) {
      autoFillFields.push(AUTO_FILL_LABELS.taste)
    }
    if (!state.selectedMethodName) {
      autoFillFields.push(AUTO_FILL_LABELS.method)
    }
    if (!state.selectedKitchenEnvironmentNames.length) {
      autoFillFields.push(AUTO_FILL_LABELS.kitchenEnvironment)
    }

    if (!autoFillFields.length) {
      return `约束已经足够完整，AI 会优先按${modeConfig.stickyLabel}贴合你的设定来生成。`
    }

    return `未选的 ${autoFillFields.join(' / ')} 会由 AI 按${modeConfig.autoFillLogicText}自动补全。`
  },

  getModeAwareStickyGenerateSummaryText(state) {
    const modeConfig = getRecipeModeConfig(state.selectedRecipeMode)
    const ingredientCount = Array.isArray(state.selectedIngredientNames) ? state.selectedIngredientNames.length : 0
    const metaCount = Array.isArray(state.selectedSummaryItems)
      ? state.selectedSummaryItems.filter((item) => item.kind === 'meta').length
      : 0

    if (ingredientCount > 0) {
      return `已选 ${ingredientCount} 个食材 / ${metaCount} 项约束 · ${modeConfig.stickyLabel}`
    }

    if (metaCount > 0) {
      return `还没选主料，已加 ${metaCount} 项约束 · ${modeConfig.stickyLabel}`
    }

    return modeConfig.emptyStickySummary
  },

  getMethodKitchenConflictMessage(methodName, kitchenEnvironmentNames = []) {
    if (!methodName || !kitchenEnvironmentNames.length) {
      return ''
    }

    const requiredEnvironments = METHOD_KITCHEN_REQUIREMENTS[methodName]
    if (!Array.isArray(requiredEnvironments) || !requiredEnvironments.length) {
      return ''
    }

    const hasSupportedEnvironment = requiredEnvironments.some((environmentName) =>
      kitchenEnvironmentNames.includes(environmentName)
    )

    if (hasSupportedEnvironment) {
      return ''
    }

    return `${methodName} 需要 ${requiredEnvironments.join(' 或 ')}，当前厨房环境不满足。`
  },

  buildSelectedSummaryItems(state) {
    const ingredientItems = state.selectedIngredientNames.map((name, index) => ({
      id: `ingredient-${index}-${name}`,
      label: name,
      prefix: '',
      kind: 'ingredient',
      removeKind: 'ingredient',
      removeValue: name
    }))
    const metaItems = []

    if (state.selectedDishTypeName) {
      metaItems.push({
        id: 'dishType',
        label: state.selectedDishTypeName,
        prefix: '类型',
        kind: 'meta',
        removeKind: 'single',
        removeField: 'dishType'
      })
    }

    if (state.selectedTypeName) {
      metaItems.push({
        id: 'type',
        label: state.selectedTypeName,
        prefix: '菜系',
        kind: 'meta',
        removeKind: 'single',
        removeField: 'type'
      })
    }

    if (state.selectedTasteName) {
      metaItems.push({
        id: 'taste',
        label: state.selectedTasteName,
        prefix: '口味',
        kind: 'meta',
        removeKind: 'single',
        removeField: 'taste'
      })
    }

    if (state.selectedMethodName) {
      metaItems.push({
        id: 'method',
        label: state.selectedMethodName,
        prefix: '做法',
        kind: 'meta',
        removeKind: 'single',
        removeField: 'method'
      })
    }

    if (Array.isArray(state.selectedKitchenEnvironmentNames)) {
      state.selectedKitchenEnvironmentNames.forEach((name, index) => {
        metaItems.push({
          id: `kitchen-${index}-${name}`,
          label: name,
          prefix: '设备',
          kind: 'meta',
          removeKind: 'kitchen',
          removeValue: name
        })
      })
    }

    return ingredientItems.concat(metaItems)
  },

  refreshSelectionSummary(extraState = {}) {
    const snapshot = { ...this.data, ...extraState }
    const selectedSummaryItems = this.buildSelectedSummaryItems(snapshot)
    const methodKitchenConflictMessage = this.getMethodKitchenConflictMessage(
      snapshot.selectedMethodName,
      snapshot.selectedKitchenEnvironmentNames
    )
    const matchedPreset = QUICK_SCENES.find((scene) =>
      snapshot.selectedDishTypeIndex === scene.dishTypeIndex &&
      snapshot.selectedTypeIndex === scene.typeIndex &&
      snapshot.selectedMethodIndex === scene.methodIndex &&
      snapshot.selectedTasteIndex === scene.tasteIndex &&
      (!snapshot.selectedKitchenEnvironmentIndexes || snapshot.selectedKitchenEnvironmentIndexes.length === 0)
    )

    this.setData({
      selectedSummaryItems,
      selectionCount: selectedSummaryItems.length,
      selectedMetaCount: selectedSummaryItems.filter((item) => item.kind === 'meta').length,
      stickyGenerateSummaryText: this.getModeAwareStickyGenerateSummaryText({
        ...snapshot,
        selectedSummaryItems
      }),
      activePresetKey: matchedPreset ? matchedPreset.key : '',
      autoFillSummaryText: this.getModeAwareAutoFillSummaryText(snapshot),
      methodKitchenConflictMessage
    })
  },

  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ activeTab: index })
  },

  onRecipeModeChange(e) {
    const { key } = e.currentTarget.dataset

    if (!key || key === this.data.selectedRecipeMode) {
      return
    }

    this.setData({
      selectedRecipeMode: key
    }, () => {
      this.refreshSelectionSummary()
    })
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
      selectedTasteIndex: preset.tasteIndex,
      selectedTasteName: this.data.tasteNames[preset.tasteIndex] || '',
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

  onTasteTagTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const nextData = this.data.selectedTasteIndex === index ? {
      selectedTasteIndex: null,
      selectedTasteName: ''
    } : {
      selectedTasteIndex: index,
      selectedTasteName: this.data.tasteNames[index]
    }

    this.setData(nextData, () => {
      this.refreshSelectionSummary()
    })
  },

  onKitchenEnvironmentTagTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const kitchenEnvironmentOptions = this.data.kitchenEnvironmentOptions.map((item, optionIndex) => (
      optionIndex === index
        ? { ...item, selected: !item.selected }
        : item
    ))
    const selectedKitchenEnvironmentIndexes = kitchenEnvironmentOptions
      .map((item, optionIndex) => (item.selected ? optionIndex : null))
      .filter((item) => item !== null)
    const selectedKitchenEnvironmentNames = kitchenEnvironmentOptions
      .filter((item) => item.selected)
      .map((item) => item.name)

    this.setData({
      kitchenEnvironmentOptions,
      selectedKitchenEnvironmentIndexes,
      selectedKitchenEnvironmentNames
    }, () => {
      this.refreshSelectionSummary()
    })
  },

  onGenerateRecipe() {
    if (this.generateRequestLocked || this.data.isLoading) {
      return
    }

    if (this.data.methodKitchenConflictMessage) {
      wx.showModal({
        title: '生成前需要调整',
        content: this.data.methodKitchenConflictMessage,
        showCancel: false
      })
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
      selectedIngredientNames,
      selectedTypeIndex,
      selectedTypeName,
      selectedTasteIndex,
      selectedTasteName,
      selectedMethodIndex,
      selectedMethodName,
      selectedDishTypeIndex,
      selectedDishTypeName,
      selectedKitchenEnvironmentNames
    } = this.data

    const mainIngredients = selectedIngredientNames.length > 0
      ? [...selectedIngredientNames]
      : []

    const method = selectedMethodIndex !== null && selectedMethodIndex !== undefined
      ? selectedMethodName
      : ''

    const dishType = selectedDishTypeIndex !== null && selectedDishTypeIndex !== undefined
      ? selectedDishTypeName
      : ''

    const cuisine = selectedTypeIndex !== null && selectedTypeIndex !== undefined
      ? selectedTypeName
      : ''

    const taste = selectedTasteIndex !== null && selectedTasteIndex !== undefined
      ? selectedTasteName
      : ''

    const autoFillDimensions = [
      !dishType && '菜品类型',
      !cuisine && '菜系风格',
      !taste && '口味',
      !method && '烹饪方式',
      !selectedKitchenEnvironmentNames.length && '厨房环境'
    ].filter(Boolean)

    return {
      mainIngredients,
      hasSelectedIngredients: mainIngredients.length > 0,
      recipeMode: this.data.selectedRecipeMode,
      dishType,
      cuisine,
      taste,
      method,
      kitchenEnvironment: [...selectedKitchenEnvironmentNames],
      autoFillDimensions
    }
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

      const requestData = this.buildRecipeRequestDataWithMode(params)
      return this.requestGeneratedRecipe(currentApp, requestData)
    })
  },

  buildRecipeRequestDataWithMode(params) {
    const modeConfig = getRecipeModeConfig(params.recipeMode)
    const randomSeed = Math.floor(Math.random() * 1000000)
    const selectedIngredientsText = params.hasSelectedIngredients
      ? params.mainIngredients.join('、')
      : '未指定，请先补一个最自然、普通家庭常见且与其它条件匹配的主料组合'
    const kitchenEnvironmentText = params.kitchenEnvironment.length
      ? params.kitchenEnvironment.join('、')
      : '未指定，按普通家庭厨房自动补全，优先灶台锅具路线'
    const autoFillText = params.autoFillDimensions.length
      ? params.autoFillDimensions.join('、')
      : '无，当前维度已完整指定'
    const systemPrompt = [
      '你是一位擅长中国家庭厨房的菜谱生成助手。',
      modeConfig.systemInstruction,
      '你必须只返回纯 JSON，不要 Markdown 代码块，不要解释文字，不要注释，不要额外顶层字段。',
      '顶层 JSON 只能包含：name、description、ingredients、steps、tips、tags。',
      'ingredients 必须是数组，且每一项都必须包含 name、amount、nutrition_per_100、nutrition_basis_unit。',
      'nutrition_per_100 必须是对象，包含 calories、protein、fat、carbohydrates 四个字段。',
      'nutrition_basis_unit 只能是 g 或 ml；amount 也只能使用 g 或 ml，例如 150g、200ml。',
      '不要返回顶层 nutrition，也不要再使用 nutrition_per_100g 作为新字段。'
    ].join('\n')
    const userPrompt = [
      '请按照以下任务生成一份家庭厨房菜谱：',
      `随机种子：${randomSeed}`,
      `生成模式：${modeConfig.label}`,
      `已选主料：${selectedIngredientsText}`,
      `菜品类型：${params.dishType || '自动补全为最自然的结果'}`,
      `菜系风格：${params.cuisine || '自动补全为最自然的结果'}`,
      `口味：${params.taste || '自动补全为最自然的结果'}`,
      `烹饪方式：${params.method || '自动补全为最自然的结果'}`,
      `厨房环境：${kitchenEnvironmentText}`,
      `未选维度：${autoFillText}`,
      '',
      '执行规则：',
      '1. 已选主料视为我手头现有的主料，必须尽量全部使用；如果天然不太搭，可以降为配角，但不能直接忽略。',
      `2. 允许补充常见辅料：${SUPPORTING_INGREDIENTS.join('、')}。`,
      `3. 允许补充基础调味：${BASIC_SEASONINGS.join('、')}。`,
      '4. 不允许额外补新的主菜级食材。',
      modeConfig.autoFillRule,
      '6. 如果厨房环境已指定，步骤中只能使用这些设备可完成的方案；如果有潜在冲突，也必须优先生成真正能做成的版本。',
      '7. 步骤必须写成家常做法，每步都要尽量包含关键动作，并至少体现火候、时间、状态变化中的一种。',
      modeConfig.executionRule,
      '9. 主料和关键辅料不要写“适量、少许、若干、约xxg、1个、2勺”这类不落地的量，必须给出明确的 g 或 ml。',
      '10. 如某个营养值难以精确给出，请按常识合理估算，但字段不能缺失。',
      ...modeConfig.extraRules,
      '',
      '返回格式要求：',
      'A. name 为字符串，像真人会起的家常菜名。',
      'B. description 为一句话，概括这道菜为什么适合当前主料与条件。',
      'C. ingredients 为数组，每项格式：{ "name": "...", "amount": "150g", "nutrition_per_100": { "calories": 0, "protein": 0, "fat": 0, "carbohydrates": 0 }, "nutrition_basis_unit": "g" }。',
      'D. steps 为字符串数组。',
      'E. tips 为字符串。',
      'F. tags 为短标签字符串数组。',
      'G. 除上述 JSON 外不要输出任何多余内容。'
    ].join('\n')

    return {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: modeConfig.temperature
    }
  },

  buildRecipeRequestData(params) {
    const randomSeed = Math.floor(Math.random() * 1000000)
    const selectedIngredientsText = params.hasSelectedIngredients
      ? params.mainIngredients.join('、')
      : '未指定，请先补一个最自然、普通家庭常见且与其它条件匹配的主料组合'
    const kitchenEnvironmentText = params.kitchenEnvironment.length
      ? params.kitchenEnvironment.join('、')
      : '未指定，按普通家庭厨房自动补全，优先灶台锅具路线'
    const autoFillText = params.autoFillDimensions.length
      ? params.autoFillDimensions.join('、')
      : '无，当前维度已完整指定'
    const systemPrompt = [
      '你是一位擅长中国家庭厨房的菜谱生成助手。',
      '请优先生成普通家庭真能做、步骤能照着做的菜谱，不要写得像餐厅菜单或创意料理。',
      '你必须只返回纯 JSON，不要 Markdown 代码块，不要解释文字，不要注释，不要额外顶层字段。',
      '顶层 JSON 只能包含：name、description、ingredients、steps、tips、tags。',
      'ingredients 必须是数组，且每一项都必须包含 name、amount、nutrition_per_100、nutrition_basis_unit。',
      'nutrition_per_100 必须是对象，包含 calories、protein、fat、carbohydrates 四个字段。',
      'nutrition_basis_unit 只能是 g 或 ml；amount 也只能使用 g 或 ml，例如 150g、200ml。',
      '不要返回顶层 nutrition，也不要再使用 nutrition_per_100g 作为新字段。'
    ].join('\n')
    const userPrompt = [
      '请按照以下任务生成一份家庭厨房菜谱：',
      `随机种子：${randomSeed}`,
      `已选主料：${selectedIngredientsText}`,
      `菜品类型：${params.dishType || '自动补全为最自然的结果'}`,
      `菜系风格：${params.cuisine || '自动补全为最自然的结果'}`,
      `口味：${params.taste || '自动补全为最自然的结果'}`,
      `烹饪方式：${params.method || '自动补全为最自然的结果'}`,
      `厨房环境：${kitchenEnvironmentText}`,
      `未选维度：${autoFillText}`,
      '',
      '执行规则：',
      '1. 已选主料视为我手头现有的主料，必须尽量全部使用；如果天然不太搭，可以降为配角，但不能直接忽略。',
      `2. 允许补充常见辅料：${SUPPORTING_INGREDIENTS.join('、')}。`,
      `3. 允许补充基础调味：${BASIC_SEASONINGS.join('、')}。`,
      '4. 不允许额外补新的主菜级食材。',
      '5. 如果只选了部分维度，未选项要自动补成最自然、最家常、最能做成的组合，不是随机乱发挥。',
      '6. 如果厨房环境已指定，步骤中只能使用这些设备可完成的方案；如果有潜在冲突，也必须优先生成真正能做成的版本。',
      '7. 步骤必须写成家常做法，每步都要尽量包含关键动作，并至少体现火候、时间、状态变化中的一种。',
      '8. 成品必须符合普通家庭可执行标准：食材数量控制在家常范围，步骤数量控制在 4 到 7 步左右，避免过度复杂。',
      '9. 主料和关键辅料不要写“适量、少许、若干、约xxg、1个、2勺”这类不落地的量，必须给出明确的 g 或 ml。',
      '10. 如某个营养值难以精确给出，请按常识合理估算，但字段不能缺失。',
      '',
      '返回格式要求：',
      'A. name 为字符串，像真人会起的家常菜名。',
      'B. description 为一句话，概括这道菜为什么适合当前主料与条件。',
      'C. ingredients 为数组，每项格式：{ "name": "...", "amount": "150g", "nutrition_per_100": { "calories": 0, "protein": 0, "fat": 0, "carbohydrates": 0 }, "nutrition_basis_unit": "g" }。',
      'D. steps 为字符串数组。',
      'E. tips 为字符串。',
      'F. tags 为短标签字符串数组。',
      'G. 除上述 JSON 外不要输出任何多余内容。'
    ].join('\n')

    return {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.65
    }
  },

  logRecipeRequestData(requestData) {
    try {
      const messages = Array.isArray(requestData.messages) ? requestData.messages : []
      const systemMessage = messages.find((item) => item.role === 'system')
      const userMessage = messages.find((item) => item.role === 'user')

      console.log('========== AI菜谱生成请求开始 ==========')
      if (systemMessage) {
        console.log('[AI菜谱生成][system]\n' + systemMessage.content)
      }
      if (userMessage) {
        console.log('[AI菜谱生成][user]\n' + userMessage.content)
      }
      console.log('[AI菜谱生成][payload]\n' + JSON.stringify(requestData, null, 2))
      console.log('========== AI菜谱生成请求结束 ==========')
    } catch (error) {
      console.error('打印AI菜谱提示词失败:', error)
    }
  },

  requestGeneratedRecipe(currentApp, requestData) {
    this.logRecipeRequestData(requestData)

    return new Promise((resolve, reject) => {
      wx.request({
        url: currentApp.globalData.serverUrl + '/api/ai',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        timeout: 130000,
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
        fail: (error) => {
          console.error('生成菜谱请求失败:', error)
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
        if (recipe.name && recipe.ingredients && recipe.steps) {
          return normalizeRecipePayload(recipe)
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
        const ingredientLine = line.replace(/^\d+\.\s*/, '')
        const amountMatch = ingredientLine.match(/(.+?)\s+(\d+(?:\.\d+)?\s*(?:g|ml))$/i)
        recipe.ingredients.push({
          name: amountMatch ? amountMatch[1].trim() : ingredientLine,
          amount: amountMatch ? amountMatch[2].replace(/\s+/g, '').toLowerCase() : '100g'
        })
      } else if (line && currentSection === 'steps') {
        recipe.steps.push(line.replace(/^\d+\.\s*/, ''))
      } else if (line && currentSection === 'tips') {
        recipe.tips += `${line}\n`
      }
    }

    return normalizeRecipePayload(recipe)
  },

  saveToHistory(recipe) {
    const normalizedRecipe = normalizeRecipePayload(recipe)
    if (app.upsertHistoryRecipe) {
      app.upsertHistoryRecipe(normalizedRecipe, { moveToTop: true })
      return
    }
    const history = wx.getStorageSync('history') || []
    history.unshift(normalizedRecipe)
    if (history.length > 20) {
      history.splice(20)
    }
    wx.setStorageSync('history', history)
  },

  onIngredientCategoryTabChange(e) {
    this.setData({
      activeIngredientCategoryTab: Number(e.currentTarget.dataset.index)
    })
  },

  onRemoveSummaryItem(e) {
    const { removeKind, removeField, removeValue } = e.currentTarget.dataset

    if (removeKind === 'ingredient') {
      const categorizedIngredients = this.data.categorizedIngredients.map((category) => ({
        ...category,
        ingredients: category.ingredients.map((ingredient) => (
          ingredient.name === removeValue
            ? { ...ingredient, selected: false }
            : ingredient
        ))
      }))
      const selectedIngredientNames = categorizedIngredients
        .flatMap((category) => category.ingredients)
        .filter((ingredient) => ingredient.selected)
        .map((ingredient) => ingredient.name)

      this.setData({
        categorizedIngredients,
        selectedIngredientNames
      }, () => {
        this.refreshSelectionSummary()
      })
      return
    }

    if (removeKind === 'kitchen') {
      const kitchenEnvironmentOptions = this.data.kitchenEnvironmentOptions.map((item) => (
        item.name === removeValue
          ? { ...item, selected: false }
          : item
      ))
      const selectedKitchenEnvironmentIndexes = kitchenEnvironmentOptions
        .map((item, index) => (item.selected ? index : null))
        .filter((item) => item !== null)
      const selectedKitchenEnvironmentNames = kitchenEnvironmentOptions
        .filter((item) => item.selected)
        .map((item) => item.name)

      this.setData({
        kitchenEnvironmentOptions,
        selectedKitchenEnvironmentIndexes,
        selectedKitchenEnvironmentNames
      }, () => {
        this.refreshSelectionSummary()
      })
      return
    }

    if (removeKind === 'single') {
      const nextData = {}

      if (removeField === 'dishType') {
        nextData.selectedDishTypeIndex = null
        nextData.selectedDishTypeName = ''
      } else if (removeField === 'type') {
        nextData.selectedTypeIndex = null
        nextData.selectedTypeName = ''
      } else if (removeField === 'taste') {
        nextData.selectedTasteIndex = null
        nextData.selectedTasteName = ''
      } else if (removeField === 'method') {
        nextData.selectedMethodIndex = null
        nextData.selectedMethodName = ''
      }

      this.setData(nextData, () => {
        this.refreshSelectionSummary()
      })
    }
  },

  onClearAllSelections() {
    const categorizedIngredients = this.data.categorizedIngredients.map((category) => ({
      ...category,
      ingredients: category.ingredients.map((ingredient) => ({ ...ingredient, selected: false }))
    }))
    const kitchenEnvironmentOptions = this.data.kitchenEnvironmentOptions.map((item) => ({
      ...item,
      selected: false
    }))

    this.setData({
      categorizedIngredients,
      kitchenEnvironmentOptions,
      selectedIngredientNames: [],
      selectedDishTypeIndex: null,
      selectedDishTypeName: '',
      selectedTypeIndex: null,
      selectedTypeName: '',
      selectedTasteIndex: null,
      selectedTasteName: '',
      selectedMethodIndex: null,
      selectedMethodName: '',
      selectedKitchenEnvironmentIndexes: [],
      selectedKitchenEnvironmentNames: []
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
