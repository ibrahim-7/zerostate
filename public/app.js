// Global state
let apisData = [];
let filteredApis = [];
let sampleCodeFiles = [];

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
  // Postman Collection Upload
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => handleDragOver(e, uploadArea));
  uploadArea.addEventListener('dragleave', () => handleDragLeave(uploadArea));
  uploadArea.addEventListener('drop', (e) => handleDrop(e, uploadArea, upload));
  fileInput.addEventListener('change', upload);

  // Search functionality
  searchInput.addEventListener('input', handleSearch);
  
  // Load sample code files list
  loadSampleCodeFiles();
}

// Load Sample Code Files from server
async function loadSampleCodeFiles() {
  try {
    const response = await fetch('/api/sample-files');
    if (response.ok) {
      sampleCodeFiles = await response.json();
      console.log('Sample code files loaded:', sampleCodeFiles);
    }
  } catch (error) {
    console.error('Error loading sample files:', error);
    // Fallback to default file list if API is not available
    sampleCodeFiles = [
      { name: 'api_client.dart', path: 'sample_code/api_client.dart', category: 'Core' },
      { name: 'api_response.dart', path: 'sample_code/api_response.dart', category: 'Core' },
      { name: 'user_repository.dart', path: 'sample_code/user_repository.dart', category: 'Repository' },
      { name: 'user_controller.dart', path: 'sample_code/user_controller.dart', category: 'Controller' },
      { name: 'user_model.dart', path: 'sample_code/user_model.dart', category: 'Model' },
      { name: 'base_controller.dart', path: 'sample_code/base_controller.dart', category: 'Core' },
      { name: 'base_repository.dart', path: 'sample_code/base_repository.dart', category: 'Core' },
    ];
  }
}

// Open Structure View in New Tab
async function openStructureView() {
  // Ensure files are loaded
  if (sampleCodeFiles.length === 0) {
    await loadSampleCodeFiles();
  }

  const structureWindow = window.open('', '_blank', 'width=1200,height=800');
  
  structureWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GetX Code Structure - ZeroState</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          min-height: 100vh;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }
        h1 {
          color: #1a202c;
          font-size: 32px;
        }
        .close-btn {
          background: #f56565;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(245, 101, 101, 0.4);
        }
        .close-btn:hover {
          background: #e53e3e;
        }
        .file-selector {
          margin-bottom: 24px;
          background: #f7fafc;
          padding: 20px;
          border-radius: 12px;
        }
        .file-selector label {
          display: block;
          color: #2d3748;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .file-selector select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          transition: all 0.3s;
        }
        .file-selector select:focus {
          outline: none;
          border-color: #667eea;
        }
        .file-info {
          background: #edf2f7;
          padding: 12px 16px;
          border-radius: 8px;
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .file-info-left {
          color: #4a5568;
          font-size: 14px;
        }
        .category-badge {
          background: #667eea;
          color: white;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        .code-container {
          margin-top: 24px;
        }
        .code-header {
          background: #2d3748;
          color: white;
          padding: 16px 20px;
          border-radius: 8px 8px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .code-header h3 {
          font-size: 16px;
          font-weight: 600;
        }
        .copy-btn {
          background: #48bb78;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.3s;
        }
        .copy-btn:hover {
          background: #38a169;
        }
        pre {
          background: #1a202c;
          color: #e2e8f0;
          padding: 24px;
          border-radius: 0 0 8px 8px;
          overflow-x: auto;
          font-size: 14px;
          line-height: 1.6;
          margin: 0;
          max-height: 600px;
          overflow-y: auto;
        }
        code {
          font-family: 'Courier New', monospace;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #667eea;
        }
        .spinner {
          border: 4px solid #e2e8f0;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .error-message {
          background: #fed7d7;
          color: #742a2a;
          padding: 16px;
          border-radius: 8px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 ZeroState - Sample Code Structure</h1>
          <button class="close-btn" onclick="window.close()">✕ Close</button>
        </div>
        
        <div class="file-selector">
          <label for="fileSelect">📁 Select File to View:</label>
          <select id="fileSelect" onchange="loadFileContent()">
            <option value="">-- Choose a sample file --</option>
          </select>
          <div id="fileInfo" style="display: none;" class="file-info">
            <span class="file-info-left" id="filePath"></span>
            <span class="category-badge" id="fileCategory"></span>
          </div>
        </div>
        
        <div id="codeContainer"></div>
      </div>

      <script>
        const sampleFiles = ${JSON.stringify(sampleCodeFiles)};
        
        // Populate dropdown
        const fileSelect = document.getElementById('fileSelect');
        
        // Group files by category
        const categories = {};
        sampleFiles.forEach(file => {
          if (!categories[file.category]) {
            categories[file.category] = [];
          }
          categories[file.category].push(file);
        });
        
        // Add options grouped by category
        Object.keys(categories).sort().forEach(category => {
          const optgroup = document.createElement('optgroup');
          optgroup.label = category;
          
          categories[category].forEach(file => {
            const option = document.createElement('option');
            option.value = file.path;
            option.textContent = file.name;
            option.dataset.category = file.category;
            option.dataset.name = file.name;
            optgroup.appendChild(option);
          });
          
          fileSelect.appendChild(optgroup);
        });
        
        async function loadFileContent() {
          const select = document.getElementById('fileSelect');
          const selectedPath = select.value;
          const codeContainer = document.getElementById('codeContainer');
          const fileInfo = document.getElementById('fileInfo');
          const filePath = document.getElementById('filePath');
          const fileCategory = document.getElementById('fileCategory');
          
          if (!selectedPath) {
            codeContainer.innerHTML = '';
            fileInfo.style.display = 'none';
            return;
          }
          
          // Show file info
          const selectedOption = select.options[select.selectedIndex];
          filePath.textContent = selectedPath;
          fileCategory.textContent = selectedOption.dataset.category;
          fileInfo.style.display = 'flex';
          
          // Show loading
          codeContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading file...</p></div>';
          
          try {
            const response = await fetch('/api/sample-file?path=' + encodeURIComponent(selectedPath));
            
            if (!response.ok) {
              throw new Error('Failed to load file');
            }
            
            const content = await response.text();
            
            codeContainer.innerHTML = \`
              <div class="code-container">
                <div class="code-header">
                  <h3>\${selectedOption.dataset.name}</h3>
                  <button class="copy-btn" onclick="copyCode()">📋 Copy Code</button>
                </div>
                <pre><code id="codeContent">\${escapeHtml(content)}</code></pre>
              </div>
            \`;
          } catch (error) {
            codeContainer.innerHTML = \`
              <div class="error-message">
                ❌ Error loading file: \${error.message}
              </div>
            \`;
          }
        }
        
        function copyCode() {
          const codeContent = document.getElementById('codeContent');
          const textArea = document.createElement('textarea');
          textArea.value = codeContent.textContent;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          
          const copyBtn = document.querySelector('.copy-btn');
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        }
        
        function escapeHtml(text) {
          const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
          };
          return text.replace(/[&<>"']/g, m => map[m]);
        }
      </script>
    </body>
    </html>
  `);
}

// Drag and Drop Handlers
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

// Search Handler
function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  filteredApis = apisData.filter(api => 
    api.name.toLowerCase().includes(query) || 
    api.url.toLowerCase().includes(query)
  );
  renderApis(filteredApis);
}

// Upload Function
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
    
    // Initialize default config for each API
    apisData.forEach(api => {
      api.config = {
        isOpen: false,
        hasPagination: false,
        generateRepo: true,
        generateController: true,
        generateCustomModel: false,
        responseType: 'object',
        successKey: 'data',
        customResponseModel: ''
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

// Loading State
function showLoading() {
  apiList.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Processing collection...</p>
    </div>
  `;
}

// Error State
function showError(message) {
  apiList.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">❌</div>
      <h3>Upload Failed</h3>
      <p>${message}</p>
    </div>
  `;
}

// Show Controls
function showControls() {
  statsCard.classList.remove('hidden');
  generateCard.classList.remove('hidden');
  controls.classList.remove('hidden');
}

// Update Statistics
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

// Render APIs
function renderApis(apis) {
  if (apis.length === 0) {
    apiList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>No APIs Found</h3>
        <p>Try adjusting your search query</p>
      </div>
    `;
    return;
  }

  apiList.innerHTML = "";

  apis.forEach((api, index) => {
    const card = createApiCard(api, index);
    apiList.appendChild(card);
  });
}

// Create API Card
function createApiCard(api, index) {
  const card = document.createElement("div");
  card.className = "api-card";
  card.id = `api-${index}`;

  // Clean the URL to remove "undefined://" prefix
  let cleanUrl = api.url || '';
  if (cleanUrl.startsWith('undefined://')) {
    cleanUrl = cleanUrl.replace('undefined://', '');
  }
  if (cleanUrl.includes('{{')) {
    cleanUrl = cleanUrl.replace(/\{\{[^}]+\}\}/g, '');
  }

  const bodyKeysHtml = api.bodyKeys && api.bodyKeys.length > 0 ? `
    <div class="body-keys">
      <div class="body-keys-title">REQUEST BODY PARAMETERS</div>
      ${api.bodyKeys.join(', ')}
    </div>
  ` : '';

  card.innerHTML = `
    <div class="api-header" onclick="toggleCard(${index})">
      <div class="api-header-left">
        <div class="api-title">
          <span class="method-badge method-${api.method.toLowerCase()}">${api.method}</span>
          <span>${api.name}</span>
        </div>
        <div class="api-url">${cleanUrl}</div>
      </div>
      <div class="api-header-right">
        <button class="btn btn-delete" onclick="deleteApi(event, ${index})">🗑️ Delete</button>
        <span class="expand-icon">▼</span>
      </div>
    </div>
    <div class="api-body">
      <div class="config-grid">
        <div class="config-group">
          <h4>API Type</h4>
          <label class="checkbox-label">
            <input type="checkbox" ${api.config?.isOpen ? 'checked' : ''} data-api="${index}" data-field="isOpen" onchange="updateConfig(this)">
            <span>Open API (No Auth)</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" ${api.config?.hasPagination ? 'checked' : ''} data-api="${index}" data-field="hasPagination" onchange="updateConfig(this)">
            <span>Has Pagination</span>
          </label>
        </div>

        <div class="config-group">
          <h4>Code Generation</h4>
          <label class="checkbox-label">
            <input type="checkbox" ${api.config?.generateRepo ? 'checked' : ''} data-api="${index}" data-field="generateRepo" onchange="updateConfig(this)">
            <span>Generate Repository</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" ${api.config?.generateController ? 'checked' : ''} data-api="${index}" data-field="generateController" onchange="updateConfig(this)">
            <span>Generate Controller</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" ${api.config?.generateCustomModel ? 'checked' : ''} data-api="${index}" data-field="generateCustomModel" onchange="updateConfig(this)">
            <span>Generate Custom Response Model</span>
          </label>
        </div>

        <div class="config-group">
          <div class="form-group">
            <label>Response Type</label>
            <select data-api="${index}" data-field="responseType" onchange="updateConfig(this)">
              <option value="object" ${api.config?.responseType === 'object' ? 'selected' : ''}>Object (JSON {})</option>
              <option value="list" ${api.config?.responseType === 'list' ? 'selected' : ''}>List (Array [])</option>
              <option value="primitive" ${api.config?.responseType === 'primitive' ? 'selected' : ''}>Primitive (String/Int/Bool)</option>
              <option value="unknown" ${api.config?.responseType === 'unknown' ? 'selected' : ''}>Unknown/Dynamic</option>
            </select>
          </div>

          <div class="form-group">
            <label>Success Key Path</label>
            <input type="text" value="${api.config?.successKey || 'data'}" data-api="${index}" data-field="successKey" onchange="updateConfig(this)" placeholder="e.g., data, result, payload" />
          </div>
        </div>
      </div>

      <div class="full-width-section">
        <div class="form-group">
          <label>Custom Response Model Structure (JSON)</label>
          <textarea 
            data-api="${index}" 
            data-field="customResponseModel" 
            onchange="updateConfig(this)"
            placeholder='Enter your success response structure here, e.g.:
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}'>${api.config?.customResponseModel || ''}</textarea>
        </div>
      </div>

      ${bodyKeysHtml}
    </div>
  `;

  return card;
}

// Toggle Card Expansion
function toggleCard(index) {
  const card = document.getElementById(`api-${index}`);
  card.classList.toggle('expanded');
}

// Delete API
function deleteApi(event, index) {
  event.stopPropagation();
  
  if (confirm('Are you sure you want to delete this API?')) {
    const apiToDelete = filteredApis[index];
    const originalIndex = apisData.indexOf(apiToDelete);
    if (originalIndex > -1) {
      apisData.splice(originalIndex, 1);
    }
    
    filteredApis.splice(index, 1);
    
    renderApis(filteredApis);
    updateStats(apisData);
    
    if (apisData.length === 0) {
      statsCard.classList.add('hidden');
      generateCard.classList.add('hidden');
      controls.classList.add('hidden');
    }
  }
}

// Update Configuration
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

// Generate Code
async function generateCode() {
  console.log('Generating code with configuration:', apisData);
  
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
    
    alert('✨ Code generation completed successfully! Check your project folder.');
    console.log('Generation result:', result);
    
  } catch (error) {
    console.error('Generation error:', error);
    alert(`Generation failed: ${error.message}`);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeEventListeners);