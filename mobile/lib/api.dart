import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'messages_page.dart' show apiBaseUrl;

/// Result of an API call: HTTP status plus decoded JSON body (if any).
class ApiResult {
  final int status;
  final dynamic data;

  const ApiResult(this.status, this.data);

  bool get ok => status >= 200 && status < 300;

  /// Human-readable message from a Nest error body, or [fallback].
  String message([String fallback = 'Something went wrong']) {
    final d = data;
    if (d is Map && d['message'] != null) {
      final m = d['message'];
      if (m is List) return m.join(', ');
      return m.toString();
    }
    if (status == 0) return "Can't reach the server. Check your connection.";
    return fallback;
  }
}

/// Small wrapper around `http` that adds the saved bearer token.
class Api {
  static Future<String?> token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', token);
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
  }

  /// The signed-in user's id, read from the JWT without a network call.
  static Future<int?> currentUserId() async {
    final t = await token();
    if (t == null) return null;
    try {
      final parts = t.split('.');
      if (parts.length != 3) return null;
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      );
      final sub = payload['sub'];
      return sub is int ? sub : int.tryParse(sub.toString());
    } catch (_) {
      return null;
    }
  }

  static Future<Map<String, String>> _headers({bool json = false}) async {
    final t = await token();
    return {
      if (json) 'Content-Type': 'application/json',
      if (t != null && t.isNotEmpty) 'Authorization': 'Bearer $t',
    };
  }

  static Future<ApiResult> _send(Future<http.Response> Function() call) async {
    try {
      final res = await call().timeout(const Duration(seconds: 20));
      dynamic body;
      if (res.body.isNotEmpty) {
        try {
          body = jsonDecode(res.body);
        } catch (_) {
          body = res.body;
        }
      }
      return ApiResult(res.statusCode, body);
    } catch (_) {
      return const ApiResult(0, null);
    }
  }

  static Uri _uri(String path) => Uri.parse('$apiBaseUrl$path');

  static Future<ApiResult> get(String path) async {
    final h = await _headers();
    return _send(() => http.get(_uri(path), headers: h));
  }

  static Future<ApiResult> post(String path, [Object? body]) async {
    final h = await _headers(json: true);
    return _send(() => http.post(
          _uri(path),
          headers: h,
          body: body == null ? null : jsonEncode(body),
        ));
  }

  static Future<ApiResult> patch(String path, [Object? body]) async {
    final h = await _headers(json: true);
    return _send(() => http.patch(
          _uri(path),
          headers: h,
          body: body == null ? null : jsonEncode(body),
        ));
  }

  static Future<ApiResult> delete(String path) async {
    final h = await _headers();
    return _send(() => http.delete(_uri(path), headers: h));
  }
}

/// Where the web app lives, for shareable links. Assumes the Vite dev port
/// next to the API unless the API URL has no port.
String get webAppUrl {
  final api = apiBaseUrl.replaceAll(RegExp(r'/$'), '');
  if (api.contains(':3000')) return api.replaceFirst(':3000', ':5173');
  return api;
}

void showSnack(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      behavior: SnackBarBehavior.floating,
      backgroundColor: error ? Colors.redAccent : null,
      duration: const Duration(seconds: 3),
    ));
}
