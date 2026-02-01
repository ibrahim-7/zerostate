# ZeroState - Flutter API Code Generator

## 📋 Architecture Overview

### ✅ NO Try-Catch Required in Controllers!

**Why?** Because `ApiClient._safeCall()` handles ALL exceptions:
- ✅ DioException
- ✅ SocketException  
- ✅ Generic Exception
- ✅ Returns `ApiResponse` with error states

Controllers just check `result.isSuccess` - clean and simple!

---

## 🏗️ Project Structure

```
generated_code/
├── controllers/          # All controller files
│   ├── auth_controller.dart
│   └── *_controller.dart
├── repositories/         # All repository files
│   ├── auth_repository.dart
│   └── *_repository.dart
├── core/                 # Core infrastructure
│   ├── api_client.dart
│   ├── api_controller.dart
│   └── base_controller.dart
├── models/               # Data models
│   ├── api_response_model.dart
│   ├── response_model.dart
│   └── custom_api_exception.dart
└── constants/
    └── app_urls.dart     # All API endpoints
```

---

## 🔄 Data Flow

```
UI Layer (Widget)
    ↓
Controller (extends BaseController)
    ↓ callApi<Response>()
ApiController.safeApiCall()
    ↓
Repository
    ↓ returns ApiResponse<Response>
ApiClient._safeCall()
    ↓ handles ALL exceptions
Returns ApiResponse<Response>
```

---

## 📦 Core Components

### 1. **ApiResponse<T>**
```dart
class ApiResponse<T> {
  final T? data;
  final String? errorMessage;
  final int? statusCode;
  final bool forceLogout;
  
  bool get isSuccess => data != null;
}
```

### 2. **ApiClient**
- Returns `ApiResponse<Response>` for all methods
- Handles ALL exceptions in `_safeCall()`
- Token refresh on 498 status
- Force logout on 401 status
- Sentry logging

### 3. **BaseController**
```dart
abstract class BaseController extends GetxController {
  Future<ApiResponse<T>> callApi<T>(
    Future<ApiResponse<T>> Function() apiCall
  );
}
```

### 4. **ApiController**
- Checks `forceLogout` flag
- Handles session clearing
- Shows error snackbar
- Navigates to login

---

## 💡 Controller Pattern (NO Try-Catch!)

```dart
Future<void> login(String email, String password) async {
  setLoading(true);
  errorMsg = null;
  
  final result = await callApi<Response>(
    () => authRepo.loginRepo(email, password),
  );
  
  setLoading(false);
  
  // Check success
  if (!result.isSuccess) {
    errorMsg = result.errorMessage ?? AppErrors.generalError;
    update();
    return;
  }
  
  // Handle success
  final response = result.data;
  if (response?.data["type"] == "success") {
    final data = response?.data["data"];
    // TODO: Process data
    update();
  } else {
    errorMsg = response?.data["message"] ?? AppErrors.generalError;
    update();
  }
}
```

**Notice**: 
- ✅ NO try-catch block
- ✅ Clean and readable
- ✅ All errors handled by ApiClient
- ✅ Just check `isSuccess`

---

## 🔐 Error Handling Hierarchy

```
ApiClient._safeCall()
  ├── DioException → ApiResponse.error()
  ├── SocketException → ApiResponse.error(noInternet)
  ├── CustomApiException → ApiResponse.error(forceLogout: true)
  └── Generic Exception → ApiResponse.error() + Sentry

ApiController.safeApiCall()
  └── if forceLogout: clear session + navigate to login

Controller
  └── if !isSuccess: show error message
```

---

## 🚀 Usage Example

### Repository
```dart
Future<ApiResponse<Response>> loginRepo(String email, String password) async {
  final data = jsonEncode({
    "email": email,
    "password": password
  });
  
  return await apiClient.post(
    AppUrls.loginApiUrl,
    body: data,
  );
}
```

### Controller
```dart
Future<void> login(String email, String password) async {
  setLoading(true);
  errorMsg = null;
  
  final result = await callApi<Response>(
    () => authRepo.loginRepo(email, password),
  );
  
  setLoading(false);
  
  if (!result.isSuccess) {
    errorMsg = result.errorMessage;
    update();
    return;
  }
  
  // Success handling
  final data = result.data?.data["data"];
  update();
}
```

### UI
```dart
Obx(() {
  if (controller.isLoading) return LoadingWidget();
  if (controller.errorMsg != null) return ErrorWidget(controller.errorMsg);
  return SuccessWidget();
})
```

---

## 🎯 Key Benefits

1. **Clean Controllers** - No try-catch clutter
2. **Type Safety** - Generic `ApiResponse<T>`
3. **Centralized Error Handling** - One place to rule them all
4. **Auto Logout** - Force logout on 401
5. **Token Refresh** - Automatic on 498
6. **Sentry Integration** - Auto error logging
7. **Loading States** - Built-in
8. **Consistent API** - Same pattern everywhere

---

## 📝 Notes

- Controllers automatically handle loading/error states
- ApiClient catches ALL exceptions - no need for defensive coding
- Force logout is automatic for 401 errors
- Token refresh is transparent to the controller layer
- All network errors are logged to Sentry

---

## 🛠️ Generated Files

- **Controllers**: One per Postman folder
- **Repositories**: One per Postman folder  
- **Core Files**: ApiClient, ApiController, BaseController
- **Models**: ApiResponse, ResponseModel, CustomApiException
- **Constants**: AppUrls with all endpoints

---

## ⚡ Quick Start

1. Upload Postman collection
2. Generate code
3. Download ZIP
4. Copy to Flutter project
5. Use controllers in UI
6. Done! ✅

No manual error handling needed - it's all automatic! 🚀