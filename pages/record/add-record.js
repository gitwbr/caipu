// pages/record/add-record.js
const app = getApp();

Page({
  data: {
    activeTab: 'recent', // 'recent' 或 'custom'
    searchKeyword: '',
    searchResults: [],
    recentFoods: [],
    customFoods: [],
    loading: false,
    searching: false
  },

  onLoad() {
    this.loadRecentFoods();
    this.loadCustomFoods();
  },

  // 加载最近食物
  loadRecentFoods() {
    const recentFoods = app.globalData.recentFoods || [];
    this.setData({
      recentFoods: recentFoods.slice(0, 10) // 只显示最近10个
    });
  },

  // 加载自定义食物
  loadCustomFoods() {
    const customFoods = app.getCustomFoods();
    this.setData({
      customFoods: customFoods
    });
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab,
      searchResults: [] // 清空搜索结果
    });
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });

    if (keyword.length >= 2) {
      this.searchFoods(keyword);
    } else {
      this.setData({
        searchResults: []
      });
    }
  },

  // 搜索食物
  searchFoods(keyword) {
    // 安全检查
    if (!keyword || typeof keyword !== 'string') {
      this.setData({
        searchResults: [],
        searching: false
      });
      return;
    }

    this.setData({ searching: true });

    // 搜索标准食物（异步）和自定义食物（同步）
    app.searchFoodNutrition(keyword).then(standardResults => {
      // 搜索自定义食物（同步方法）
      const customResults = app.searchCustomFoods(keyword);
      
      // 确保结果是数组
      const standardArray = Array.isArray(standardResults) ? standardResults : [];
      const customArray = Array.isArray(customResults) ? customResults : [];

      // 合并结果
      const allResults = [
        ...standardArray.map(item => ({
          ...item,
          type: 'standard',
          display_name: item.food_name,
          display_energy_kcal: item.energy_kcal
        })),
        ...customArray.map(item => ({
          ...item,
          type: 'custom',
          display_name: item.food_name,
          display_energy_kcal: item.energy_kcal
        }))
      ];

      this.setData({
        searchResults: allResults.slice(0, 20), // 限制显示20个结果
        searching: false
      });
    }).catch(err => {
      console.error('搜索标准食物失败:', err);
      // 即使标准食物搜索失败，也显示自定义食物结果
      const customResults = app.searchCustomFoods(keyword);
      const customArray = Array.isArray(customResults) ? customResults : [];
      
      const allResults = customArray.map(item => ({
        ...item,
        type: 'custom',
        display_name: item.food_name,
        display_energy_kcal: item.energy_kcal
      }));

      this.setData({
        searchResults: allResults.slice(0, 20),
        searching: false
      });
    });
  },

  // 选择食物
  selectFood(e) {
    const { food } = e.currentTarget.dataset;
    
    // 添加到最近食物
    app.addToRecentFoods(food);
    
    // 获取当前选择的日期（优先从记录详情页面获取，如果没有则从原记录页面获取）
    const pages = getCurrentPages();
    let selectedDate = new Date().toISOString().split('T')[0]; // 默认今天
    
    // 先尝试从记录详情页面获取日期
    const detailListPage = pages.find(page => page.route === 'pages/record/record-detail-list');
    if (detailListPage && detailListPage.data.selectedDate) {
      selectedDate = detailListPage.data.selectedDate;
    } else {
      // 如果没有找到记录详情页面，尝试从原记录页面获取
      const recordPage = pages.find(page => page.route === 'pages/record/record');
      if (recordPage && recordPage.data.selectedDate) {
        selectedDate = recordPage.data.selectedDate;
      }
    }
    
    console.log('选择的日期:', selectedDate);
    
    // 跳转到记录详情页面，传递食物和日期信息
    wx.navigateTo({
      url: `/pages/record/record-detail?food=${encodeURIComponent(JSON.stringify(food))}&date=${selectedDate}`
    });
  },

  // 添加自定义食物
  addCustomFood() {
    wx.navigateTo({
      url: '/pages/record/add-custom-food'
    });
  },

  // 编辑自定义食物
  editCustomFood(e) {
    const { food } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/record/edit-custom-food?food=${encodeURIComponent(JSON.stringify(food))}`
    });
  },

  // 删除自定义食物
  deleteCustomFood(e) {
    const { id } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个自定义食物吗？',
      success: (res) => {
        if (res.confirm) {
          app.deleteCustomFoodWithSync(id).then(() => {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            this.loadCustomFoods();
          }).catch(err => {
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
            console.error('删除自定义食物失败:', err);
          });
        }
      }
    });
  }
});