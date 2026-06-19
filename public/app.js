// SlideLibrary Repository Client Logic

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let activeCategory = 'templates'; // Default active category
  let searchQuery = '';
  let debounceTimer;
  let currentOpenItem = null;
  let currentOpenCategory = null;
  let isBulkSelectMode = false;
  let selectedBulkItems = [];

  // DOM Elements
  const globalSearch = document.getElementById('global-search');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const searchSpinner = document.getElementById('search-spinner');
  const sidebarMenuItems = document.querySelectorAll('.menu-item');
  const categoryTitle = document.getElementById('category-title');
  const itemCount = document.getElementById('item-count');
  const suggestionsContainer = document.getElementById('suggestions-container');
  const cardsGrid = document.getElementById('cards-grid');
  const emptyState = document.getElementById('empty-state');
  const searchedTermDisplay = document.getElementById('searched-term-display');
  const resetSearchBtn = document.getElementById('reset-search-btn');

  // Auth & Main Layout DOM Elements
  const appTopnav = document.querySelector('.app-topnav');
  const appLayout = document.querySelector('.app-layout');
  const appFooter = document.querySelector('.app-footer');
  const loginScreen = document.getElementById('login-screen');

  // Bulk Action UI DOM Elements
  const bulkModeBtn = document.getElementById('bulk-mode-btn');
  const bulkActionsBar = document.getElementById('bulk-actions-bar');
  const bulkSelectAllBtn = document.getElementById('bulk-select-all-btn');
  const bulkSelectedCount = document.getElementById('bulk-selected-count');
  const bulkMoveCategory = document.getElementById('bulk-move-category');
  const bulkMoveBtn = document.getElementById('bulk-move-btn');
  const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
  const bulkCancelBtn = document.getElementById('bulk-cancel-btn');

  // Modal DOM Elements
  const largeViewModal = document.getElementById('large-view-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalPreviewPanel = document.getElementById('modal-preview-panel');
  const modalMetaRow = document.getElementById('modal-meta-row');
  const modalTitle = document.getElementById('modal-title');
  const modalDescription = document.getElementById('modal-description');
  const modalTags = document.getElementById('modal-tags');
  const modalDownloadBtn = document.getElementById('modal-download-btn');
  const modalDownloadText = document.getElementById('modal-download-text');
  const modalEditBtn = document.getElementById('modal-edit-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');

  // Edit Modal DOM Elements
  const editResourceModal = document.getElementById('edit-resource-modal');
  const closeEditResourceBtn = document.getElementById('close-edit-resource-btn');
  const cancelEditResourceBtn = document.getElementById('cancel-edit-resource-btn');
  const editResourceForm = document.getElementById('edit-resource-form');
  const editResourceIdInput = document.getElementById('edit-resource-id');
  const editResourceOldTypeInput = document.getElementById('edit-resource-old-type');
  const editResourceTypeSelect = document.getElementById('edit-resource-type');
  const editTitleLabel = document.getElementById('edit-title-label');
  const editResourceTitleInput = document.getElementById('edit-resource-title');
  const editKeywordPickerContainer = document.getElementById('edit-keyword-picker-container');
  const editResourceKeywordsInput = document.getElementById('edit-resource-keywords');
  const editCustomKeywordInput = document.getElementById('edit-custom-keyword-input');
  const editAddCustomKeywordBtn = document.getElementById('edit-add-custom-keyword-btn');

  let editSelectedKeywords = [];

  // Suggestion Chips by category
  const suggestionData = {
    templates: ['template', 'deck', 'corporate', 'presentation', 'business'],
    charts: ['chart', 'diagram', 'metrics', 'finance', 'revenue', '3-pointer', 'guidelines'],
    maps: ['map', 'california', 'texas', 'geography', 'national'],
    icons: ['growth', 'chart', 'dna', 'science', 'global', 'tech'],
    scientific: ['cell', 'biology', 'solar system', 'space', 'brain', 'neuron'],
    videos_2d: ['animation', 'explainer', 'marketing', 'tutorial', '2d'],
    videos_3d: ['render', 'animation', 'product', 'tour', '3d'],
    slide_decks: ['pitch', 'company', 'sales', 'presentation', 'deck']
  };

  // Maps category tabs to backend API URLs
  const categoryApis = {
    templates: '/api/slides',
    charts: '/api/slides',
    maps: '/api/slides',
    icons: '/api/icons',
    scientific: '/api/scientific_images',
    videos_2d: '/api/videos_2d',
    videos_3d: '/api/videos_3d',
    slide_decks: '/api/slide_decks'
  };

  // Initial setup
  function init() {
    setupEventListeners();
    
    // Check localStorage session on load
    const storedUser = localStorage.getItem('slide_library_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        updateAuthView(user);
      } catch (err) {
        localStorage.removeItem('slide_library_user');
        updateAuthView(null);
      }
    } else {
      updateAuthView(null);
    }
  }

  // Update visual state and details based on authentication status
  function updateAuthView(user) {
    if (user) {
      // Set user details in navigation trigger and dropdown
      const displayAccountName = document.getElementById('account-name-display');
      const displayAvatar = document.getElementById('avatar-display');
      const dropdownUserName = document.getElementById('dropdown-user-name');
      const dropdownUserEmail = document.getElementById('dropdown-user-email');

      if (displayAccountName) displayAccountName.textContent = user.name;
      if (displayAvatar) displayAvatar.textContent = user.initials;
      if (dropdownUserName) dropdownUserName.textContent = user.name;
      if (dropdownUserEmail) dropdownUserEmail.textContent = user.email;

      // Hide login, show main content
      if (loginScreen) loginScreen.style.display = 'none';
      if (appTopnav) appTopnav.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'flex';
      if (appFooter) appFooter.style.display = 'flex';

      // Load correct category view data
      updateCategoryView(activeCategory);
    } else {
      // Exit bulk select mode on logout
      toggleBulkSelectMode(false);

      // Hide main content, show login screen
      if (loginScreen) loginScreen.style.display = 'flex';
      if (appTopnav) appTopnav.style.display = 'none';
      if (appLayout) appLayout.style.display = 'none';
      if (appFooter) appFooter.style.display = 'none';

      // Reset login form fields
      const loginForm = document.getElementById('login-form');
      if (loginForm) loginForm.reset();
      const loginErrorMsg = document.getElementById('login-error-msg');
      if (loginErrorMsg) loginErrorMsg.style.display = 'none';
    }
  }

  // Update floating bulk action bar counters and text
  function updateBulkActionsBar() {
    if (bulkSelectedCount) {
      bulkSelectedCount.textContent = `${selectedBulkItems.length} item${selectedBulkItems.length === 1 ? '' : 's'} selected`;
    }

    // Toggle Select All text/icon based on whether all visible items are selected
    const visibleCards = cardsGrid.querySelectorAll('.asset-card');
    const allChecked = Array.from(visibleCards).every(card => {
      const chk = card.querySelector('.card-select-checkbox');
      return chk && chk.checked;
    });

    if (bulkSelectAllBtn) {
      if (allChecked && visibleCards.length > 0) {
        bulkSelectAllBtn.innerHTML = '<i class="fa-solid fa-square-minus"></i> <span>Deselect All</span>';
      } else {
        bulkSelectAllBtn.innerHTML = '<i class="fa-regular fa-square-check"></i> <span>Select All</span>';
      }
    }
  }

  // Toggle Bulk Select Mode on/off
  function toggleBulkSelectMode(active) {
    isBulkSelectMode = active;
    
    if (active) {
      document.body.classList.add('bulk-select-active');
      if (bulkActionsBar) bulkActionsBar.style.display = 'flex';
      if (bulkModeBtn) {
        bulkModeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> <span>Exit Bulk Mode</span>';
        bulkModeBtn.classList.remove('secondary');
        bulkModeBtn.style.backgroundColor = '#FFEBE6';
        bulkModeBtn.style.color = '#FF5630';
        bulkModeBtn.style.borderColor = '#FF5630';
      }
      // Populate target group selection dropdown with current activeCategory pre-selected
      if (bulkMoveCategory) {
        bulkMoveCategory.value = activeCategory;
      }
    } else {
      document.body.classList.remove('bulk-select-active');
      if (bulkActionsBar) bulkActionsBar.style.display = 'none';
      if (bulkModeBtn) {
        bulkModeBtn.innerHTML = '<i class="fa-solid fa-list-check"></i> <span>Bulk Actions</span>';
        bulkModeBtn.classList.add('secondary');
        bulkModeBtn.removeAttribute('style'); // reset layout styles
      }
      // Clear selections
      selectedBulkItems = [];
      // Uncheck checkboxes and clear styling on cards
      cardsGrid.querySelectorAll('.asset-card').forEach(card => {
        card.classList.remove('selected');
        const chk = card.querySelector('.card-select-checkbox');
        if (chk) chk.checked = false;
      });
    }
    updateBulkActionsBar();
  }

  // Bind interaction events
  function setupEventListeners() {
    // Sidebar category navigation
    sidebarMenuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // Stop active tab change if quick add button was clicked
        if (e.target.closest('.quick-add-sidebar-btn')) {
          return;
        }
        const menuItem = e.currentTarget;
        const category = menuItem.getAttribute('data-category');
        
        sidebarMenuItems.forEach(mi => mi.classList.remove('active'));
        menuItem.classList.add('active');

        activeCategory = category;
        globalSearch.value = '';
        updateClearButtonVisibility();

        // Exit bulk select mode when switching categories
        if (isBulkSelectMode) {
          toggleBulkSelectMode(false);
        }

        updateCategoryView(category);
      });
    });

    // Sidebar quick-add buttons
    document.querySelectorAll('.quick-add-sidebar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const targetCategory = e.currentTarget.getAttribute('data-quick-category');
        
        resetAddResourceForm();
        
        // Pre-select the resource type dropdown
        resourceType.value = targetCategory;
        resourceType.dispatchEvent(new Event('change'));
        
        addResourceModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      });
    });

    // Global search input (debounced search-on-type)
    globalSearch.addEventListener('input', () => {
      updateClearButtonVisibility();
      clearTimeout(debounceTimer);
      searchQuery = globalSearch.value.trim();
      
      debounceTimer = setTimeout(() => {
        if (searchQuery) {
          loadGlobalSearch(searchQuery);
        } else {
          loadData(activeCategory, '');
        }
      }, 350);
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
      globalSearch.value = '';
      updateClearButtonVisibility();
      globalSearch.focus();
      searchQuery = '';
      loadData(activeCategory, '');
    });

    // Empty state reset button
    resetSearchBtn.addEventListener('click', () => {
      globalSearch.value = '';
      updateClearButtonVisibility();
      searchQuery = '';
      loadData(activeCategory, '');
    });

    // Global search clear (from empty state)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'global-clear-search-btn') {
        globalSearch.value = '';
        updateClearButtonVisibility();
        searchQuery = '';
        loadData(activeCategory, '');
      }
    });

    // Modal Close button
    modalCloseBtn.addEventListener('click', closeLargeView);

    // Modal Close via overlay click
    largeViewModal.addEventListener('click', (e) => {
      if (e.target === largeViewModal) {
        closeLargeView();
      }
    });

    // Modal Close via Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (largeViewModal.style.display === 'flex') {
          closeLargeView();
        } else if (editResourceModal.style.display === 'flex') {
          closeEditResourceModal();
        }
      }
    });

    // Edit & Delete button handlers in Lightbox
    modalEditBtn.addEventListener('click', openEditResourceModal);
    modalDeleteBtn.addEventListener('click', async () => {
      if (!currentOpenItem || !currentOpenCategory) return;
      
      const confirmDelete = confirm(`Are you sure you want to delete "${currentOpenItem.title || currentOpenItem.name}"? This action cannot be undone.`);
      if (!confirmDelete) return;

      try {
        const response = await fetch(`/api/resources/${currentOpenCategory}/${currentOpenItem.id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Delete operation failed');
        }

        const resJson = await response.json();
        if (resJson.success) {
          closeLargeView();
          loadData(activeCategory, searchQuery);
        } else {
          alert('Could not delete resource.');
        }
      } catch (err) {
        console.error('Delete error:', err);
        alert('Error deleting resource. Please try again.');
      }
    });

    // Edit Modal Close & Cancel handlers
    closeEditResourceBtn.addEventListener('click', closeEditResourceModal);
    cancelEditResourceBtn.addEventListener('click', closeEditResourceModal);
    editResourceModal.addEventListener('click', (e) => {
      if (e.target === editResourceModal) {
        closeEditResourceModal();
      }
    });

    // Toggle label depending on selected type in Edit form
    editResourceTypeSelect.addEventListener('change', () => {
      const type = editResourceTypeSelect.value;
      if (type === 'templates' || type === 'charts' || type === 'maps') {
        editTitleLabel.textContent = '2. Title';
        editResourceTitleInput.placeholder = 'Enter resource title...';
      } else {
        if (type === 'icons') {
          editTitleLabel.textContent = '2. Icon Name';
          editResourceTitleInput.placeholder = 'Enter icon name...';
        } else {
          editTitleLabel.textContent = '2. Image Title';
          editResourceTitleInput.placeholder = 'Enter scientific image title...';
        }
      }
    });

    // Keywords chip selection inside Edit Form
    editKeywordPickerContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.p-chip');
      if (!chip) return;
      
      const keyword = chip.getAttribute('data-keyword');
      if (chip.classList.contains('selected')) {
        chip.classList.remove('selected');
        editSelectedKeywords = editSelectedKeywords.filter(kw => kw !== keyword);
      } else {
        chip.classList.add('selected');
        editSelectedKeywords.push(keyword);
      }
      
      updateEditKeywordsInput();
    });

    editAddCustomKeywordBtn.addEventListener('click', addEditCustomKeyword);
    editCustomKeywordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addEditCustomKeyword();
      }
    });

    // Edit form submission
    editResourceForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (editSelectedKeywords.length === 0) {
        editResourceKeywordsInput.setCustomValidity('Please select at least one keyword.');
        editResourceForm.reportValidity();
        return;
      }

      const id = editResourceIdInput.value;
      const oldType = editResourceOldTypeInput.value;
      const newType = editResourceTypeSelect.value;
      const title = editResourceTitleInput.value.trim();
      const keywords = editResourceKeywordsInput.value;

      try {
        const response = await fetch(`/api/resources/${oldType}/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: newType,
            title: title,
            keywords: keywords
          })
        });

        if (!response.ok) {
          throw new Error('Edit operation failed');
        }

        const resJson = await response.json();
        if (resJson.success) {
          closeEditResourceModal();
          
          // Auto-switch view tab to matching subcategory if changed
          activeCategory = newType;
          sidebarMenuItems.forEach(item => {
            if (item.getAttribute('data-category') === activeCategory) {
              item.classList.add('active');
            } else {
              item.classList.remove('active');
            }
          });

          updateCategoryView(activeCategory);
        } else {
          alert('Could not update resource.');
        }
      } catch (err) {
        console.error('Edit submission error:', err);
        alert('Error updating form. Please verify network and server.');
      }
    });

    // Login Form Submit handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const errorMsg = document.getElementById('login-error-msg');
        
        if (!emailInput || !passwordInput) return;
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) return;
        
        try {
          if (errorMsg) errorMsg.style.display = 'none';
          
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          });
          
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Authentication failed');
          }
          
          const data = await response.json();
          if (data.success && data.user) {
            localStorage.setItem('slide_library_user', JSON.stringify(data.user));
            updateAuthView(data.user);
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (err) {
          console.error('Login error:', err);
          if (errorMsg) {
            errorMsg.querySelector('span').textContent = err.message || 'Wrong email or password.';
            errorMsg.style.display = 'flex';
          }
        }
      });
    }

    // Toggle Bulk Action mode
    if (bulkModeBtn) {
      bulkModeBtn.addEventListener('click', () => {
        toggleBulkSelectMode(!isBulkSelectMode);
      });
    }

    // Cancel Bulk Mode
    if (bulkCancelBtn) {
      bulkCancelBtn.addEventListener('click', () => {
        toggleBulkSelectMode(false);
      });
    }

    // Select/Deselect All visible cards in current tab
    if (bulkSelectAllBtn) {
      bulkSelectAllBtn.addEventListener('click', () => {
        const visibleCards = cardsGrid.querySelectorAll('.asset-card');
        const allChecked = Array.from(visibleCards).every(card => {
          const chk = card.querySelector('.card-select-checkbox');
          return chk && chk.checked;
        });

        visibleCards.forEach(card => {
          const chk = card.querySelector('.card-select-checkbox');
          if (chk) {
            chk.checked = !allChecked;
            chk.dispatchEvent(new Event('change'));
          }
        });
      });
    }

    // Bulk Delete Selected
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', async () => {
        if (selectedBulkItems.length === 0) {
          alert('Please select at least one item to delete.');
          return;
        }

        const confirmDelete = confirm(`Are you sure you want to delete ${selectedBulkItems.length} selected resources? This action cannot be undone.`);
        if (!confirmDelete) return;

        try {
          const response = await fetch('/api/resources/bulk-delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resources: selectedBulkItems })
          });

          if (!response.ok) {
            throw new Error('Bulk delete operation failed');
          }

          const resJson = await response.json();
          if (resJson.success) {
            toggleBulkSelectMode(false);
            loadData(activeCategory, searchQuery);
          } else {
            alert('Could not delete resources.');
          }
        } catch (err) {
          console.error('Bulk delete error:', err);
          alert('Error during bulk deletion. Please verify connection.');
        }
      });
    }

    // Bulk Move Selected
    if (bulkMoveBtn) {
      bulkMoveBtn.addEventListener('click', async () => {
        if (selectedBulkItems.length === 0) {
          alert('Please select at least one item to move.');
          return;
        }

        const targetType = bulkMoveCategory.value;

        try {
          const response = await fetch('/api/resources/bulk-move', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              targetType: targetType,
              resources: selectedBulkItems
            })
          });

          if (!response.ok) {
            throw new Error('Bulk move operation failed');
          }

          const resJson = await response.json();
          if (resJson.success) {
            toggleBulkSelectMode(false);
            
            // Switch tab to the target group we just moved the files to
            activeCategory = targetType;
            sidebarMenuItems.forEach(item => {
              if (item.getAttribute('data-category') === activeCategory) {
                item.classList.add('active');
              } else {
                item.classList.remove('active');
              }
            });

            updateCategoryView(activeCategory);
          } else {
            alert('Could not move resources.');
          }
        } catch (err) {
          console.error('Bulk move error:', err);
          alert('Error during bulk migration. Please check connection.');
        }
      });
    }
  }

  // Update layout titles and suggestions
  function updateCategoryView(category) {
    // Update Content title
    if (category === 'templates') {
      categoryTitle.textContent = 'Templates & Slides';
    } else if (category === 'charts') {
      categoryTitle.textContent = 'Charts & Diagrams';
    } else if (category === 'maps') {
      categoryTitle.textContent = 'Maps & Flags';
    } else if (category === 'icons') {
      categoryTitle.textContent = 'Vector Icons';
    } else if (category === 'scientific') {
      categoryTitle.textContent = 'Scientific Diagrams';
    } else if (category === 'videos_2d') {
      categoryTitle.textContent = '2D Videos';
    } else if (category === 'videos_3d') {
      categoryTitle.textContent = '3D Videos';
    } else if (category === 'slide_decks') {
      categoryTitle.textContent = 'Slide Decks';
    }

    // Render suggestion chips
    suggestionsContainer.innerHTML = '';
    const chips = suggestionData[category] || [];
    chips.forEach(chipText => {
      const chip = document.createElement('span');
      chip.className = 's-chip';
      chip.textContent = chipText;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        globalSearch.value = chipText;
        updateClearButtonVisibility();
        searchQuery = chipText;
        loadData(category, chipText);
      });
      suggestionsContainer.appendChild(chip);
    });

    // Fetch category items
    loadData(category, searchQuery);
  }

  // Fetch category items with client-side sub-filtering for slide types
  async function loadData(category, query = '') {
    showSpinner(true);
    const apiEndpoint = categoryApis[category];
    
    try {
      const response = await fetch(`${apiEndpoint}?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      let data = await response.json();

      // Filter PowerPoint slides based on SlideLibrary sidebar categories
      if (category === 'templates') {
        data = data.filter(s => s.slide_type !== 'map' && s.slide_type !== '3-pointer' && s.slide_type !== 'guidelines');
      } else if (category === 'charts') {
        data = data.filter(s => s.slide_type === '3-pointer' || s.slide_type === 'guidelines' || s.slide_type === 'chart' || s.slide_type === 'diagram');
      } else if (category === 'maps') {
        data = data.filter(s => s.slide_type === 'map');
      }

      renderCards(category, data, query);
    } catch (err) {
      console.error('Error fetching assets:', err);
      cardsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; border-color: var(--color-warning);">
          <div class="empty-illustration" style="color: var(--color-warning);">
            <i class="fa-solid fa-circle-exclamation"></i>
          </div>
          <h3>Failed to Load Assets</h3>
          <p>We encountered an error querying the database. Verify that the backend server is running.</p>
        </div>
      `;
    } finally {
      showSpinner(false);
    }
  }

  // Global search across ALL categories (slides + icons + scientific diagrams)
  async function loadGlobalSearch(query) {
    showSpinner(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      renderGlobalSearchResults(data, query);
    } catch (err) {
      console.error('Error in global search:', err);
      cardsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; border-color: var(--color-warning);">
          <div class="empty-illustration" style="color: var(--color-warning);">
            <i class="fa-solid fa-circle-exclamation"></i>
          </div>
          <h3>Search Failed</h3>
          <p>We encountered an error searching across all resources.</p>
        </div>
      `;
    } finally {
      showSpinner(false);
    }
  }

  // Render results from global search (all tables at once)
  function renderGlobalSearchResults(items, query) {
    cardsGrid.innerHTML = '';
    itemCount.textContent = `${items.length} result${items.length === 1 ? '' : 's'} across all categories`;

    if (items.length === 0) {
      emptyState.style.display = 'flex';
      cardsGrid.style.display = 'none';
      searchedTermDisplay.textContent = query;
      return;
    }

    emptyState.style.display = 'none';
    cardsGrid.style.display = 'grid';

    // Category label mapping
    const categoryLabels = {
      slides: 'Slide',
      icons: 'Icon',
      scientific_images: 'Scientific',
      videos_2d: '2D Video',
      videos_3d: '3D Video',
      slide_decks: 'Slide Deck'
    };
    const categoryColors = {
      slides: 'var(--color-primary)',
      icons: '#00B8D9',
      scientific_images: '#36B37E',
      videos_2d: '#FF5630',
      videos_3d: '#6554C0',
      slide_decks: '#FFAB00'
    };

    items.forEach(item => {
      const cat = item._table || 'slides';
      const card = document.createElement('div');
      card.className = 'asset-card';

      // Determine the frontend category for bulk/edit operations
      let frontendCategory = 'templates';
      if (cat === 'icons') frontendCategory = 'icons';
      else if (cat === 'scientific_images') frontendCategory = 'scientific';
      else if (cat === 'videos_2d') frontendCategory = 'videos_2d';
      else if (cat === 'videos_3d') frontendCategory = 'videos_3d';
      else if (cat === 'slide_decks') frontendCategory = 'slide_decks';
      else if (item.slide_type === 'map') frontendCategory = 'maps';
      else if (item.slide_type === '3-pointer' || item.slide_type === 'guidelines') frontendCategory = 'charts';

      const catLabel = categoryLabels[cat] || 'Slide';
      const catColor = categoryColors[cat] || 'var(--color-primary)';

      let mediaClass = 'slide-media';
      if (cat === 'icons') mediaClass = 'icon-box';
      else if (cat === 'scientific_images') mediaClass = 'sci-media';
      else if (cat === 'videos_2d' || cat === 'videos_3d') mediaClass = 'video-media';
      else if (cat === 'slide_decks') mediaClass = 'deck-media';

      card.innerHTML = `
        <div class="card-checkbox-wrapper">
          <input type="checkbox" class="card-select-checkbox" data-id="${item.id}" data-type="${frontendCategory}">
        </div>
        <div class="card-actions-menu">
          <button class="card-menu-trigger" title="Resource Actions">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
          <div class="card-dropdown-menu" style="display: none;">
            <button class="card-dropdown-item edit-item-btn">
              <i class="fa-solid fa-pen"></i> Edit
            </button>
            <button class="card-dropdown-item delete-item-btn">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </div>
        </div>
        <div class="card-media ${mediaClass}">
          <img src="${item.preview_image_url}" alt="${item.title}" onerror="this.src='https://placehold.co/600x338/f4f5f7/5e6c84?text=Preview'">
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="badge type" style="background:${catColor};color:#fff;">${catLabel}</span>
            ${item.state ? `<span class="badge state">${item.state}</span>` : ''}
          </div>
          <h4 class="card-title">${item.title}</h4>
          <p class="card-keywords">${(item.keywords || '').split(',').slice(0, 3).map(k => `<span class="kw-chip">${k.trim()}</span>`).join(' ')}</p>
        </div>
      `;

      // Click card to open detail view
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-actions-menu') || e.target.closest('.card-checkbox-wrapper')) return;
        currentOpenItem = item;
        currentOpenCategory = frontendCategory;
        openLargeView(frontendCategory, item);
      });

      // Three-dot menu
      const menuTrigger = card.querySelector('.card-menu-trigger');
      const dropdownMenu = card.querySelector('.card-dropdown-menu');
      menuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown-menu').forEach(m => { if (m !== dropdownMenu) m.style.display = 'none'; });
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
      });

      // Edit from menu
      const editBtn = card.querySelector('.edit-item-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdownMenu.style.display = 'none';
          
          // Set currentOpenItem & currentOpenCategory
          currentOpenItem = item;
          currentOpenCategory = frontendCategory;
          
          openEditResourceModal();
        });
      }

      // Delete from menu
      const deleteBtn = card.querySelector('.delete-item-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          dropdownMenu.style.display = 'none';
          const confirmDelete = confirm(`Delete "${item.title}"? This cannot be undone.`);
          if (!confirmDelete) return;
          try {
            const resp = await fetch(`/api/resources/${frontendCategory}/${item.id}`, { method: 'DELETE' });
            if (!resp.ok) throw new Error('Delete failed');
            const rj = await resp.json();
            if (rj.success) loadGlobalSearch(query);
            else alert('Could not delete resource.');
          } catch (err) {
            console.error('Delete error:', err);
            alert('Error deleting resource.');
          }
        });
      }

      cardsGrid.appendChild(card);
    });

    // Close menus on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.card-dropdown-menu').forEach(m => m.style.display = 'none');
    }, { once: true });
  }

  // Generate cards
  function renderCards(category, items, query) {
    cardsGrid.innerHTML = '';
    itemCount.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;

    if (items.length === 0) {
      emptyState.style.display = 'flex';
      cardsGrid.style.display = 'none';
      searchedTermDisplay.textContent = query;
      return;
    }

    emptyState.style.display = 'none';
    cardsGrid.style.display = 'grid';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'asset-card';

      const isSelected = selectedBulkItems.some(i => i.id === item.id && i.type === category);
      if (isSelected) {
        card.classList.add('selected');
      }

      // Structure card layout depending on item type
      let cardHTML = `
        <div class="card-checkbox-wrapper">
          <input 
            type="checkbox" 
            class="card-select-checkbox" 
            data-id="${item.id}" 
            data-type="${category}"
            ${isSelected ? 'checked' : ''}
          >
        </div>
        <div class="card-actions-menu">
          <button class="card-menu-trigger" title="Resource Actions">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
          <div class="card-dropdown-menu" style="display: none;">
            <button class="card-dropdown-item edit-item-btn">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="card-dropdown-item delete-item-btn">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </div>
        </div>
      `;

      if (category === 'templates' || category === 'charts' || category === 'maps') {
        // Render Slide Card (strict 16:9 ratio)
        card.innerHTML = cardHTML + `
          <div class="card-media slide-media">
            <img src="${item.preview_image_url}" alt="${item.title}" onerror="this.src='https://placehold.co/600x338/f4f5f7/5e6c84?text=Slide+Preview'">
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="badge type">${item.slide_type}</span>
              <span class="badge state">${item.state}</span>
            </div>
            <h4 class="card-title">${item.title}</h4>
            <div class="card-tags">
              ${renderKeywordTags(item.keywords)}
            </div>
          </div>
          <div class="card-footer">
            <a href="${item.pptx_file_url}" class="btn-primary" download>
              <i class="fa-solid fa-file-arrow-down"></i>
              <span>Download PPTX</span>
            </a>
          </div>
        `;
      } else if (category === 'icons') {
        // Derive file format label from icon_class (stores ext like PNG, SVG, JPG) or fall back to icon_class
        const rawFmt = (item.icon_class || '').trim();
        // If icon_class looks like a font-awesome class use 'Icon', otherwise treat it as the format
        const isLegacyClass = rawFmt.startsWith('fa-');
        const formatLabel = isLegacyClass ? 'Icon' : (rawFmt || 'Icon');
        
        // Pick appropriate download icon
        let dlIcon = 'fa-solid fa-download';
        if (formatLabel === 'SVG') dlIcon = 'fa-solid fa-bezier-curve';
        else if (['PNG','JPG','JPEG','WEBP','GIF'].includes(formatLabel)) dlIcon = 'fa-solid fa-image';
        else if (formatLabel === 'PDF') dlIcon = 'fa-solid fa-file-pdf';

        // Color code the badge by format
        let badgeColor = '#6554C0'; // default purple
        if (formatLabel === 'SVG') badgeColor = '#00B8D9';
        else if (formatLabel === 'PNG') badgeColor = '#36B37E';
        else if (['JPG','JPEG'].includes(formatLabel)) badgeColor = '#FF8B00';
        else if (formatLabel === 'WEBP') badgeColor = '#6554C0';
        else if (formatLabel === 'PDF') badgeColor = '#FF5630';

        // Render Icon Card (natural square ratio)
        card.innerHTML = cardHTML + `
          <div class="card-media icon-box">
            <img src="${item.file_url}" alt="${item.name}" onerror="this.src='https://placehold.co/200x200/f4f5f7/5e6c84?text=${formatLabel}'">
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="badge type" style="background:${badgeColor};color:#fff;">${formatLabel}</span>
            </div>
            <h4 class="card-title">${item.name}</h4>
            <div class="card-tags">
              ${renderKeywordTags(item.keywords)}
            </div>
          </div>
          <div class="card-footer">
            <a href="${item.file_url}" class="btn-primary secondary" download>
              <i class="${dlIcon}"></i>
              <span>Download ${formatLabel}</span>
            </a>
          </div>
        `;
      } else if (category === 'scientific') {
        // Render Scientific Image Card (contained aspect ratios)
        card.innerHTML = cardHTML + `
          <div class="card-media sci-media">
            <img src="${item.preview_image_url}" alt="${item.title}" onerror="this.src='https://placehold.co/600x338/f4f5f7/5e6c84?text=Diagram'">
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="badge type">Diagram</span>
            </div>
            <h4 class="card-title">${item.title}</h4>
            <div class="card-tags">
              ${renderKeywordTags(item.keywords)}
            </div>
          </div>
          <div class="card-footer">
            <a href="${item.file_url}" class="btn-primary" download>
              <i class="fa-solid fa-image"></i>
              <span>Download Image</span>
            </a>
          </div>
        `;
      } else if (category === 'videos_2d' || category === 'videos_3d') {
        // Render Video Card
        const badgeLabel = category === 'videos_2d' ? '2D Video' : '3D Video';
        card.innerHTML = cardHTML + `
          <div class="card-media video-media" style="background:#000;display:flex;align-items:center;justify-content:center;position:relative;">
            <video src="${item.file_url}" style="width:100%;height:100%;object-fit:cover;" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>
            <i class="fa-solid fa-play" style="position:absolute;color:#fff;font-size:32px;opacity:0.8;pointer-events:none;"></i>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="badge type">${badgeLabel}</span>
            </div>
            <h4 class="card-title">${item.title}</h4>
            <div class="card-tags">
              ${renderKeywordTags(item.keywords)}
            </div>
          </div>
          <div class="card-footer">
            <a href="${item.file_url}" class="btn-primary" download>
              <i class="fa-solid fa-video"></i>
              <span>Download Video</span>
            </a>
          </div>
        `;
      } else if (category === 'slide_decks') {
        // Render Slide Deck Card
        card.innerHTML = cardHTML + `
          <div class="card-media deck-media" style="background:#DEEBFF;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--primary-blue);">
            <i class="fa-solid fa-layer-group" style="font-size:48px;margin-bottom:8px;"></i>
            <span style="font-weight:bold;font-size:12px;">SLIDE DECK</span>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="badge type">Deck</span>
            </div>
            <h4 class="card-title">${item.title}</h4>
            <div class="card-tags">
              ${renderKeywordTags(item.keywords)}
            </div>
          </div>
          <div class="card-footer">
            <a href="${item.pptx_file_url}" class="btn-primary" download>
              <i class="fa-solid fa-file-powerpoint"></i>
              <span>Download PPTX</span>
            </a>
          </div>
        `;
      }

      // Bind 3-dots menu handlers
      const menuTrigger = card.querySelector('.card-menu-trigger');
      const dropdownMenu = card.querySelector('.card-dropdown-menu');
      
      menuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close all other open card dropdowns first
        document.querySelectorAll('.card-dropdown-menu').forEach(menu => {
          if (menu !== dropdownMenu) {
            menu.style.display = 'none';
          }
        });

        const isOpen = dropdownMenu.style.display === 'block';
        dropdownMenu.style.display = isOpen ? 'none' : 'block';
      });

      // Close dropdowns on document click
      document.addEventListener('click', () => {
        dropdownMenu.style.display = 'none';
      });

      // Edit item handler
      card.querySelector('.edit-item-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.style.display = 'none';
        
        // Set currentOpenItem & currentOpenCategory
        currentOpenItem = item;
        currentOpenCategory = category;
        
        openEditResourceModal();
      });

      // Delete item handler
      card.querySelector('.delete-item-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdownMenu.style.display = 'none';

        const confirmDelete = confirm(`Are you sure you want to delete "${item.title || item.name}"? This action cannot be undone.`);
        if (!confirmDelete) return;

        try {
          const response = await fetch(`/api/resources/${category}/${item.id}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            throw new Error('Delete operation failed');
          }

          const resJson = await response.json();
          if (resJson.success) {
            loadData(activeCategory, searchQuery);
          } else {
            alert('Could not delete resource.');
          }
        } catch (err) {
          console.error('Delete error:', err);
          alert('Error deleting resource. Please try again.');
        }
      });

      // Bind checkbox change handler
      const checkbox = card.querySelector('.card-select-checkbox');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          const id = parseInt(e.target.getAttribute('data-id'));
          const type = e.target.getAttribute('data-type');
          
          if (e.target.checked) {
            if (!selectedBulkItems.some(i => i.id === id && i.type === type)) {
              selectedBulkItems.push({ id, type });
            }
            card.classList.add('selected');
          } else {
            selectedBulkItems = selectedBulkItems.filter(i => !(i.id === id && i.type === type));
            card.classList.remove('selected');
          }
          updateBulkActionsBar();
        });
      }

      // Add click listener to launch modal large view (excluding tags, buttons, and actions menu)
      card.addEventListener('click', (e) => {
        if (isBulkSelectMode) {
          // Toggle select
          const chk = card.querySelector('.card-select-checkbox');
          if (chk && e.target !== chk) {
            chk.checked = !chk.checked;
            chk.dispatchEvent(new Event('change'));
          }
          return;
        }
        if (e.target.closest('.tag') || e.target.closest('.btn-primary') || e.target.closest('.card-actions-menu')) {
          return;
        }
        openLargeView(category, item);
      });

      cardsGrid.appendChild(card);
    });

    // Make tags clickable to search
    document.querySelectorAll('.tag').forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const keyword = e.target.getAttribute('data-keyword');
        globalSearch.value = keyword;
        updateClearButtonVisibility();
        searchQuery = keyword;
        loadData(category, keyword);
      });
    });
  }

  // Open Lightbox Modal (Constraining slides strictly to 16:9 widescreen)
  function openLargeView(category, item) {
    currentOpenItem = item;
    currentOpenCategory = category;
    modalPreviewPanel.innerHTML = '';
    modalMetaRow.innerHTML = '';
    modalPreviewPanel.className = 'modal-preview-panel';
    
    if (category === 'templates' || category === 'charts' || category === 'maps') {
      modalPreviewPanel.className = 'modal-preview-panel slide-large';
      modalPreviewPanel.innerHTML = `<img src="${item.preview_image_url}" alt="${item.title}" onerror="this.src='https://placehold.co/600x338/f4f5f7/5e6c84?text=Slide+Preview'">`;
      modalMetaRow.innerHTML = `
        <span class="badge type">${item.slide_type}</span>
        <span class="badge state">${item.state}</span>
      `;
      modalTitle.textContent = item.title;
      modalDescription.textContent = item.description;
      modalDownloadBtn.href = item.pptx_file_url;
      modalDownloadText.textContent = 'Download PPTX Slide';
    } else if (category === 'icons') {
      const title = item.name || item.title;
      const fileUrl = item.file_url || item.pptx_file_url || item.preview_image_url;
      
      const rawFmt = (item.icon_class || '').trim();
      const isLegacyClass = rawFmt.startsWith('fa-');
      const formatLabel = isLegacyClass ? 'Icon' : (rawFmt || 'Icon');

      let badgeColor = '#6554C0';
      if (formatLabel === 'SVG') badgeColor = '#00B8D9';
      else if (formatLabel === 'PNG') badgeColor = '#36B37E';
      else if (['JPG','JPEG'].includes(formatLabel)) badgeColor = '#FF8B00';
      else if (formatLabel === 'WEBP') badgeColor = '#6554C0';
      else if (formatLabel === 'PDF') badgeColor = '#FF5630';

      modalPreviewPanel.className = 'modal-preview-panel icon-large';
      modalPreviewPanel.innerHTML = `<img src="${fileUrl}" alt="${title}" onerror="this.src='https://placehold.co/200x200/f4f5f7/5e6c84?text=${formatLabel}'">`;
      modalMetaRow.innerHTML = `<span class="badge type" style="background:${badgeColor};color:#fff;">${formatLabel}</span>`;
      modalTitle.textContent = title;
      modalDescription.textContent = item.description;
      modalDownloadBtn.href = fileUrl;
      modalDownloadText.textContent = `Download ${formatLabel}`;
    } else if (category === 'scientific') {
      const title = item.title || item.name;
      const fileUrl = item.file_url || item.pptx_file_url || item.preview_image_url;
      const previewUrl = item.preview_image_url || fileUrl;

      modalPreviewPanel.innerHTML = `<img src="${previewUrl}" alt="${title}" onerror="this.src='https://placehold.co/600x338/f4f5f7/5e6c84?text=Diagram'">`;
      modalMetaRow.innerHTML = `<span class="badge type">Scientific Diagram</span>`;
      modalTitle.textContent = title;
      modalDescription.textContent = item.description;
      modalDownloadBtn.href = fileUrl;
      modalDownloadText.textContent = 'Download Scientific Diagram';
    } else if (category === 'videos_2d' || category === 'videos_3d') {
      const badgeLabel = category === 'videos_2d' ? '2D Video' : '3D Video';
      modalPreviewPanel.innerHTML = `
        <video controls autoplay style="width:100%;height:100%;max-height:600px;background:#000;">
          <source src="${item.file_url}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `;
      modalMetaRow.innerHTML = `<span class="badge type">${badgeLabel}</span>`;
      modalTitle.textContent = item.title;
      modalDescription.textContent = item.description;
      modalDownloadBtn.href = item.file_url;
      modalDownloadText.textContent = 'Download Video';
    } else if (category === 'slide_decks') {
      // In the implementation plan, we noted PPTX slide-by-slide is hard.
      // We will embed the PDF if available, else a placeholder.
      const pdfUrl = item.pdf_file_url || item.pptx_file_url;
      
      modalPreviewPanel.innerHTML = `
        <object data="${pdfUrl}" type="application/pdf" width="100%" height="600px">
          <p>Unable to display PDF file. <a href="${pdfUrl}">Download</a> instead.</p>
        </object>
      `;
      modalMetaRow.innerHTML = `<span class="badge type">Slide Deck</span>`;
      modalTitle.textContent = item.title;
      modalDescription.textContent = item.description;
      modalDownloadBtn.href = item.pptx_file_url;
      modalDownloadText.textContent = 'Download PPTX Deck';
    }

    modalTags.innerHTML = renderKeywordTags(item.keywords);

    // Bind modal tag click handlers
    modalTags.querySelectorAll('.tag').forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        const keyword = e.target.getAttribute('data-keyword');
        globalSearch.value = keyword;
        updateClearButtonVisibility();
        searchQuery = keyword;
        closeLargeView();
        loadData(category, keyword);
      });
    });

    largeViewModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // Close Lightbox Modal
  function closeLargeView() {
    largeViewModal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  // Helper keyword tag builder
  function renderKeywordTags(keywords) {
    return keywords
      .split(',')
      .map(kw => kw.trim())
      .filter(kw => kw !== '')
      .map(kw => `<span class="tag" data-keyword="${kw}">${kw}</span>`)
      .join('');
  }

  // Toggle search spinner
  function showSpinner(show) {
    if (show) {
      searchSpinner.style.display = 'block';
      cardsGrid.style.opacity = '0.5';
    } else {
      searchSpinner.style.display = 'none';
      cardsGrid.style.opacity = '1';
    }
  }

  // Toggle search clear visibility
  function updateClearButtonVisibility() {
    if (globalSearch.value.length > 0) {
      clearSearchBtn.style.display = 'flex';
    } else {
      clearSearchBtn.style.display = 'none';
    }
  }

  // Add Resource Modal Submission Handler
  const addResourceModal = document.getElementById('add-resource-modal');
  const openAddResourceBtn = document.getElementById('open-add-resource-btn');
  const closeAddResourceBtn = document.getElementById('close-add-resource-btn');
  const cancelAddResourceBtn = document.getElementById('cancel-add-resource-btn');
  const addResourceForm = document.getElementById('add-resource-form');
  const resourceType = document.getElementById('resource-type');
  const titleLabel = document.getElementById('title-label');
  const resourceTitle = document.getElementById('resource-title');
  const keywordPickerContainer = document.getElementById('keyword-picker-container');
  const resourceKeywordsInput = document.getElementById('resource-keywords');

  // File Upload Elements
  const fileDropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('file-input');
  const fileSelectedList = document.getElementById('file-selected-list');
  const dropzoneIcon = fileDropzone.querySelector('.dropzone-icon');
  const dropzonePrompt = document.getElementById('dropzone-prompt');

  let selectedKeywords = [];
  let selectedFiles = [];

  // Validate files list based on selected category type (prevent images in PPTX groups)
  function validateUploadedFiles(files, categoryType) {
    const isPptxGroup = ['templates', 'charts', 'maps'].includes(categoryType);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const isImage = ['.png', '.jpg', '.jpeg', '.svg'].includes(fileExt);
      if (isPptxGroup && isImage) {
        return {
          valid: false,
          message: 'You cannot upload images in this group. Please change the format to PPTX and then upload.'
        };
      }
    }
    return { valid: true };
  }

  // Handle files selection
  function handleFilesSelected(filesList) {
    if (!filesList || filesList.length === 0) return;
    
    const categoryType = resourceType.value;
    const validation = validateUploadedFiles(filesList, categoryType);
    if (!validation.valid) {
      alert(validation.message);
      fileInput.value = '';
      return;
    }
    
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
        selectedFiles.push(file);
      }
    }
    renderSelectedFilesList();
    fileInput.setCustomValidity('');
  }

  // Render list of selected files
  function renderSelectedFilesList() {
    if (selectedFiles.length === 0) {
      dropzoneIcon.style.display = 'block';
      dropzonePrompt.style.display = 'block';
      fileSelectedList.style.display = 'none';
      fileSelectedList.innerHTML = '';
      return;
    }
    dropzoneIcon.style.display = 'none';
    dropzonePrompt.style.display = 'none';
    fileSelectedList.style.display = 'flex';
    fileSelectedList.innerHTML = '';

    selectedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-selected-item';
      item.innerHTML = `
        <i class="fa-solid fa-file-circle-check"></i>
        <span class="file-name">${file.name}</span>
        <button type="button" class="remove-file-btn" data-index="${index}" title="Remove file">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;
      item.querySelector('.remove-file-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleFileRemovedAtIndex(index);
      });
      fileSelectedList.appendChild(item);
    });
  }

  // Handle individual file removal
  function handleFileRemovedAtIndex(index) {
    selectedFiles.splice(index, 1);
    renderSelectedFilesList();
    if (selectedFiles.length === 0) {
      fileInput.value = '';
    }
  }

  // Handle file removal
  function handleFileRemoved() {
    selectedFiles = [];
    fileInput.value = '';
    dropzoneIcon.style.display = 'block';
    dropzonePrompt.style.display = 'block';
    if (fileSelectedList) {
      fileSelectedList.style.display = 'none';
      fileSelectedList.innerHTML = '';
    }
  }

  // File Dropzone Drag & Drop events
  ['dragenter', 'dragover'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileDropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileDropzone.classList.remove('dragover');
    }, false);
  });

  fileDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  });

  // Clicking on dropzone opens browser file selector
  fileDropzone.addEventListener('click', (e) => {
    if (e.target.closest('.remove-file-btn')) {
      return;
    }
    fileInput.click();
  });

  // File input change event
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFilesSelected(fileInput.files);
    }
  });

  // Reset form inputs and selections
  function resetAddResourceForm() {
    addResourceForm.reset();
    selectedKeywords = [];
    keywordPickerContainer.querySelectorAll('.p-chip').forEach(chip => {
      chip.classList.remove('selected');
    });
    resourceKeywordsInput.value = '';
    handleFileRemoved();
    
    // Defaults: Slide type active
    titleLabel.textContent = '2. Slide Title';
    resourceTitle.placeholder = 'Enter slide title...';
  }

  // Reset Edit Form
  function resetEditResourceForm() {
    editResourceForm.reset();
    editSelectedKeywords = [];
    editKeywordPickerContainer.querySelectorAll('.p-chip').forEach(chip => {
      chip.classList.remove('selected');
    });
    
    // Remove custom tags added in previous edit session
    const defaultKeywords = ['map', 'california', 'texas', 'guidelines', 'finance', 'metrics', 'growth', 'biology', 'science', 'global', 'tech'];
    editKeywordPickerContainer.querySelectorAll('.p-chip').forEach(chip => {
      const kw = chip.getAttribute('data-keyword');
      if (!defaultKeywords.includes(kw)) {
        chip.remove();
      }
    });
    editResourceKeywordsInput.value = '';
    editCustomKeywordInput.value = '';
  }

  // Populate and Open Edit Modal
  function openEditResourceModal() {
    if (!currentOpenItem || !currentOpenCategory) return;
    
    resetEditResourceForm();

    const item = currentOpenItem;
    const category = currentOpenCategory;

    // Set IDs and types
    editResourceIdInput.value = item.id;
    editResourceOldTypeInput.value = category;
    editResourceTypeSelect.value = category;

    // Trigger select change handler to update label placeholder
    editResourceTypeSelect.dispatchEvent(new Event('change'));

    // Set Title
    editResourceTitleInput.value = item.title || item.name;

    // Set Keywords
    const keywordsList = item.keywords.split(',').map(kw => kw.trim()).filter(kw => kw !== '');
    keywordsList.forEach(keyword => {
      const rawVal = keyword.toLowerCase();
      editSelectedKeywords.push(rawVal);

      // Check if chip already exists
      let chip = editKeywordPickerContainer.querySelector(`.p-chip[data-keyword="${rawVal}"]`);
      if (!chip) {
        // Create custom chip dynamically
        chip = document.createElement('span');
        chip.className = 'p-chip';
        chip.setAttribute('data-keyword', rawVal);
        chip.textContent = rawVal;
        editKeywordPickerContainer.appendChild(chip);
      }
      chip.classList.add('selected');
    });

    updateEditKeywordsInput();

    // Hide Lightbox and show Edit Modal
    closeLargeView();
    editResourceModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // Close Edit Modal
  function closeEditResourceModal() {
    editResourceModal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  // Helper to update hidden edit keywords input validity
  function updateEditKeywordsInput() {
    const keywordsStr = editSelectedKeywords.join(', ');
    editResourceKeywordsInput.value = keywordsStr;
    
    if (editSelectedKeywords.length > 0) {
      editResourceKeywordsInput.setCustomValidity('');
    } else {
      editResourceKeywordsInput.setCustomValidity('Please select at least one keyword.');
    }
  }

  // Custom Keyword Addition for Edit Form
  function addEditCustomKeyword() {
    const rawVal = editCustomKeywordInput.value.trim().toLowerCase();
    if (!rawVal) return;
    
    let existingChip = editKeywordPickerContainer.querySelector(`.p-chip[data-keyword="${rawVal}"]`);
    if (existingChip) {
      if (!existingChip.classList.contains('selected')) {
        existingChip.classList.add('selected');
        editSelectedKeywords.push(rawVal);
        updateEditKeywordsInput();
      }
      editCustomKeywordInput.value = '';
      return;
    }
    
    const newChip = document.createElement('span');
    newChip.className = 'p-chip selected';
    newChip.setAttribute('data-keyword', rawVal);
    newChip.textContent = rawVal;
    
    editKeywordPickerContainer.appendChild(newChip);
    editSelectedKeywords.push(rawVal);
    updateEditKeywordsInput();
    
    editCustomKeywordInput.value = '';
  }

  // Toggle field visibility depending on selected type
  resourceType.addEventListener('change', () => {
    const type = resourceType.value;

    // Check compatibility of already selected files if they exist
    if (selectedFiles.length > 0) {
      const validation = validateUploadedFiles(selectedFiles, type);
      if (!validation.valid) {
        alert(validation.message);
        handleFileRemoved(); // reset files
      }
    }

    if (type === 'templates' || type === 'charts' || type === 'maps') {
      titleLabel.textContent = '2. Slide Title';
      resourceTitle.placeholder = 'Enter slide title...';
    } else {
      if (type === 'icons') {
        titleLabel.textContent = '2. Icon Name';
        resourceTitle.placeholder = 'Enter icon name...';
      } else {
        titleLabel.textContent = '2. Image Title';
        resourceTitle.placeholder = 'Enter scientific image title...';
      }
    }
  });

  // Open modal click handler
  openAddResourceBtn.addEventListener('click', () => {
    resetAddResourceForm();
    addResourceModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  });

  // Close modal
  function closeAddResourceModal() {
    addResourceModal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  closeAddResourceBtn.addEventListener('click', closeAddResourceModal);
  cancelAddResourceBtn.addEventListener('click', closeAddResourceModal);
  addResourceModal.addEventListener('click', (e) => {
    if (e.target === addResourceModal) {
      closeAddResourceModal();
    }
  });

  // Helper to update hidden keywords input validity
  function updateKeywordsInput() {
    const keywordsStr = selectedKeywords.join(', ');
    resourceKeywordsInput.value = keywordsStr;
    
    if (selectedKeywords.length > 0) {
      resourceKeywordsInput.setCustomValidity('');
    } else {
      resourceKeywordsInput.setCustomValidity('Please select at least one keyword.');
    }
  }

  // Keywords chip selection via Event Delegation (to support dynamically added chips)
  keywordPickerContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.p-chip');
    if (!chip) return;
    
    const keyword = chip.getAttribute('data-keyword');
    if (chip.classList.contains('selected')) {
      chip.classList.remove('selected');
      selectedKeywords = selectedKeywords.filter(kw => kw !== keyword);
    } else {
      chip.classList.add('selected');
      selectedKeywords.push(keyword);
    }
    
    updateKeywordsInput();
  });

  // Custom Keyword Addition handlers
  const customKeywordInput = document.getElementById('custom-keyword-input');
  const addCustomKeywordBtn = document.getElementById('add-custom-keyword-btn');

  function addCustomKeyword() {
    const rawVal = customKeywordInput.value.trim().toLowerCase();
    if (!rawVal) return;
    
    // Check if chip already exists
    let existingChip = keywordPickerContainer.querySelector(`.p-chip[data-keyword="${rawVal}"]`);
    if (existingChip) {
      if (!existingChip.classList.contains('selected')) {
        existingChip.classList.add('selected');
        selectedKeywords.push(rawVal);
        updateKeywordsInput();
      }
      customKeywordInput.value = '';
      return;
    }
    
    // Create new chip element
    const newChip = document.createElement('span');
    newChip.className = 'p-chip selected';
    newChip.setAttribute('data-keyword', rawVal);
    newChip.textContent = rawVal;
    
    keywordPickerContainer.appendChild(newChip);
    
    // Add to selected array and update validity
    selectedKeywords.push(rawVal);
    updateKeywordsInput();
    
    customKeywordInput.value = '';
  }

  addCustomKeywordBtn.addEventListener('click', addCustomKeyword);
  customKeywordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomKeyword();
    }
  });

  // Form submission
  addResourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedKeywords.length === 0) {
      resourceKeywordsInput.setCustomValidity('Please select at least one keyword.');
      addResourceForm.reportValidity();
      return;
    }

    const type = resourceType.value;
    const validation = validateUploadedFiles(selectedFiles, type);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    if (selectedFiles.length === 0) {
      fileInput.setCustomValidity('Please upload or drop at least one file.');
      addResourceForm.reportValidity();
      return;
    }

    const formData = new FormData();
    formData.append('type', type);
    formData.append('title', resourceTitle.value.trim());
    formData.append('keywords', resourceKeywordsInput.value);
    
    // Append each selected file
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Save operation failed');
      }

      const resJson = await response.json();
      if (resJson.success) {
        closeAddResourceModal();
        
        // Auto-switch view tab to matching subcategory
        activeCategory = type;
        sidebarMenuItems.forEach(item => {
          if (item.getAttribute('data-category') === activeCategory) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });

        updateCategoryView(activeCategory);
      } else {
        alert('Could not save resource.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('Error submitting form. Please verify network and server.');
    }
  });

  // User Profile Dropdown and Login/Logout handling
  const userProfileMenu = document.getElementById('user-profile-menu');
  const profileTrigger = document.getElementById('profile-trigger');
  const profileDropdown = document.getElementById('profile-dropdown');
  const authActionBtn = document.getElementById('auth-action-btn');
  const headerLoginBtn = document.getElementById('header-login-btn');

  // Toggle profile dropdown
  profileTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = profileDropdown.style.display === 'block';
    profileDropdown.style.display = isOpen ? 'none' : 'block';
    userProfileMenu.classList.toggle('open', !isOpen);
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!userProfileMenu.contains(e.target)) {
      profileDropdown.style.display = 'none';
      userProfileMenu.classList.remove('open');
    }
  });

  // Handle Log Out
  authActionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.style.display = 'none';
    userProfileMenu.classList.remove('open');
    localStorage.removeItem('slide_library_user');
    updateAuthView(null);
  });

  // Execute App
  init();
});
