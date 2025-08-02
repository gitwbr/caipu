const app = getApp()

Page({
  data: {
    isLoading: false,
    // ingredientList and ingredientNames are deprecated
    categorizedIngredients: [], // New categorized data structure
    typeNames: [],
    methodNames: [],
    dishTypeNames: [],
    recentRecipes: [],
    activeTab: 0, 
    selectedIngredientNames: [],
    selectedTypeIndex: null,
    selectedTypeName: '',
    selectedMethodIndex: null,
    selectedMethodName: '',
    selectedDishTypeIndex: null,
    selectedDishTypeName: '',
    ingredientCategoryTabs: ['肉类蛋类', '水产海鲜', '蔬菜菌菇', '豆制品', '主食'],
    activeIngredientCategoryTab: 0,
    showAddCustomInput: false,
    addCustomType: '', // ingredient/dishType/type/method
    addCustomValue: '',
    // 用户限制信息
    userLimits: null,
    isLoggedIn: false,
  },

  onLoad() {
    this.initOptions();
    this.loadRecentRecipes();
  },

  onShow() {
    this.loadRecentRecipes();
    this.updateLoginStatus();
  },

  // 更新登录状态和限制信息
  updateLoginStatus() {
    const app = getApp();
    const isLoggedIn = app.globalData.isLoggedIn;
    
    this.setData({ isLoggedIn });
    
    if (isLoggedIn) {
      // 如果已登录，获取最新的限制信息
      app.checkUserLimits().then((limits) => {
        this.setData({ userLimits: limits });
        wx.setStorageSync('userLimits', limits);
      }).catch((error) => {
        console.error('获取用户限制失败:', error);
        // 如果获取失败，尝试使用本地缓存
        const cachedLimits = wx.getStorageSync('userLimits');
        if (cachedLimits) {
          this.setData({ userLimits: cachedLimits });
        }
      });
    } else {
      // 如果未登录，清除限制信息
      this.setData({ userLimits: null });
      wx.removeStorageSync('userLimits');
    }
  },

  // 初始化数据
  initData() {
    const ingredients = app.globalData.ingredients.map(item => ({
      ...item,
      selected: false,
      weight: 100
    }));
    
    const categories = [...new Set(ingredients.map(item => item.category))];
    const cuisineTypes = app.globalData.cuisineTypes;

    this.setData({
      ingredients,
      filteredIngredients: ingredients,
      categories,
      cuisineTypes
    });
  },

  // 初始化选项
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
    ];
    const dishTypeNames = ['炒菜', '汤', '凉菜', '主食', '小吃'];
    const typeNames = ["家常菜", "健身餐", "儿童营养餐", "川菜", "粤菜", "鲁菜", "苏菜", "浙菜", "闽菜", "湘菜", "徽菜", "东北菜", "西北菜", "日式料理", "韩式料理", "西餐", "东南亚风味"];
    const methodNames = ["红烧", "清蒸", "炖", "煎", "炒", "烤", "凉拌"];
    this.setData({
      categorizedIngredients,
      dishTypeNames,
      typeNames,
      methodNames,
      selectedIngredientNames: []
    });
  },

  // tab切换
  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ activeTab: index });
  },

  // 食材多选标签点击
  onIngredientTagTap(e) {
    const { categoryIndex, ingredientIndex } = e.currentTarget.dataset;
    const categorizedIngredients = this.data.categorizedIngredients;

    // Toggle selected state
    const ingredient = categorizedIngredients[categoryIndex].ingredients[ingredientIndex];
    ingredient.selected = !ingredient.selected;

    // Flatten to get all selected names
    const selectedNames = categorizedIngredients
      .flatMap(category => category.ingredients)
      .filter(ingredient => ingredient.selected)
      .map(ingredient => ingredient.name);

    this.setData({
      categorizedIngredients,
      selectedIngredientNames: selectedNames
    });

    console.log('点击:', ingredient.name, '当前已选:', selectedNames);
  },

  // 食材单选标签点击
  onIngredientSingleTagTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      selectedIngredientIndex: index,
      selectedIngredientName: this.data.ingredientNames[index]
    });
  },

  // 大类单选，支持取消
  onDishTypeTagTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (this.data.selectedDishTypeIndex === index) {
      this.setData({
        selectedDishTypeIndex: null,
        selectedDishTypeName: ''
      });
    } else {
      this.setData({
        selectedDishTypeIndex: index,
        selectedDishTypeName: this.data.dishTypeNames[index]
      });
    }
  },

  // 菜系单选，支持取消
  onTypeTagTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (this.data.selectedTypeIndex === index) {
      this.setData({
        selectedTypeIndex: null,
        selectedTypeName: ''
      });
    } else {
      this.setData({
        selectedTypeIndex: index,
        selectedTypeName: this.data.typeNames[index]
      });
    }
  },

  // 烹饪方式单选，支持取消
  onMethodTagTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (this.data.selectedMethodIndex === index) {
      this.setData({
        selectedMethodIndex: null,
        selectedMethodName: ''
      });
    } else {
      this.setData({
        selectedMethodIndex: index,
        selectedMethodName: this.data.methodNames[index]
      });
    }
  },

  // 生成按钮逻辑
  onGenerateRecipe() {
    const { categorizedIngredients, typeNames, methodNames, dishTypeNames, selectedIngredientNames, selectedTypeIndex, selectedTypeName, selectedMethodIndex, selectedMethodName, selectedDishTypeIndex, selectedDishTypeName } = this.data;
    // 食材
    let main = '';
    if (selectedIngredientNames.length > 0) {
      main = selectedIngredientNames.join('、');
    } else {
      const allIngredientNames = categorizedIngredients.flatMap(cat => cat.ingredients.map(ing => ing.name));
      const randIdx = Math.floor(Math.random() * allIngredientNames.length);
      main = allIngredientNames[randIdx];
    }
    // 菜系/种类
    let type = '家常菜'; // 默认家常菜
    if (selectedTypeIndex !== null && selectedTypeIndex !== undefined) {
      type = selectedTypeName;
    }
    // 烹饪方式
    let method = '';
    if (selectedMethodIndex !== null && selectedMethodIndex !== undefined) {
      method = selectedMethodName;
    }
    // 新增：大类
    let dishType = '';
    if (selectedDishTypeIndex !== null && selectedDishTypeIndex !== undefined) {
      dishType = selectedDishTypeName;
    }

    const params = { main, type, method, dishType };
    this.generateRecipeWithParams(params);
  },

  // 加载最近生成的菜谱
  loadRecentRecipes() {
    const history = wx.getStorageSync('history') || [];
    console.log('最近生成的菜谱 history:', history);
    this.setData({
      recentRecipes: history.slice(0, 3) // 只显示最近3个
    });
  },

  // 随机生成菜谱
  generateRandomRecipe() {
    this.generateRecipe('random');
  },

  // 显示食材选择器
  showIngredientSelector() {
    this.setData({
      showIngredientSelector: true,
      showCuisineSelector: false
    });
  },

  // 显示菜系选择器
  showCuisineSelector() {
    this.setData({
      showCuisineSelector: true,
      showIngredientSelector: false
    });
  },

  // 选择食材分类
  selectCategory(e) {
    const category = e.currentTarget.dataset.category;
    let filteredIngredients = this.data.ingredients;
    
    if (category !== 'all') {
      filteredIngredients = this.data.ingredients.filter(item => item.category === category);
    }
    
    this.setData({
      selectedCategory: category,
      filteredIngredients
    });
  },

  // 切换食材选择状态
  toggleIngredient(e) {
    const index = e.currentTarget.dataset.index;
    const ingredients = this.data.ingredients;
    const filteredIngredients = this.data.filteredIngredients;
    
    // 更新原始数组
    ingredients[index].selected = !ingredients[index].selected;
    
    // 更新过滤数组
    const filteredIndex = filteredIngredients.findIndex(item => item.name === ingredients[index].name);
    if (filteredIndex !== -1) {
      filteredIngredients[filteredIndex].selected = ingredients[index].selected;
    }
    
    // 更新已选择食材列表
    const selectedIngredients = ingredients.filter(item => item.selected);
    
    this.setData({
      ingredients,
      filteredIngredients,
      selectedIngredients
    });
  },

  // 更新食材重量
  updateIngredientWeight(e) {
    const index = e.currentTarget.dataset.index;
    const weight = parseInt(e.detail.value) || 100;
    const ingredients = this.data.ingredients;
    const filteredIngredients = this.data.filteredIngredients;
    
    // 更新原始数组
    ingredients[index].weight = weight;
    
    // 更新过滤数组
    const filteredIndex = filteredIngredients.findIndex(item => item.name === ingredients[index].name);
    if (filteredIndex !== -1) {
      filteredIngredients[filteredIndex].weight = weight;
    }
    
    // 更新已选择食材列表
    const selectedIngredients = ingredients.filter(item => item.selected);
    
    this.setData({
      ingredients,
      filteredIngredients,
      selectedIngredients
    });
  },

  // 选择菜系
  selectCuisine(e) {
    const cuisine = e.currentTarget.dataset.cuisine;
    this.setData({
      selectedCuisine: cuisine
    });
  },

  // 根据食材生成菜谱
  generateRecipeWithIngredients() {
    if (this.data.selectedIngredients.length === 0) {
      wx.showToast({
        title: '请选择食材',
        icon: 'none'
      });
      return;
    }
    const ingredients = this.data.selectedIngredients.map(item => `${item.name}${item.weight}g`).join('、');
    // 直接调用generateRecipeWithParams
    this.generateRecipeWithParams({ main: ingredients, type: '家常菜', method: '', dishType: '' });
  },

  // 根据菜系生成菜谱
  generateRecipeWithCuisine() {
    if (!this.data.selectedCuisine) {
      wx.showToast({
        title: '请选择菜系',
        icon: 'none'
      });
      return;
    }
    // 直接调用generateRecipeWithParams
    this.generateRecipeWithParams({ main: this.data.selectedCuisine, type: this.data.selectedCuisine, method: '', dishType: '' });
  },

  // 新的生成菜谱方法
  generateRecipeWithParams(params) {
    if (this.data.isLoading) {
      wx.showToast({ title: '正在生成中...', icon: 'none' });
      return;
    }
    const app = getApp();
    
    // 检查登录状态
    app.checkLoginAndShowModal().then(() => {
      // 检查用户限制
      return app.checkUserLimits();
    }).then((limits) => {
      // 检查是否超过每日生成限制
      if (limits.daily_generation_count >= limits.daily_generation_limit) {
        wx.showModal({
          title: '生成次数已达上限',
          content: `今日已生成 ${limits.daily_generation_count} 次菜谱，每日限制 ${limits.daily_generation_limit} 次。明天再来吧！`,
          showCancel: false
        });
        return Promise.reject(new Error('生成次数已达上限'));
      }
      
      // 显示剩余次数
      const remaining = limits.daily_generation_limit - limits.daily_generation_count;
      wx.showToast({
        title: `今日剩余 ${remaining} 次`,
        icon: 'none',
        duration: 2000
      });
      
      // 开始生成菜谱
      this.setData({ isLoading: true });
      const randomSeed = Math.floor(Math.random() * 1000000);
      let prompt = `请用${params.main}为食材，`;
      if (params.method) {
        prompt += `采用${params.method}的方式，`;
      }
      prompt += `做一道`;
      if (params.dishType) {
        prompt += `属于"${params.dishType}"的`;
      }
      prompt += `${params.type}。你收到的随机数是：${randomSeed}，请基于它生成不一样的搭配。要求：1. 食材清单中每个食材都要分别列出用量（如150g）、以及每100g所含的热量(千卡)、蛋白质(g)、脂肪(g)、碳水化合物(g)四项营养值。2. 不要直接给出本次用量的总营养值。3. 包含详细的制作步骤。4. 适合家庭制作。5. 包含烹饪技巧和注意事项。请以JSON格式返回。`;
      
      const requestData = {
        model: 'deepseek',
        prompt: prompt,
        system: '你是一个专业的中国菜谱生成助手，请严格按照JSON格式返回菜谱信息。请以JSON格式返回，包含以下字段:name(菜名), description(描述), ingredients(食材数组，包含name和amount), steps(步骤数组), tips(烹饪技巧), tags(标签数组)。'
      };
      
      console.log('请求数据:', requestData);
      
      // 暂时返回，不做任何处理
      /* this.setData({ isLoading: false });
      return; */
      
      wx.request({
        url: app.globalData.serverUrl + '/api/ai',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: requestData,
        success: (res) => {
          let content = '';
          if (res.data && res.data.result && res.data.result.choices && res.data.result.choices[0] && res.data.result.choices[0].message) {
            content = res.data.result.choices[0].message.content;
          } else if (res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message) {
            content = res.data.choices[0].message.content;
          } else if (res.data && res.data.result && res.data.result.content) {
            content = res.data.result.content;
          }
          console.log('API返回内容:', content);
          try {
            const recipe = this.parseRecipeResponse(content);
            if (recipe) {
              // 增加生成次数
              app.incrementGenerationCount().then(() => {
                this.saveToHistory(recipe);
                wx.navigateTo({
                  url: `/pages/recipe/recipe?recipe=${encodeURIComponent(JSON.stringify(recipe))}`
                });
              }).catch((error) => {
                console.error('增加生成次数失败:', error);
                // 即使增加次数失败，也继续显示菜谱
                this.saveToHistory(recipe);
                wx.navigateTo({
                  url: `/pages/recipe/recipe?recipe=${encodeURIComponent(JSON.stringify(recipe))}`
                });
              });
            } else {
              wx.showToast({
                title: '生成失败，请重试',
                icon: 'none'
              });
            }
          } catch (error) {
            wx.showToast({
              title: '生成失败，请重试',
              icon: 'none'
            });
          }
        },
        fail: (error) => {
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none'
          });
        },
        complete: () => {
          this.setData({ isLoading: false });
        }
      });
    }).catch((error) => {
      console.error('生成菜谱失败:', error);
      this.setData({ isLoading: false });
      // 错误已经在各个步骤中处理了，这里不需要额外处理
    });
  },

  // 解析AI返回的菜谱数据
  parseRecipeResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const recipe = JSON.parse(jsonMatch[0]);
        // 自动汇总总营养，只统计有数字的食材
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
          let totalCalories = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0;
          recipe.ingredients.forEach(item => {
            // 只统计 amount 里有“g”或“ml”的
            if (item.amount && /\d/.test(item.amount) && /(g|ml)/i.test(item.amount)) {
              totalCalories += Number(item.calories) || 0;
              totalProtein += Number(item.protein) || 0;
              totalFat += Number(item.fat) || 0;
              totalCarbs += Number(item.carbs) || 0;
            }
          });
          recipe.nutrition = {
            calories: Math.round(totalCalories),
            protein: Math.round(totalProtein * 10) / 10,
            fat: Math.round(totalFat * 10) / 10,
            carbs: Math.round(totalCarbs * 10) / 10
          };
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
          };
        }
      }
      return this.parseRecipeText(content);
    } catch (error) {
      return this.parseRecipeText(content);
    }
  },

  // 手动解析菜谱文本
  parseRecipeText(content) {
    const lines = content.split('\n').filter(line => line.trim());
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
    };
    let currentSection = '';
    for (let line of lines) {
      line = line.trim();
      if (line.includes('食材') || line.includes('原料')) {
        currentSection = 'ingredients';
      } else if (line.includes('步骤') || line.includes('做法')) {
        currentSection = 'steps';
      } else if (line.includes('营养') || line.includes('热量')) {
        currentSection = 'nutrition';
      } else if (line.includes('技巧') || line.includes('注意')) {
        currentSection = 'tips';
      } else if (line && currentSection === 'ingredients') {
        recipe.ingredients.push({
          name: line.replace(/^\d+\.\s*/, ''),
          amount: '适量'
        });
      } else if (line && currentSection === 'steps') {
        recipe.steps.push(line.replace(/^\d+\.\s*/, ''));
      } else if (line && currentSection === 'tips') {
        recipe.tips += line + '\n';
      }
    }
    return recipe;
  },

  // 保存到历史记录
  saveToHistory(recipe) {
    const history = wx.getStorageSync('history') || [];
    history.unshift(recipe);
    // 只保留最近20个记录
    if (history.length > 20) {
      history.splice(20);
    }
    wx.setStorageSync('history', history);
  },

  // 查看菜谱详情
  viewRecipe(e) {
    const recipe = e.currentTarget.dataset.recipe;
    wx.navigateTo({
      url: `/pages/recipe/recipe?recipe=${encodeURIComponent(JSON.stringify(recipe))}`
    });
  },

  onIngredientCategoryTabChange(e) {
    this.setData({
      activeIngredientCategoryTab: e.currentTarget.dataset.index
    });
  },

  onClearSelectedIngredients() {
    // 清空所有已选食材
    const categorizedIngredients = this.data.categorizedIngredients.map(cat => ({
      ...cat,
      ingredients: cat.ingredients.map(ing => ({ ...ing, selected: false }))
    }));
    this.setData({
      categorizedIngredients,
      selectedIngredientNames: []
    });
  },

  onClearAllSelections() {
    // 清空所有已选内容
    const categorizedIngredients = this.data.categorizedIngredients.map(cat => ({
      ...cat,
      ingredients: cat.ingredients.map(ing => ({ ...ing, selected: false }))
    }));
    this.setData({
      categorizedIngredients,
      selectedIngredientNames: [],
      selectedDishTypeIndex: null,
      selectedDishTypeName: '',
      selectedTypeIndex: null,
      selectedTypeName: '',
      selectedMethodIndex: null,
      selectedMethodName: ''
    });
  },
  onShowAddCustomInput(e) {
    this.setData({
      showAddCustomInput: true,
      addCustomType: e.currentTarget.dataset.type,
      addCustomValue: ''
    });
  },
  onAddCustomInput(e) {
    this.setData({ addCustomValue: e.detail.value });
  },
  onAddCustomConfirm() {
    const { addCustomType, addCustomValue, categorizedIngredients, activeIngredientCategoryTab, dishTypeNames, typeNames, methodNames } = this.data;
    if (!addCustomValue.trim()) return;
    if (addCustomType === 'ingredient') {
      const newIngredients = [...categorizedIngredients];
      newIngredients[activeIngredientCategoryTab].ingredients.push({ name: addCustomValue.trim(), selected: false });
      this.setData({
        categorizedIngredients: newIngredients,
        showAddCustomInput: false,
        addCustomValue: ''
      });
    } else if (addCustomType === 'dishType') {
      this.setData({
        dishTypeNames: [...dishTypeNames, addCustomValue.trim()],
        showAddCustomInput: false,
        addCustomValue: ''
      });
    } else if (addCustomType === 'type') {
      this.setData({
        typeNames: [...typeNames, addCustomValue.trim()],
        showAddCustomInput: false,
        addCustomValue: ''
      });
    } else if (addCustomType === 'method') {
      this.setData({
        methodNames: [...methodNames, addCustomValue.trim()],
        showAddCustomInput: false,
        addCustomValue: ''
      });
    }
  },
  onAddCustomCancel() {
    this.setData({ showAddCustomInput: false, addCustomValue: '' });
  },

  // 跳转到食物营养页面
  onGoToFoodNutrition() {
    wx.navigateTo({
      url: '/pages/ingredients/ingredients'
    });
  }
})