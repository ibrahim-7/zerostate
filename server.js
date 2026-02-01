const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const archiver = require('archiver');

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
  // First, handle special cases with consecutive capitals (OTP, API, etc.)
  str = str.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2');
  
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase())
    .replace(/^./, (chr) => chr.toLowerCase())
    // Handle consecutive capitals: phoneOTP -> phoneOtp
    .replace(/([a-z])([A-Z]+)([A-Z][a-z])/g, (match, lower, caps, capLower) => {
      return lower + caps.charAt(0).toUpperCase() + caps.slice(1).toLowerCase() + capLower;
    })
    .replace(/([a-z])([A-Z]+)$/g, (match, lower, caps) => {
      return lower + caps.charAt(0).toUpperCase() + caps.slice(1).toLowerCase();
    });
}

function toCleanVariableName(str) {
  // Remove special characters except spaces and alphanumeric
  let cleaned = str.replace(/[^a-zA-Z0-9\s]/g, ' ');
  
  // Handle consecutive capitals (OTP, API, etc.)
  cleaned = cleaned.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  
  return cleaned
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      // First word is lowercase
      if (index === 0) {
        return word.toLowerCase();
      }
      // Subsequent words: capitalize first letter, lowercase rest
      // But handle all-caps words (OTP, API) specially
      if (word.length <= 3 && word === word.toUpperCase()) {
        // Short all-caps: OTP -> Otp, API -> Api
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
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
import 'package:mechanica/constants/app_errors.dart';
import 'package:mechanica/controller/base_controller.dart';
import 'package:dio/dio.dart';
import 'auth_repo.dart';

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
    
    final result = await callApi<Response>(
      () => ${repoName}.${functionName}Repo(${paramNames}),
    );
    
    setLoading(false);
    
    if (!result.isSuccess) {
      errorMsg = result.errorMessage ?? AppErrors.generalError;
      update();
      return;
    }
    
    final response = result.data;
    if (response?.data["type"] == "success") {
      final data = response?.data["data"];
      // TODO: Handle successful response data
      update();
    } else {
      errorMsg = response?.data["message"] ?? AppErrors.generalError;
      update();
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
  const repoClassName = toPascalCase(folderName) + 'Repo';
  
  let code = `import 'package:get/get.dart';
import 'package:mechanica/constants/app_errors.dart';
import 'package:mechanica/controller/base_controller.dart';
import 'package:dio/dio.dart';
import '${toSmallCamelCase(folderName)}_repo.dart';

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
    
    final result = await callApi<Response>(
      () => ${repoName}.${functionName}Repo(${paramNames}),
    );
    
    setLoading(false);
    
    if (!result.isSuccess) {
      errorMsg = result.errorMessage ?? AppErrors.generalError;
      update();
      return;
    }
    
    final response = result.data;
    if (response?.data["type"] == "success") {
      final data = response?.data["data"];
      // TODO: Handle successful response data
      update();
    } else {
      errorMsg = response?.data["message"] ?? AppErrors.generalError;
      update();
    }
  }

`;
  });
  
  code += `}\n`;
  return code;
}

function generateRepositoryForFolder(folderName, apis) {
  const className = toPascalCase(folderName) + 'Repo';
  
  let code = `import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:mechanica/constants/app_urls.dart';
import 'package:mechanica/data/apis/api_client.dart';
import 'package:mechanica/data/models/network/api_response_model.dart';

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
    
    let apiMethod = 'get';
    if (method === 'post') apiMethod = 'post';
    else if (method === 'put') apiMethod = 'put';
    else if (method === 'delete') apiMethod = 'delete';
    else if (method === 'patch') apiMethod = 'patch';
    
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
  Future<ApiResponse<Response>> ${functionName}Repo(${params}) async {${bodyJson}
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

app.post('/generate', async (req, res) => {
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
    
    // Core files
    generatedFiles['core/base_controller.dart'] = `import 'package:get/get.dart' hide Response;
import 'package:mechanica/controller/api_controller.dart';
import 'package:mechanica/data/models/network/api_response_model.dart';

abstract class BaseController extends GetxController {
  ApiController get apiController => Get.find<ApiController>();

  Future<ApiResponse<T>> callApi<T>(Future<ApiResponse<T>> Function() apiCall) {
    return apiController.safeApiCall(apiCall);
  }
}
`;
    
    generatedFiles['core/api_controller.dart'] = `import 'package:flutter/material.dart';
import 'package:get/get.dart' hide Response;
import 'package:mechanica/constants/app_colors.dart';
import 'package:mechanica/constants/app_errors.dart';
import 'package:mechanica/constants/app_routes.dart';
import 'package:mechanica/controller/auth_controller.dart';
import 'package:mechanica/data/models/network/api_response_model.dart';

class ApiController extends GetxController {
  final AuthController authController;

  ApiController({required this.authController});

  Future<ApiResponse<T>> safeApiCall<T>(
    Future<ApiResponse<T>> Function() apiCall,
  ) async {
    final result = await apiCall();

    if (!result.isSuccess && result.forceLogout) {
      await _handleForceLogout();
    }

    return result;
  }

  Future<void> _handleForceLogout() async {
    await authController.clearSession();
    if (Get.currentRoute != AppRoutes.login) {
      Get.offAllNamed(AppRoutes.login);
      if (Get.isSnackbarOpen) Get.closeCurrentSnackbar();

      Future.microtask(
        () => Get.snackbar(
          "Error",
          AppErrors.unauthorized,
          backgroundColor: AppColors.warning,
          icon: const Icon(Icons.lock_outline, color: Colors.white),
          colorText: Colors.white,
          margin: const EdgeInsets.all(16),
        ),
      );
    }
  }
}
`;

    generatedFiles['core/api_client.dart'] = `import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get/get.dart' hide Response;
import 'package:mechanica/constants/app_errors.dart';
import 'package:mechanica/constants/app_urls.dart';
import 'package:mechanica/constants/storage_keys.dart';
import 'package:mechanica/controller/services/app_meta_service.dart';
import 'package:mechanica/data/models/network/api_response_model.dart';
import 'package:mechanica/data/models/network/custom_api_exception.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

class ApiClient {
  late Dio _dio;
  final FlutterSecureStorage storage;
  Completer<void>? _refreshCompleter;

  ApiClient({required this.storage}) {
    _dio = _createDio();
  }

  Dio _createDio() {
    final meta = Get.find<AppMetaService>();

    final dio = Dio(
      BaseOptions(
        baseUrl: AppUrls.baseApiUrl,
        connectTimeout: const Duration(seconds: 10),
        sendTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        validateStatus: (s) => s != null && s >= 200 && s < 400,
        headers: {
          "Content-Type": "application/json",
          "X-App-Version": meta.version,
          "X-App-Build-Number": meta.build,
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.extra['requiresAuth'] != false) {
            final token = await storage.read(key: StorageKeys.accessToken);
            if (token?.isNotEmpty == true) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 498 &&
              error.requestOptions.extra['retry'] != true) {
            try {
              final response = await _retryWithRefreshToken(
                error.requestOptions,
              );
              return handler.resolve(response);
            } catch (_) {
              return handler.reject(
                DioException(
                  requestOptions: error.requestOptions,
                  error: CustomApiException(statusCode: 401, forceLogout: true),
                ),
              );
            }
          }

          _logToSentry(error);
          handler.next(error);
        },
      ),
    );

    return dio;
  }

  Future<ApiResponse<Response>> get(String uri, {bool requiresAuth = true}) =>
      _safeCall(
        () => _dio.get(
          uri,
          options: Options(extra: {'requiresAuth': requiresAuth}),
        ),
      );

  Future<ApiResponse<Response>> post(
    String uri, {
    dynamic body,
    bool requiresAuth = true,
  }) =>
      _safeCall(
        () => _dio.post(
          uri,
          data: body,
          options: Options(extra: {'requiresAuth': requiresAuth}),
        ),
      );

  Future<ApiResponse<Response>> put(
    String uri, {
    dynamic body,
    bool requiresAuth = true,
  }) =>
      _safeCall(
        () => _dio.put(
          uri,
          data: body,
          options: Options(extra: {'requiresAuth': requiresAuth}),
        ),
      );

  Future<ApiResponse<Response>> delete(
    String uri, {
    bool requiresAuth = true,
  }) =>
      _safeCall(
        () => _dio.delete(
          uri,
          options: Options(extra: {'requiresAuth': requiresAuth}),
        ),
      );

  Future<ApiResponse<Response>> patch(
    String uri, {
    dynamic body,
    bool requiresAuth = true,
  }) =>
      _safeCall(
        () => _dio.patch(
          uri,
          data: body,
          options: Options(extra: {'requiresAuth': requiresAuth}),
        ),
      );

  Future<ApiResponse<Response>> _safeCall(
    Future<Response> Function() request,
  ) async {
    try {
      final response = await request();

      if (response.statusCode == 401) {
        return const ApiResponse.error(
          errorMessage: AppErrors.unauthorized,
          statusCode: 401,
          forceLogout: true,
        );
      }

      if (response.data?['type'] == 'error') {
        return ApiResponse.error(
          errorMessage: response.data?['message'] ?? AppErrors.generalError,
          statusCode: response.statusCode,
        );
      }

      return ApiResponse.success(response);
    } on DioException catch (e) {
      if (e.error is CustomApiException) {
        final ex = e.error as CustomApiException;
        return ApiResponse.error(
          errorMessage: AppErrors.unauthorized,
          statusCode: ex.statusCode,
          forceLogout: ex.forceLogout,
        );
      }

      return ApiResponse.error(
        errorMessage: _mapDioError(e),
        statusCode: e.response?.statusCode,
      );
    } on SocketException {
      return const ApiResponse.error(errorMessage: AppErrors.noInternet);
    } catch (e, st) {
      Sentry.captureException(e, stackTrace: st);
      return const ApiResponse.error(errorMessage: AppErrors.generalError);
    }
  }

  String _mapDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return AppErrors.timeout;
      case DioExceptionType.connectionError:
        return AppErrors.serverError;
      default:
        return AppErrors.generalError;
    }
  }

  Future<Response> _retryWithRefreshToken(RequestOptions requestOptions) async {
    _refreshCompleter ??= Completer<void>();
    if (_refreshCompleter!.isCompleted) {
      await _refreshCompleter!.future;
      return _dio.fetch(requestOptions);
    }

    try {
      final refreshToken = await storage.read(key: StorageKeys.refreshToken);

      if (refreshToken?.isEmpty ?? true) {
        throw CustomApiException(statusCode: 401, forceLogout: true);
      }

      final response = await _dio.request(
        requestOptions.path,
        data: requestOptions.data,
        options: Options(
          method: requestOptions.method,
          headers: {'X-Refresh-Token': refreshToken},
          extra: {'retry': true},
        ),
      );

      await storage.write(
        key: StorageKeys.accessToken,
        value: response.headers.value('X-New-Access-Token'),
      );

      await storage.write(
        key: StorageKeys.refreshToken,
        value: response.headers.value('X-New-Refresh-Token'),
      );

      _refreshCompleter!.complete();
      return response;
    } catch (e) {
      _refreshCompleter!.completeError(e);
      rethrow;
    } finally {
      _refreshCompleter = null;
    }
  }

  void _logToSentry(DioException e) {
    Sentry.captureException(e, stackTrace: e.stackTrace);
  }
}
`;
    
    // Models
    generatedFiles['models/api_response_model.dart'] = `class ApiResponse<T> {
  final T? data;
  final String? errorMessage;
  final int? statusCode;
  final bool forceLogout;

  const ApiResponse.success(this.data)
      : errorMessage = null,
        statusCode = null,
        forceLogout = false;

  const ApiResponse.error({
    required this.errorMessage,
    this.statusCode,
    this.forceLogout = false,
  }) : data = null;

  bool get isSuccess => data != null;
}
`;

    generatedFiles['models/response_model.dart'] = `class ResponseModel {
  final bool _isSuccess;
  final String _message;
  final dynamic _data;
  
  ResponseModel(this._isSuccess, this._message, [this._data]);

  String get message => _message;
  bool get isSuccess => _isSuccess;
  dynamic get data => _data;

  Map<String, dynamic> toJson() => {
        "isSuccess": _isSuccess,
        "message": _message,
        "data": _data,
      };
}
`;

    generatedFiles['models/custom_api_exception.dart'] = `class CustomApiException implements Exception {
  final int statusCode;
  final bool forceLogout;

  CustomApiException({
    required this.statusCode,
    this.forceLogout = false,
  });

  @override
  String toString() => 'CustomApiException(statusCode: \$statusCode, forceLogout: \$forceLogout)';
}
`;

    // App URLs
    const appUrlsCode = generateAppUrlsFile(apis);
    generatedFiles['constants/app_urls.dart'] = appUrlsCode;
    
    // Controllers and Repositories
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
        ? 'auth_repo.dart'
        : `${toSmallCamelCase(folderName)}_repo.dart`;
      
      generatedFiles[`controllers/${controllerFileName}`] = controllerCode;
      generatedFiles[`repositories/${repositoryFileName}`] = repositoryCode;
    });
    
    const generatedCount = Object.keys(folders).length;
    
    // Create ZIP file
    const timestamp = Date.now();
    const zipFileName = `zerostate_generated_${timestamp}.zip`;
    const zipPath = path.join(__dirname, 'uploads', zipFileName);
    
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`ZIP created: ${archive.pointer()} bytes`);
      
      // Send ZIP file
      res.download(zipPath, zipFileName, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Clean up ZIP file after download
        fs.unlink(zipPath, (unlinkErr) => {
          if (unlinkErr) console.error('Cleanup error:', unlinkErr);
        });
      });
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(output);
    
    // Add all files to ZIP with proper folder structure
    Object.keys(generatedFiles).forEach(filePath => {
      archive.append(generatedFiles[filePath], { name: filePath });
    });
    
    archive.finalize();
    
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