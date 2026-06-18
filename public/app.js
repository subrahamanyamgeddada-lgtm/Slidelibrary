// SlideLibrary Repository Client Logic

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let activeCategory = 'templates'; // Default active category
  let searchQuery = '';
  let debounceTimer;

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

  // Suggestion Chips by category
  const suggestionData = {
    templates: ['template', 'deck', 'corporate', 'presentation', 'business'],
    charts: ['chart', 'diagram', 'metrics', 'finance', 'revenue', '3-pointer', 'guidelines'],
    maps: ['map', 'california', 'texas', 'geography', 'national'],
    icons: ['growth', 'chart', 'dna', 'science', 'global', 'tech'],
    scientific: ['cell', 'biology', 'solar system', 'space', 'brain', 'neuron']
  };

  // Maps category tabs to backend API URLs
  const categoryApis = {
    templates: '/api/slides',
    charts: '/api/slides',
    maps: '/api/slides',
    icons: '/api/icons',
    scientific: '/api/scientific_images'
  };

  // Initial setup
  function init() {
    setupEventListeners();
    updateCategoryView(activeCategory);
  }

  // Bind interaction events
  function setupEventListeners() {
    // Sidebar category navigation
    sidebarMenuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const menuItem = e.currentTarget;
        const category = menuItem.getAttribute('data-category');
        
        sidebarMenuItems.forEach(mi => mi.classList.remove('active'));
        menuItem.classList.add('active');

        activeCategory = category;
        globalSearch.value = '';
        updateClearButtonVisibility();
        updateCategoryView(category);
      });
    });

    // Global search input (debounced search-on-type)
    globalSearch.addEventListener('input', () => {
      updateClearButtonVisibility();
      clearTimeout(debounceTimer);
      searchQuery = globalSearch.value.trim();
      
      debounceTimer = setTimeout(() => {
        loadData(activeCategory, searchQuery);
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
      if (e.key === 'Escape' && largeViewModal.style.display === 'flex') {
        closeLargeView();
      }
    });
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

      // Structure card layout depending on item type
      if (category === 'templates' || category === 'charts' || category === 'maps') {
        // Render Slide Card (strict 16:9 ratio)
        card.innerHTML = `
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
        // Render Icon Card (natural square ratio)
        card.innerHTML = `
          <div class="card-media icon-box">
            <img src="${item.file_url}" alt="${item.name}" onerror="this.src='https://placehold.co/200x200/f4f5f7/5e6c84?text=Icon'">
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span class="badge type">Vector Icon</span>
            </div>
            <h4 class="card-title">${item.name}</h4>
            <div class="card-tags">
              ${renderKeywordTags(item.keywords)}
            </div>
          </div>
          <div class="card-footer">
            <a href="${item.file_url}" class="btn-primary secondary" download>
              <i class="fa-solid fa-download"></i>
              <span>Download SVG</span>
            </a>
          </div>
        `;
      } else if (category === 'scientific') {
        // Render Scientific Image Card (contained aspect ratios)
        card.innerHTML = `
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
      }

      // Add click listener to launch modal large view (excluding tags and buttons)
      card.addEventListener('click', (e) => {
        if (e.target.closest('.tag') || e.target.closest('.btn-primary')) {
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
      modalPreviewPanel.className = 'modal-preview-panel icon-large';
      modalPreviewPanel.innerHTML = `<img src="${item.file_url}" alt="${item.name}" onerror="this.src='https://placehold.co/200x200/f4f5f7/5e6c84?text=Icon'">`;
      modalMetaRow.innerHTML = `<span class="badge type">Vector SVG Icon</span>`;
      modalTitle.textContent = item.name;
      modalDescription.textContent = item.description;
      modalDownloadBtn.href = item.file_url;
      modalDownloadText.textContent = 'Download Vector SVG';
    } else if (category === 'scientific') {
      modalPreviewPanel.innerHTML = `<img src="${item.preview_image_url}" alt="${item.title}" onerror="this.src='https://placehold.co/600x338/f4f5f7/5e6c84?text=Diagram'">`;
      modalMetaRow.innerHTML = `<span class="badge type">Scientific Diagram</span>`;
      modalTitle.textContent = item.title;
      modalDescription.textContent = item.description;
      modalDownloadBtn.href = item.file_url;
      modalDownloadText.textContent = 'Download Scientific Diagram';
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
  const fileSelectedInfo = document.getElementById('file-selected-info');
  const selectedFilename = document.getElementById('selected-filename');
  const removeFileBtn = document.getElementById('remove-file-btn');
  const dropzoneIcon = fileDropzone.querySelector('.dropzone-icon');
  const dropzonePrompt = document.getElementById('dropzone-prompt');

  let selectedKeywords = [];
  let selectedFile = null;

  // Handle file selection
  function handleFileSelected(file) {
    if (!file) return;
    selectedFile = file;
    selectedFilename.textContent = file.name;
    
    // Update UI elements
    dropzoneIcon.style.display = 'none';
    dropzonePrompt.style.display = 'none';
    fileSelectedInfo.style.display = 'flex';
    
    // Clear custom validation message if set
    fileInput.setCustomValidity('');
  }

  // Handle file removal
  function handleFileRemoved() {
    selectedFile = null;
    fileInput.value = '';
    
    // Update UI elements
    dropzoneIcon.style.display = 'block';
    dropzonePrompt.style.display = 'block';
    fileSelectedInfo.style.display = 'none';
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
      handleFileSelected(files[0]);
    }
  });

  // Clicking on dropzone opens browser file selector
  fileDropzone.addEventListener('click', (e) => {
    if (e.target.closest('#remove-file-btn')) {
      return;
    }
    fileInput.click();
  });

  // File input change event
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  // Remove file button
  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleFileRemoved();
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

  // Toggle field visibility depending on selected type
  resourceType.addEventListener('change', () => {
    const type = resourceType.value;
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

    if (!selectedFile) {
      fileInput.setCustomValidity('Please upload or drop a file.');
      addResourceForm.reportValidity();
      return;
    }

    const formData = new FormData();
    const type = resourceType.value;
    formData.append('type', type);
    formData.append('title', resourceTitle.value.trim());
    formData.append('keywords', resourceKeywordsInput.value);
    formData.append('file', selectedFile);

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
    userProfileMenu.style.display = 'none';
    headerLoginBtn.style.display = 'flex';
  });

  // Handle Log In
  headerLoginBtn.addEventListener('click', () => {
    headerLoginBtn.style.display = 'none';
    userProfileMenu.style.display = 'block';
  });

  // Execute App
  init();
});
