// Global state
let apisData = [];
let filteredApis = [];
let selectedApis = new Set();

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const searchInput = document.getElementById('searchInput');
const apiList = document.getElementById('apiList');
const statsCard = document.getElementById('statsCard');
const generateCard = document.getElementById('generateCard');
const controls = document.getElementById('controls');

// Initialize event listeners
function initializeEventListeners() {
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => handleDragOver(e, uploadArea));
  uploadArea.addEventListener('dragleave', () => handleDragLeave(uploadArea));
  uploadArea.addEventListener('drop', (e) => handleDrop(e, uploadArea, upload));
  fileInput.addEventListener('change', upload);
  searchInput.addEventListener('input', handleSearch);
}

function handleDragOver(e, element) {
  e.preventDefault();
  element.classList.add('dragging');
}

function handleDragLeave(element) {
  element.classList.remove('dragging');
}

function handleDrop(e, element, callback) {
  e.preventDefault();
  element.classList.remove('dragging');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const input = element.querySelector('input');
    if (input) {
      input.files = files;
      callback();
    }
  }
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  filteredApis = apisData.filter(api => 
    api.name.toLowerCase().includes(query) || 
    api.url.toLowerCase().includes(query)
  );
  renderApis(filteredApis);
}

async function upload() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a file");
    return;
  }

  showLoading();

  const formData = new FormData();
  formData.append("collection", file);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    apisData = data.apis || [];
    filteredApis = [...apisData];
    selectedApis.clear();
    
    apisData.forEach(api => {
      api.config = {
        isOpenApi: false,
        hasPagination: false,
        generateCustomModel: false
      };
    });

    renderApis(apisData);
    updateStats(apisData);
    showControls();
    
  } catch (error) {
    console.error('Upload error:', error);
    showError(error.message);
  }
}

function showLoading() {
  apiList.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Processing collection...</p>
    </div>
  `;
}

function showError(message) {
  apiList.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">❌</div>
      <h3>Upload Failed</h3>
      <p>${message}</p>
    </div>
  `;
}

function showControls() {
  statsCard.classList.remove('hidden');
  generateCard.classList.remove('hidden');
  controls.classList.remove('hidden');
}

function updateStats(apis) {
  const stats = apis.reduce((acc, api) => {
    const method = api.method.toLowerCase();
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {});

  document.getElementById('totalApis').textContent = apis.length;
  document.getElementById('getCount').textContent = stats.get || 0;
  document.getElementById('postCount').textContent = stats.post || 0;
  document.getElementById('putCount').textContent = stats.put || 0;
  document.getElementById('deleteCount').textContent = stats.delete || 0;
}

function renderApis(apis) {
  if (apis.length === 0) {
    apiList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>No APIs Found</h3>
        <p>Try adjusting your search query</p>
      </div>
    `;
    updateDeleteButton();
    return;
  }

  apiList.innerHTML = "";

  apis.forEach((api, index) => {
    const card = createApiCard(api, index);
    apiList.appendChild(card);
  });
  
  updateDeleteButton();
}

function createApiCard(api, index) {
  const card = document.createElement("div");
  card.className = "api-card";
  card.id = `api-${index}`;
  
  const wasExpanded = document.getElementById(`api-${index}`)?.classList.contains('expanded');
  const isSelected = selectedApis.has(index);

  let cleanUrl = api.url || '';
  if (cleanUrl.startsWith('undefined://')) {
    cleanUrl = cleanUrl.replace('undefined://', '');
  }
  if (cleanUrl.includes('{{')) {
    cleanUrl = cleanUrl.replace(/\{\{[^}]+\}\}/g, '');
  }

  let bodyKeysHtml = '';
  if (api.bodyKeys && api.bodyKeys.length > 0) {
    const paramCount = api.bodyKeys.length;
    const paramsList = api.bodyKeys.map((key, idx) => {
      const type = api.paramTypes && api.paramTypes[key] ? api.paramTypes[key] : 'String';
      return `<div class="param-item">
        <span class="param-number">${idx + 1})</span>
        <span class="param-type">${type}</span>
        <span class="param-separator">:</span>
        <span class="param-name">${key}</span>
      </div>`;
    }).join('');
    
    bodyKeysHtml = `
      <div class="body-keys">
        <div class="body-keys-title">REQUEST BODY PARAMETERS (${paramCount} ${paramCount === 1 ? 'parameter' : 'parameters'})</div>
        <div class="params-list">
          ${paramsList}
        </div>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="api-header" onclick="toggleCard(${index})">
      <div class="api-header-left">
        <div class="api-title">
          <input type="checkbox" class="api-checkbox" ${isSelected ? 'checked' : ''} onclick="toggleSelection(event, ${index})" />
          <span class="method-badge method-${api.method.toLowerCase()}">${api.method}</span>
          <span>${api.name} ${api.folder ? `<span style="color: #667eea; font-size: 12px;">[${api.folder}]</span>` : ''}</span>
        </div>
        <div class="api-url">${cleanUrl}</div>
      </div>
      <div class="api-header-right">
        <span class="expand-icon">▼</span>
      </div>
    </div>
    <div class="api-body">
      <div class="config-grid">
        <div class="config-group">
          <h4>API Configuration</h4>
          <label class="checkbox-label">
            <input type="checkbox" ${api.config?.isOpenApi ? 'checked' : ''} data-api="${index}" data-field="isOpenApi" onchange="updateConfig(this)">
            <span>Open API (No Auth Required)</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" ${api.config?.hasPagination ? 'checked' : ''} data-api="${index}" data-field="hasPagination" onchange="updateConfig(this)">
            <span>Has Pagination</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" ${api.config?.generateCustomModel ? 'checked' : ''} data-api="${index}" data-field="generateCustomModel" onchange="updateConfigWithRerender(this, ${index})">
            <span>Generate Custom Response Model</span>
          </label>
        </div>
      </div>

      ${api.config?.generateCustomModel ? `
        <div class="full-width-section">
          <div class="form-group">
            <label>Custom Response Model Structure (JSON)</label>
            <textarea 
              data-api="${index}" 
              data-field="customResponseModel" 
              onchange="updateConfig(this)"
              placeholder='Enter your success response structure here'>${api.config?.customResponseModel || ''}</textarea>
          </div>
        </div>
      ` : ''}

      ${bodyKeysHtml}
    </div>
  `;
  
  if (wasExpanded) {
    card.classList.add('expanded');
  }
  
  if (isSelected) {
    card.classList.add('selected');
  }

  return card;
}

function toggleSelection(event, index) {
  event.stopPropagation();
  
  if (selectedApis.has(index)) {
    selectedApis.delete(index);
    document.getElementById(`api-${index}`).classList.remove('selected');
  } else {
    selectedApis.add(index);
    document.getElementById(`api-${index}`).classList.add('selected');
  }
  
  updateDeleteButton();
}

function updateDeleteButton() {
  let deleteBtn = document.getElementById('deleteSelectedBtn');
  
  if (selectedApis.size > 0) {
    if (!deleteBtn) {
      deleteBtn = document.createElement('button');
      deleteBtn.id = 'deleteSelectedBtn';
      deleteBtn.className = 'btn btn-delete-multi';
      deleteBtn.onclick = deleteSelected;
      
      const controlsDiv = document.querySelector('.controls');
      if (controlsDiv) {
        const bulkActions = document.createElement('div');
        bulkActions.className = 'bulk-actions';
        bulkActions.id = 'bulkActions';
        bulkActions.appendChild(deleteBtn);
        controlsDiv.appendChild(bulkActions);
      }
    }
    deleteBtn.textContent = `🗑️ Delete Selected (${selectedApis.size})`;
    deleteBtn.style.display = 'block';
  } else {
    if (deleteBtn) {
      deleteBtn.style.display = 'none';
    }
  }
}

function deleteSelected() {
  if (selectedApis.size === 0) return;
  
  if (confirm(`Are you sure you want to delete ${selectedApis.size} API(s)?`)) {
    const indicesToDelete = Array.from(selectedApis).sort((a, b) => b - a);
    
    indicesToDelete.forEach(index => {
      const apiToDelete = filteredApis[index];
      const originalIndex = apisData.indexOf(apiToDelete);
      if (originalIndex > -1) {
        apisData.splice(originalIndex, 1);
      }
      filteredApis.splice(index, 1);
    });
    
    selectedApis.clear();
    renderApis(filteredApis);
    updateStats(apisData);
    
    if (apisData.length === 0) {
      statsCard.classList.add('hidden');
      generateCard.classList.add('hidden');
      controls.classList.add('hidden');
    }
  }
}

function toggleCard(index) {
  const card = document.getElementById(`api-${index}`);
  card.classList.toggle('expanded');
}

function updateConfig(element) {
  const apiIndex = parseInt(element.dataset.api);
  const field = element.dataset.field;
  const value = element.type === 'checkbox' ? element.checked : element.value;
  
  if (!filteredApis[apiIndex].config) {
    filteredApis[apiIndex].config = {};
  }
  
  filteredApis[apiIndex].config[field] = value;
  
  console.log(`Updated API ${apiIndex} - ${field}:`, value);
}

function updateConfigWithRerender(element, index) {
  updateConfig(element);
  
  const card = createApiCard(filteredApis[index], index);
  document.getElementById(`api-${index}`).replaceWith(card);
}

async function generateCode() {
  console.log('Generating GetX Controllers and Repositories...');
  
  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        apis: apisData 
      })
    });

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.files) {
      Object.keys(result.files).forEach(filename => {
        downloadFile(filename, result.files[filename]);
      });
      
      alert(`✨ ${result.message}\nFiles downloaded successfully!`);
    }
    
    console.log('Generation result:', result);
    
  } catch (error) {
    console.error('Generation error:', error);
    alert(`Generation failed: ${error.message}`);
  }
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', initializeEventListeners);