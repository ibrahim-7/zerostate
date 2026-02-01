const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Helper Functions
function toSmallCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase())
    .replace(/^./, (chr) => chr.toLowerCase());
}

function toCleanVariableName(str) {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

function parameterToCamelCase(paramName) {
  return paramName
    .split('_')
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase())
    .replace(/^./, (chr) => chr.toUpperCase());
}

function cleanUrl(url) {
  let cleaned = url.replace(/\{\{[^}]+\}\}/g, '');
  if (cleaned.startsWith('undefined://')) {
    cleaned = cleaned.replace('undefined://', '');
  }
  cleaned = cleaned.replace(/^\/+/, '');
  return cleaned;
}

function extractEndpoint(url) {
  const cleaned = cleanUrl(url);
  
  if (cleaned.includes('http://') || cleaned.includes('https://')) {
    try {
      const urlObj = new URL(cleaned);
      return urlObj.pathname.replace(/^\//, '');
    } catch (e) {
      return cleaned;
    }
  }
  
  return cleaned;
}

function detectDartType(value, key = '') {
  if (value === null || value === undefined) {
    return 'dynamic';
  }

  const type = typeof value;
  const keyLower = key.toLowerCase();

  if (keyLower.includes('id') && type === 'number') {
    return 'int';
  }
  if (keyLower.includes('price') || keyLower.includes('amount') || keyLower.includes('total')) {
    return 'double';
  }
  if (keyLower.includes('phone') || keyLower.includes('mobile')) {
    return 'String';
  }
  if (keyLower.includes('email')) {
    return 'String';
  }
  if (keyLower.includes('is_') || keyLower.includes('has_')) {
    return 'bool';
  }

  if (type === 'string') {
    return 'String';
  }
  
  if (type === 'number') {
    if (Number.isInteger(value)) {
      return 'int';
    }
    return 'double';
  }
  
  if (type === 'boolean') {
    return 'bool';
  }
  
  if (Array.isArray(value)) {
    if (value.length > 0) {
      const firstItemType = detectDartType(value[0]);
      return `List<${firstItemType}>`;
    }
    return 'List<dynamic>';
  }
  
  if (type === 'object') {
    return 'Map<String, dynamic>';
  }
  
  return 'dynamic';
}

function analyzeBodyParameters(bodyKeys, bodyRaw) {
  const paramTypes = {};
  const camelCaseKeys = {};
  
  try {
    let bodyJson = null;
    
    if (bodyRaw) {
      const cleanedBody = bodyRaw.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const jsonMatch = cleanedBody.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          bodyJson = JSON.parse(jsonMatch[0]);
        } catch (e) {
          // Couldn't parse
        }
      }
    }
    
    bodyKeys.forEach(key => {
      const camelKey = parameterToCamelCase(key);
      camelCaseKeys[key] = camelKey;
      
      if (bodyJson && bodyJson.hasOwnProperty(key)) {
        paramTypes[camelKey] = detectDartType(bodyJson[key], key);
      } else {
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('id')) {
          paramTypes[camelKey] = 'int';
        } else if (keyLower.includes('price') || keyLower.includes('amount') || keyLower.includes('total') || keyLower.includes('lat') || keyLower.includes('long')) {
          paramTypes[camelKey] = 'double';
        } else if (keyLower.includes('is_') || keyLower.includes('has_') || keyLower.includes('verified')) {
          paramTypes[camelKey] = 'bool';
        } else if (keyLower.includes('hours') || keyLower.includes('services') || keyLower.includes('expenses') || keyLower.includes('items')) {
          paramTypes[camelKey] = 'Map<String, dynamic>';
        } else {
          paramTypes[camelKey] = 'String';
        }
      }
    });
  } catch (e) {
    bodyKeys.forEach(key => {
      const camelKey = parameterToCamelCase(key);
      camelCaseKeys[key] = camelKey;
      paramTypes[camelKey] = 'String';
    });
  }
  
  return { paramTypes, camelCaseKeys };
}

function parsePostmanCollection(collectionData) {
  const folders = {};
  
  function extractApis(items, folderName = 'Default') {
    items.forEach(item => {
      if (item.item) {
        extractApis(item.item, item.name);
      } else if (item.request) {
        const method = item.request.method || 'GET';
        const name = item.name || 'Unnamed API';
        let url = '';
        
        if (typeof item.request.url === 'string') {
          url = item.request.url;
        } else if (item.request.url && item.request.url.raw) {
          url = item.request.url.raw;
        }
        
        const bodyKeys = [];
        let bodyRaw = '';
        
        if (item.request.body && item.request.body.raw) {
          bodyRaw = item.request.body.raw;
          try {
            const bodyJson = JSON.parse(bodyRaw);
            bodyKeys.push(...Object.keys(bodyJson));
          } catch (e) {
            const raw = item.request.body.raw;
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const cleanJson = jsonMatch[0].replace(/\/\/.*/g, '');
                const bodyJson = JSON.parse(cleanJson);
                bodyKeys.push(...Object.keys(bodyJson));
              } catch (e2) {
                // Still couldn't parse
              }
            }
          }
        }
        
        const { paramTypes, camelCaseKeys } = analyzeBodyParameters(bodyKeys, bodyRaw);
        const endpoint = extractEndpoint(url);
        const hasAuth = collectionData.auth && collectionData.auth.type === 'bearer';
        
        if (!folders[folderName]) {
          folders[folderName] = [];
        }
        
        folders[folderName].push({
          name,
          method,
          url,
          endpoint,
          bodyKeys,
          paramTypes,
          camelCaseKeys,
          folder: folderName,
          hasAuth
        });
      }
    });
  }
  
  if (collectionData.item) {
    extractApis(collectionData.item);
  }
  
  return folders;
}

function generateAuthController(apis) {
  const repoName = 'authRepo';
  const repoClassName = 'AuthRepo';
  
  let code = `import 'package:get/get.dart';
import 'package:hudood/constants/app_errors.dart';
import 'package:hudood/controllers/base_controller.dart';
import 'auth_repository.dart';

class AuthController extends BaseController {
  final ${repoClassName} ${repoName};
  
  AuthController({required this.${repoName}});
  
  bool isLoading = false;
  String? errorMsg;
  
  void setLoading(bool val) {
    isLoading = val;
    update();
  }
  
  @override
  void onInit() {
    super.onInit();
  }
  
`;

  apis.forEach((api) => {
    const functionName = toSmallCamelCase(api.name);
    
    const params = api.bodyKeys.map(key => {
      const camelKey = parameterToCamelCase(key);
      const type = api.paramTypes[camelKey] || 'String';
      return `${type} ${camelKey}`;
    }).join(', ');
    
    const paramNames = api.bodyKeys.map(key => parameterToCamelCase(key)).join(', ');
    
    code += `  // ${api.name} - ${api.method}
  Future<void> ${functionName}(${params}) async {
    setLoading(true);
    errorMsg = null;
    try {
      final response = await callApi(
        () => ${repoName}.${functionName}Repo(${paramNames}),
      );
      if (response == null) {
        errorMsg = AppErrors.serverError;
        return;
      }
      if (response.statusCode == 200 && response.data["type"] == "success") {
        final data = response.data["data"];
        // TODO: Handle successful response data
        update();
      } else {
        errorMsg = response.data["message"] ?? "Unexpected error occurred";
        update();
      }
    } catch (e) {
      errorMsg = e.toString();
      update();
    } finally {
      setLoading(false);
    }
  }

`;
  });
  
  code += `}\n`;
  return code;
}

function generateControllerForFolder(folderName, apis) {
  const className = toPascalCase(folderName) + 'Controller';
  const repoName = toSmallCamelCase(folderName) + 'Repo';
  const repoClassName = toPascalCase(folderName) + 'Repository';
  
  let code = `import 'package:get/get.dart';
import 'package:hudood/constants/app_errors.dart';
import 'package:hudood/controllers/base_controller.dart';
import '${toSmallCamelCase(folderName)}_repository.dart';

class ${className} extends BaseController {
  final ${repoClassName} ${repoName};
  
  ${className}({required this.${repoName}});
  
  bool isLoading = false;
  String? errorMsg;
  
  void setLoading(bool val) {
    isLoading = val;
    update();
  }
  
  @override
  void onInit() {
    super.onInit();
  }
  
`;

  apis.forEach((api) => {
    const functionName = toSmallCamelCase(api.name);
    
    const params = api.bodyKeys.map(key => {
      const camelKey = parameterToCamelCase(key);
      const type = api.paramTypes[camelKey] || 'String';
      return `${type} ${camelKey}`;
    }).join(', ');
    
    const paramNames = api.bodyKeys.map(key => parameterToCamelCase(key)).join(', ');
    
    code += `  // ${api.name} - ${api.method}
  Future<void> ${functionName}(${params}) async {
    setLoading(true);
    errorMsg = null;
    try {
      final response = await callApi(
        () => ${repoName}.${functionName}Repo(${paramNames}),
      );
      if (response == null) {
        errorMsg = AppErrors.serverError;
        return;
      }
      if (response.statusCode == 200 && response.data["type"] == "success") {
        final data = response.data["data"];
        // TODO: Handle successful response data
        update();
      } else {
        errorMsg = response.data["message"] ?? "Unexpected error occurred";
        update();
      }
    } catch (e) {
      errorMsg = e.toString();
      update();
    } finally {
      setLoading(false);
    }
  }

`;
  });
  
  code += `}\n`;
  return code;
}

function generateRepositoryForFolder(folderName, apis) {
  const className = toPascalCase(folderName) + 'Repository';
  
  let code = `import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:hudood/constants/app_urls.dart';
import 'package:hudood/data/apis/api_client.dart';

class ${className} {
  final ApiClient apiClient;
  
  ${className}({required this.apiClient});
  
`;

  const usedNames = new Set();

  apis.forEach((api) => {
    const functionName = toSmallCamelCase(api.name);
    
    const params = api.bodyKeys.map(key => {
      const camelKey = parameterToCamelCase(key);
      const type = api.paramTypes[camelKey] || 'String';
      return `${type} ${camelKey}`;
    }).join(', ');
    
    const method = api.method.toLowerCase();
    
    let bodyJson = '';
    if (api.bodyKeys.length > 0) {
      const bodyObj = api.bodyKeys.map(key => {
        const camelKey = parameterToCamelCase(key);
        return `      "${key}": ${camelKey}`;
      }).join(',\n');
      bodyJson = `
    final data = jsonEncode({
${bodyObj}
    });`;
    }
    
    let apiMethod = 'getData';
    if (method === 'post') apiMethod = 'postData';
    else if (method === 'put') apiMethod = 'putData';
    else if (method === 'delete') apiMethod = 'deleteData';
    else if (method === 'patch') apiMethod = 'patchData';
    
    let cleanName = toCleanVariableName(api.name);
    if (!cleanName) {
      cleanName = api.method.toLowerCase() + 'Api';
    }
    
    let urlConstant = cleanName + 'ApiUrl';
    let counter = 1;
    while (usedNames.has(urlConstant)) {
      urlConstant = cleanName + counter + 'ApiUrl';
      counter++;
    }
    usedNames.add(urlConstant);
    
    const cleanedUrl = cleanUrl(api.url);
    
    const authParam = api.config?.isOpenApi === true ? '\n      requiresAuth: false,' : '';
    
    code += `  // ${api.name} - ${api.method} ${cleanedUrl}
  Future<Response> ${functionName}Repo(${params}) async{${bodyJson}
    return await apiClient.${apiMethod}(
      AppUrls.${urlConstant},${api.bodyKeys.length > 0 ? '\n      body: data,' : ''}${authParam}
    );
  }

`;
  });
  
  code += `}\n`;
  return code;
}

function generateAppUrlsFile(apis) {
  let baseUrl = '';
  if (apis.length > 0) {
    const firstUrl = cleanUrl(apis[0].url);
    if (firstUrl.includes('http://') || firstUrl.includes('https://')) {
      try {
        const urlObj = new URL(firstUrl);
        baseUrl = urlObj.origin;
      } catch (e) {
        baseUrl = '';
      }
    }
  }
  
  let code = `class AppUrls {
  // Base URL
  static const String baseApiUrl = "${baseUrl ? baseUrl + '/' : ''}";
  
  // API Endpoints
`;

  const usedNames = new Set();

  apis.forEach(api => {
    let cleanName = toCleanVariableName(api.name);
    
    if (!cleanName) {
      cleanName = api.method.toLowerCase() + 'Api';
    }
    
    let urlConstant = cleanName + 'ApiUrl';
    let counter = 1;
    while (usedNames.has(urlConstant)) {
      urlConstant = cleanName + counter + 'ApiUrl';
      counter++;
    }
    usedNames.add(urlConstant);
    
    const endpoint = api.endpoint;
    code += `  static const String ${urlConstant} = "\${baseApiUrl}${endpoint}";\n`;
  });
  
  code += `}\n`;
  return code;
}

app.post('/upload', upload.single('collection'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const collectionData = JSON.parse(fileContent);
    
    const folders = parsePostmanCollection(collectionData);
    
    const apis = [];
    Object.keys(folders).forEach(folderName => {
      folders[folderName].forEach(api => {
        apis.push(api);
      });
    });
    
    fs.unlinkSync(filePath);
    
    res.json({ apis });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/generate', (req, res) => {
  try {
    const { apis } = req.body;
    
    if (!apis || !Array.isArray(apis)) {
      return res.status(400).json({ error: 'Invalid APIs data' });
    }

    const folders = {};
    apis.forEach(api => {
      const folderName = api.folder || 'Default';
      
      if (folderName.toLowerCase() === 'base') {
        return;
      }
      
      if (!folders[folderName]) {
        folders[folderName] = [];
      }
      folders[folderName].push(api);
    });

    const generatedFiles = {};
    
    generatedFiles['base_controller.dart'] = `import 'package:dio/src/response.dart' show Response;
import 'package:get/get.dart' hide Response;
import 'package:hudood/controllers/api_controller.dart';

class BaseController extends GetxController {
  ApiController get apiController => Get.find<ApiController>();

  Future<Response?> callApi(Future<Response> Function() apiCall) {
    return apiController.safeApiCall(apiCall);
  }
}
`;
    
    const appUrlsCode = generateAppUrlsFile(apis);
    generatedFiles['app_urls.dart'] = appUrlsCode;
    
    Object.keys(folders).forEach(folderName => {
      const folderApis = folders[folderName];
      
      const isAuthFolder = folderName.toLowerCase() === 'users';
      
      const controllerCode = isAuthFolder 
        ? generateAuthController(folderApis)
        : generateControllerForFolder(folderName, folderApis);
        
      const repositoryCode = generateRepositoryForFolder(folderName, folderApis);
      
      const controllerFileName = isAuthFolder 
        ? 'auth_controller.dart'
        : `${toSmallCamelCase(folderName)}_controller.dart`;
        
      const repositoryFileName = isAuthFolder
        ? 'auth_repository.dart'
        : `${toSmallCamelCase(folderName)}_repository.dart`;
      
      generatedFiles[controllerFileName] = controllerCode;
      generatedFiles[repositoryFileName] = repositoryCode;
    });
    
    const generatedCount = Object.keys(folders).length;
    
    res.json({
      success: true,
      files: generatedFiles,
      message: `Generated ${generatedCount} controller(s), ${generatedCount} repository(ies), base_controller.dart, and app_urls.dart`
    });
  } catch (error) {
    console.error('Error generating code:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`
╔════════════════════════════════════════╗
║     🚀 ZeroState Server Running        ║
╠════════════════════════════════════════╣
║  URL: http://localhost:${port}        ║
║  Status: ✅ Ready to generate code     ║
╚════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});