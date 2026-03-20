Component({
  data: {
    selected: 0,
    isSwitching: false,
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: '/images/menu/home-gray.png',
        selectedIconPath: '/images/menu/home-color.png'
      },
      {
        pagePath: 'pages/favorites/favorites',
        text: '收藏',
        iconPath: '/images/menu/favorite-gray.png',
        selectedIconPath: '/images/menu/favorite-color.png'
      },
      {
        pagePath: 'pages/record/record',
        text: '记录',
        iconPath: '/images/menu/records-gray.png',
        selectedIconPath: '/images/menu/records-color.png'
      },
      {
        pagePath: 'pages/profile/profile',
        text: '我的',
        iconPath: '/images/menu/profile-gray.png',
        selectedIconPath: '/images/menu/profile-color.png'
      }
    ]
  },

  lifetimes: {
    attached() {
      this.updateSelected()
    }
  },

  pageLifetimes: {
    show() {
      this.updateSelected()
    }
  },

  methods: {
    normalizePagePath(pagePath = '') {
      return String(pagePath || '').replace(/^\//, '')
    },

    getCurrentRoute() {
      const pages = getCurrentPages()
      if (!pages.length) {
        return ''
      }

      return this.normalizePagePath(pages[pages.length - 1].route)
    },

    setSelectedByPath(pagePath) {
      const normalizedPath = this.normalizePagePath(pagePath)
      const selected = this.data.list.findIndex((item) => item.pagePath === normalizedPath)

      if (selected !== -1 && selected !== this.data.selected) {
        this.setData({ selected })
      }
    },

    updateSelected() {
      const currentRoute = this.getCurrentRoute()
      if (!currentRoute) {
        return
      }

      this.setSelectedByPath(currentRoute)
    },

    switchTab(e) {
      const { path } = e.currentTarget.dataset
      const normalizedPath = this.normalizePagePath(path)
      const currentRoute = this.getCurrentRoute()

      if (!normalizedPath || this.data.isSwitching) {
        return
      }

      if (normalizedPath === currentRoute) {
        this.updateSelected()
        return
      }

      this.setData({ isSwitching: true })

      wx.switchTab({
        url: `/${normalizedPath}`,
        complete: () => {
          this.setData({ isSwitching: false })
        }
      })
    }
  }
})
