const app = getApp();

Page({
  data: {
    searchKeyword: '',
    searchResults: [],
    isLoading: false,
    showSearchResults: false,
    foodNutritionData: [],
    selectedFood: null,
    showFoodDetail: false
  },

  onLoad() {
    this.loadFoodData();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadFoodData();
  },

  // 加载食物营养数据
  loadFoodData() {
    const foodData = app.getLocalFoodNutritionData();
    this.setData({
      foodNutritionData: foodData
    });
    console.log(foodData);
    console.log('加载食物营养数据，共', foodData.length, '条');
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });

    if (keyword.length > 0) {
      this.searchFood(keyword);
    } else {
      this.setData({
        showSearchResults: false,
        searchResults: []
      });
    }
  },

  // 搜索食物
  searchFood(keyword) {
    this.setData({ isLoading: true });

    // 先从本地数据搜索
    const localResults = this.searchLocalFood(keyword);
    
    if (localResults.length > 0) {
      this.setData({
        searchResults: localResults,
        showSearchResults: true,
        isLoading: false
      });
    } else {
      // 如果本地没有找到，则从服务器搜索
      app.searchFoodNutrition(keyword).then(results => {
        this.setData({
          searchResults: results,
          showSearchResults: true,
          isLoading: false
        });
      }).catch(error => {
        console.error('搜索失败:', error);
        wx.showToast({
          title: '搜索失败',
          icon: 'none'
        });
        this.setData({ isLoading: false });
      });
    }
  },

  // 本地搜索
  searchLocalFood(keyword) {
    const data = this.data.foodNutritionData;
    return data.filter(item => 
      item.food_name.toLowerCase().includes(keyword.toLowerCase())
    ).slice(0, 20); // 限制结果数量
  },

  // 选择食物
  selectFood(e) {
    const food = e.currentTarget.dataset.food;
    this.setData({
      selectedFood: food,
      showFoodDetail: true,
      showSearchResults: false
    });
  },

  // 关闭食物详情
  closeFoodDetail() {
    this.setData({
      showFoodDetail: false,
      selectedFood: null
    });
  },

  // 清空搜索
  clearSearch() {
    this.setData({
      searchKeyword: '',
      searchResults: [],
      showSearchResults: false
    });
  },

  // 计算营养成分百分比
  calculateNutritionPercentage(value, unit = 'g') {
    if (!value || value === 0) return '0%';
    
    // 这里可以根据不同的营养成分设置不同的参考值
    const referenceValues = {
      protein_g: 50, // 蛋白质参考值50g
      fat_g: 65,     // 脂肪参考值65g
      carbohydrate_g: 300, // 碳水化合物参考值300g
      fiber_g: 25,   // 膳食纤维参考值25g
      vitamin_c_mg: 100, // 维生素C参考值100mg
      ca_mg: 800,    // 钙参考值800mg
      fe_mg: 14      // 铁参考值14mg
    };

    const field = Object.keys(referenceValues).find(key => 
      this.data.selectedFood && this.data.selectedFood[key] === value
    );

    if (field && referenceValues[field]) {
      const percentage = (value / referenceValues[field] * 100).toFixed(1);
      return `${percentage}%`;
    }

    return `${value}${unit}`;
  },

  // 格式化营养成分显示
  formatNutritionValue(value, unit = '') {
    if (value === null || value === undefined) return '0';
    return value.toFixed(2) + unit;
  }
}); 