const app = getApp();

Page({
  data: {
    favorites: [],
    selectedItems: [],
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
    if (!app.globalData.isLoggedIn) {
      this.setData({ favorites: [] });
      return;
    }

    this.setData({ isLoading: true });

    wx.request({
      url: app.globalData.serverUrl + '/api/favorites',
      method: 'GET',
      header: {
        'Authorization': 'Bearer ' + app.globalData.token,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 将云端数据转换为本地格式
          const favorites = res.data.map(item => ({
            ...item.recipe_data,
            favoriteId: item.id // 保存收藏记录的ID
          }));
          this.setData({ favorites });
        } else {
          wx.showToast({
            title: res.data.error || '加载失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({ isLoading: false });
      }
    });
  },

  // 查看菜谱详情
  viewRecipe(e) {
    const recipe = e.currentTarget.dataset.recipe;
    wx.navigateTo({
      url: `/pages/recipe/recipe?recipe=${encodeURIComponent(JSON.stringify(recipe))}`
    });
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

    wx.request({
      url: app.globalData.serverUrl + `/api/favorites/${favoriteId}`,
      method: 'DELETE',
      header: {
        'Authorization': 'Bearer ' + app.globalData.token,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          // 从本地列表中移除
          const favorites = this.data.favorites.filter(item => item.favoriteId !== favoriteId);
          this.setData({ favorites });
          
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.data.error || '删除失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      }
    });
  },

  // 全选
  selectAll() {
    const selectedItems = this.data.favorites.map(item => item.favoriteId);
    this.setData({ selectedItems });
  },

  // 取消全选
  clearSelection() {
    this.setData({ selectedItems: [] });
  },

  // 删除选中项
  deleteSelected() {
    if (this.data.selectedItems.length === 0) {
      wx.showToast({
        title: '请选择要删除的菜谱',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的${this.data.selectedItems.length}个菜谱吗？`,
      success: (res) => {
        if (res.confirm) {
          this.deleteMultipleFavorites();
        }
      }
    });
  },

  // 批量删除收藏
  deleteMultipleFavorites() {
    wx.showLoading({ title: '删除中...' });
    
    const deletePromises = this.data.selectedItems.map(favoriteId => {
      return new Promise((resolve) => {
        wx.request({
          url: app.globalData.serverUrl + `/api/favorites/${favoriteId}`,
          method: 'DELETE',
          header: {
            'Authorization': 'Bearer ' + app.globalData.token,
            'Content-Type': 'application/json'
          },
          success: (res) => {
            resolve(res.statusCode === 200);
          },
          fail: () => {
            resolve(false);
          }
        });
      });
    });

    Promise.all(deletePromises).then((results) => {
      wx.hideLoading();
      const successCount = results.filter(result => result).length;
      
      if (successCount === this.data.selectedItems.length) {
        // 全部删除成功
        const favorites = this.data.favorites.filter(item => 
          !this.data.selectedItems.includes(item.favoriteId)
        );
        this.setData({ 
          favorites,
          selectedItems: []
        });
        
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: `部分删除失败`,
          icon: 'none'
        });
        // 重新加载数据
        this.loadFavorites();
      }
    });
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