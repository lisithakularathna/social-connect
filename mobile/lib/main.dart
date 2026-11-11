import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
// Web-only import for renderButton support
import 'google_sign_in_web_stub.dart'
    if (dart.library.html) 'google_sign_in_web_helper.dart';

import 'messages_page.dart';
import 'activity_page.dart';
import 'api.dart';
import 'auth_flow.dart';
import 'people_pages.dart';
import 'settings_pages.dart';
import 'social_widgets.dart';

// Google Sign-In configuration
// Web OAuth Client ID used for:
// - Flutter Web clientId
// - Android serverClientId
//
// Android OAuth credentials in Google Cloud must separately match:
// Package: com.example.mobile
// SHA-1: F6:7E:E4:DF:56:7D:3F:62:4F:A1:4E:FE:8B:7F:CA:B7:16:DD:CE:87
const String googleWebClientId =
    '991770544980-h1jr6bpuq3t064mjk80u6kkd3af14nee.apps.googleusercontent.com';

final GoogleSignIn _googleSignIn = GoogleSignIn(
  clientId: kIsWeb ? googleWebClientId : null,
  serverClientId: !kIsWeb ? googleWebClientId : null,
  scopes: const ['email', 'profile', 'openid'],
);

// ======================================================
// GOOGLE SIGN-IN HELPER
// ======================================================

void _showAuthErrorDialog(BuildContext context, String title, String message) {
  if (!context.mounted) return;
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.error_outline, color: Colors.redAccent),
          const SizedBox(width: 8),
          Expanded(child: Text(title)),
        ],
      ),
      content: SingleChildScrollView(
        child: SelectableText(
          message,
          style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
        ),
      ),
      actions: [
        TextButton.icon(
          icon: const Icon(Icons.copy, size: 16),
          label: const Text('Copy Error'),
          onPressed: () {
            Clipboard.setData(ClipboardData(text: message));
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Error copied to clipboard!')),
            );
          },
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('OK'),
        ),
      ],
    ),
  );
}

// Mobile-only: get idToken via signIn() popup
Future<String?> getGoogleIdToken() async {
  try {
    try {
      await _googleSignIn.signOut();
    } catch (_) {}

    final account = await _googleSignIn.signIn();

    if (account == null) {
      debugPrint('Google Sign-In: User cancelled account picker.');
      return null;
    }

    final authentication = await account.authentication;
    final idToken = authentication.idToken;

    debugPrint('Google Sign-In: account = ${account.email}');
    debugPrint(
      'Google Sign-In: idToken = '
      '${idToken != null && idToken.isNotEmpty ? "PRESENT" : "NULL"}',
    );

    if (idToken == null || idToken.isEmpty) {
      throw Exception(
        'Google Sign-In did not return an ID token. '
        'Check the Google Cloud OAuth configuration.',
      );
    }

    return idToken;
  } catch (e) {
    debugPrint('Google Sign-In Error: $e');
    rethrow;
  }
}

// Shared: send idToken to our backend and navigate to HomePage
Future<void> _exchangeTokenAndLogin(
  BuildContext context,
  String idToken,
) async {
  final response = await http.post(
    Uri.parse('$apiBaseUrl/auth/google'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'idToken': idToken}),
  );

  if (response.statusCode == 200 || response.statusCode == 201) {
    final data = jsonDecode(response.body);
    if (!context.mounted) return;
    // Handles 2FA-protected accounts too.
    await completeLogin(context, data);
  } else {
    String errorMessage =
        'Status Code: ${response.statusCode}\nBody: ${response.body}';
    try {
      final err = jsonDecode(response.body);
      if (err['message'] != null) {
        errorMessage =
            'Error: ${err['message']}\nStatus: ${response.statusCode}';
      }
    } catch (_) {}
    if (!context.mounted) return;
    _showAuthErrorDialog(context, 'Backend Error', errorMessage);
  }
}

// Mobile-only sign-in handler (uses signIn() popup)
Future<void> handleGoogleSignIn(BuildContext context) async {
  final messenger = ScaffoldMessenger.of(context);

  try {
    final idToken = await getGoogleIdToken();

    if (idToken == null) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Google sign-in was cancelled'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (!context.mounted) return;
    await _exchangeTokenAndLogin(context, idToken);
  } catch (e) {
    if (!context.mounted) return;
    _showAuthErrorDialog(context, 'Google Sign-In Error', '$e');
  }
}

// Web-only: called after renderButton successfully signs the user in
Future<void> handleWebGoogleSignIn(
  BuildContext context,
  GoogleSignInAccount account,
) async {
  try {
    final authentication = await account.authentication;
    final idToken = authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw Exception('No idToken returned from Google. Check OAuth config.');
    }
    if (!context.mounted) return;
    await _exchangeTokenAndLogin(context, idToken);
  } catch (e) {
    if (!context.mounted) return;
    _showAuthErrorDialog(context, 'Google Sign-In Error', '$e');
  }
}


final ValueNotifier<ThemeMode> themeNotifier =
    ValueNotifier(ThemeMode.light);

Future<void> loadThemePreference() async {
  final prefs = await SharedPreferences.getInstance();
  final value = prefs.getString('themeMode') ?? 'light';
  themeNotifier.value = value == 'dark'
      ? ThemeMode.dark
      : value == 'system'
          ? ThemeMode.system
          : ThemeMode.light;
}

Future<void> setThemePreference(ThemeMode mode) async {
  themeNotifier.value = mode;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('themeMode', mode == ThemeMode.dark
      ? 'dark'
      : mode == ThemeMode.system
          ? 'system'
          : 'light');
}


void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadThemePreference();
  await loadApiBaseUrl();
  MessageNavigationCallbacks.onOpenPost = (context, post) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => PostDetailPage(post: post)),
    );
  };
  MessageNavigationCallbacks.onOpenProfile = (context, userId, name) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => UserProfilePage(userId: userId, userName: name)),
    );
  };
  runApp(const SocialConnectApp());
}

class SocialConnectApp extends StatelessWidget {
  const SocialConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeNotifier,
      builder: (context, currentMode, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'Social Connect',
          themeMode: currentMode,
          theme: ThemeData(
            brightness: Brightness.light,
            scaffoldBackgroundColor: Colors.white,
            colorScheme: const ColorScheme.light(
              primary: Colors.black,
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: Colors.black,
            ),
            appBarTheme: const AppBarTheme(
              backgroundColor: Colors.white,
              foregroundColor: Colors.black,
              elevation: 0,
              centerTitle: false,
              titleTextStyle: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w700,
                fontSize: 22,
                letterSpacing: -0.5,
              ),
            ),
            elevatedButtonTheme: ElevatedButtonThemeData(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.black,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: const Color(0xFFF5F5F5),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Colors.black, width: 1.5),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            bottomNavigationBarTheme: const BottomNavigationBarThemeData(
              backgroundColor: Colors.white,
              selectedItemColor: Colors.black,
              unselectedItemColor: Colors.grey,
              showSelectedLabels: false,
              showUnselectedLabels: false,
              type: BottomNavigationBarType.fixed,
              elevation: 1,
            ),
            dividerTheme: const DividerThemeData(
              color: Color(0xFFEFEFEF),
              thickness: 1,
              space: 0,
            ),
            useMaterial3: true,
          ),
          darkTheme: ThemeData(
            brightness: Brightness.dark,
            scaffoldBackgroundColor: Colors.black,
            colorScheme: const ColorScheme.dark(
              primary: Colors.white,
              onPrimary: Colors.black,
              surface: Color(0xFF1C1C1C),
              onSurface: Colors.white,
            ),
            appBarTheme: const AppBarTheme(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              elevation: 0,
              centerTitle: false,
              titleTextStyle: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 22,
                letterSpacing: -0.5,
              ),
            ),
            elevatedButtonTheme: ElevatedButtonThemeData(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: const Color(0xFF2A2A2A),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Colors.white, width: 1.5),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              hintStyle: const TextStyle(color: Colors.grey),
              labelStyle: const TextStyle(color: Colors.grey),
            ),
            bottomNavigationBarTheme: const BottomNavigationBarThemeData(
              backgroundColor: Colors.black,
              selectedItemColor: Colors.white,
              unselectedItemColor: Colors.grey,
              showSelectedLabels: false,
              showUnselectedLabels: false,
              type: BottomNavigationBarType.fixed,
              elevation: 1,
            ),
            dividerTheme: const DividerThemeData(
              color: Color(0xFF2A2A2A),
              thickness: 1,
              space: 0,
            ),
            useMaterial3: true,
          ),
          home: const AuthGate(),
        );
      },
    );
  }
}

// ======================================================
// HELPER: TIME AGO FORMATTER
// ======================================================

String formatTimeAgo(dynamic dateValue) {
  if (dateValue == null) return '';
  try {
    final dateTime = DateTime.parse(dateValue.toString()).toLocal();
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inSeconds < 60) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${dateTime.day}/${dateTime.month}/${dateTime.year}';
    }
  } catch (_) {
    return '';
  }
}


// ======================================================
// LOGIN PAGE
// ======================================================

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  bool isLoading = false;

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> login() async {
    final email = emailController.text.trim();
    final password = passwordController.text;

    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter your email address'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid email address'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter your password'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() {
      isLoading = true;
    });

    try {
      final response = await http.post(
        Uri.parse('$apiBaseUrl/auth/login'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      if (response.statusCode == 201 ||
          response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (!mounted) return;
        // Saves the session, or asks for a 2FA code first.
        await completeLogin(context, data);
      } else {
        if (!mounted) return;

        String errorMessage = 'Invalid email or password';
        try {
          final err = jsonDecode(response.body);
          if (err['message'] != null) {
            errorMessage = err['message'] is List
                ? (err['message'] as List).join(', ')
                : err['message'].toString();
          }
        } catch (_) {}

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Connection error: $e'),
          backgroundColor: Colors.redAccent,
          action: SnackBarAction(
            label: 'Change Server',
            textColor: Colors.white,
            onPressed: () => _showServerConfigDialog(context),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          isLoading = false;
        });
      }
    }
  }

  void _showServerConfigDialog(BuildContext context) {
    final controller = TextEditingController(text: apiBaseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.dns_outlined, color: Colors.deepPurple),
            SizedBox(width: 8),
            Text('Server Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter your PC\'s Wi-Fi IP or tunnel URL:\n(e.g., http://192.168.43.50:3000)',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              keyboardType: TextInputType.url,
              decoration: InputDecoration(
                hintText: 'http://192.168.x.x:3000',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                isDense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final val = controller.text.trim();
              if (val.isNotEmpty) {
                await setApiBaseUrl(val);
                if (ctx.mounted) Navigator.pop(ctx);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Server URL set to: $val')),
                  );
                }
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? Colors.black : Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 8,
              right: 8,
              child: IconButton(
                icon: Icon(Icons.settings_outlined, color: isDark ? Colors.grey[400] : Colors.grey[700]),
                tooltip: 'Server Settings',
                onPressed: () => _showServerConfigDialog(context),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 60),

                  // ── Logo ──
                  Center(
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [
                            Color(0xFFE1306C),
                            Color(0xFFF77737),
                            Color(0xFFFCAF45),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: const Icon(
                        Icons.camera_alt_rounded,
                        color: Colors.white,
                        size: 40,
                      ),
                    ),
                  ),

                  const SizedBox(height: 28),

                  // ── App Name ──
                  Text(
                    'Social Connect',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1,
                      color: isDark ? Colors.white : Colors.black,
                    ),
                  ),

                  const SizedBox(height: 6),

                  Text(
                    'Sign in to continue',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),

                  const SizedBox(height: 40),

                  // ── Email ──
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: InputDecoration(
                      hintText: 'Email address',
                      prefixIcon: Icon(Icons.email_outlined,
                          color: isDark ? Colors.grey[400] : Colors.grey[600], size: 20),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Password ──
                  TextField(
                    controller: passwordController,
                    obscureText: true,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: InputDecoration(
                      hintText: 'Password',
                      prefixIcon: Icon(Icons.lock_outline,
                          color: isDark ? Colors.grey[400] : Colors.grey[600], size: 20),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── Login Button ──
                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isDark ? Colors.white : Colors.black,
                        foregroundColor: isDark ? Colors.black : Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: isLoading
                          ? SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: isDark ? Colors.black : Colors.white,
                              ),
                            )
                          : const Text(
                              'Log in',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── OR Divider ──
                  Row(
                    children: [
                      Expanded(child: Divider(color: isDark ? Colors.grey[800] : Colors.grey[300])),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Text(
                          'OR',
                          style: TextStyle(
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      Expanded(child: Divider(color: isDark ? Colors.grey[800] : Colors.grey[300])),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // ── Google Sign-In ──
                  if (kIsWeb)
                    GoogleWebSignInButton(
                      onSuccess: (idToken) =>
                          _exchangeTokenAndLogin(context, idToken),
                      onError: (error) =>
                          _showAuthErrorDialog(context, 'Google Sign-In', error),
                    )
                  else
                    SizedBox(
                      height: 52,
                      child: OutlinedButton(
                        onPressed: isLoading
                            ? null
                            : () => handleGoogleSignIn(context),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(
                              color: isDark
                                  ? Colors.grey[700]!
                                  : Colors.grey[300]!),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          foregroundColor:
                              isDark ? Colors.white : Colors.black,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Image.network(
                              'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
                              height: 22,
                              width: 22,
                              errorBuilder: (_, _, _) =>
                                  const Icon(Icons.g_mobiledata, size: 26),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'Continue with Google',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                  const SizedBox(height: 32),

                  // ── Register link (wraps on narrow screens / large text) ──
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        "Don't have an account? ",
                        style: TextStyle(
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                          fontSize: 14,
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const RegisterPage(),
                            ),
                          );
                        },
                        child: Text(
                          'Sign up',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ),
      ],
    ),
  ),
);
  }
}


// ======================================================
// HOME PAGE / FEED
// ======================================================

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  List<dynamic> posts = [];

  bool isLoading = true;
  bool isLoadingMore = false;
  bool hasMore = true;
  int page = 1;
  String scope = 'all'; // 'all' | 'following'
  String? errorMessage;
  List<String> hiddenWords = [];
  final ScrollController _scroll = ScrollController();
  int _requestSeq = 0;

  int _currentNavIndex = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    scope = prefs.getString('feedScope') ?? 'all';
    hiddenWords = await loadHiddenWords();
    UnreadCounter.start();
    migrateLocalDataOnce();
    loadPosts();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients || isLoading || isLoadingMore || !hasMore) return;
    if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 900) {
      _loadPage(page + 1);
    }
  }

  // ====================================================
  // LOAD POSTS (paginated)
  // ====================================================

  Future<void> loadPosts() async {
    UnreadCounter.refresh();
    hiddenWords = await loadHiddenWords();
    await _loadPage(1);
  }

  Future<void> _loadPage(int pageToLoad) async {
    final seq = ++_requestSeq;
    setState(() {
      if (pageToLoad == 1) {
        isLoading = posts.isEmpty;
        errorMessage = null;
      } else {
        isLoadingMore = true;
      }
    });

    final res = await Api.get('/posts?page=$pageToLoad&limit=10&scope=$scope');
    if (!mounted || seq != _requestSeq) return;

    if (res.ok) {
      final data = res.data;
      final list = data is List ? data : (data is Map && data['posts'] is List ? data['posts'] as List : []);
      setState(() {
        if (pageToLoad == 1) {
          posts = list;
        } else {
          final seen = posts.map((p) => p['id']).toSet();
          posts = [...posts, ...list.where((p) => !seen.contains(p['id']))];
        }
        page = pageToLoad;
        hasMore = data is Map && data['pagination'] is Map ? data['pagination']['hasMore'] == true : false;
        isLoading = false;
        isLoadingMore = false;
      });
    } else {
      setState(() {
        if (pageToLoad == 1) errorMessage = res.message('Failed to load posts');
        isLoading = false;
        isLoadingMore = false;
      });
      if (pageToLoad > 1) showSnack(context, res.message("Couldn't load more posts"), error: true);
    }
  }

  Future<void> _switchScope(String next) async {
    if (next == scope) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('feedScope', next);
    setState(() {
      scope = next;
      posts = [];
      hasMore = true;
      isLoading = true;
    });
    _loadPage(1);
  }

  // ====================================================
  // BUILD
  // ====================================================

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = isDark ? const Color(0xFF2A2A2A) : const Color(0xFFEFEFEF);

    return Scaffold(
      appBar: _currentNavIndex == 0
          ? AppBar(
              title: Text(
                'Social Connect',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                  letterSpacing: -0.8,
                  color: isDark ? Colors.white : Colors.black,
                ),
              ),
              actions: [
                IconButton(
                  tooltip: 'Create',
                  onPressed: _openCreateMenu,
                  icon: Icon(Icons.add, color: isDark ? Colors.white : Colors.black, size: 28),
                ),
                IconButton(
                  tooltip: isDark ? 'Light mode' : 'Dark mode',
                  onPressed: () => setThemePreference(isDark ? ThemeMode.light : ThemeMode.dark),
                  icon: Icon(
                    isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                    color: isDark ? Colors.white : Colors.black,
                  ),
                ),
                IconButton(
                  tooltip: 'Settings',
                  onPressed: () async {
                    await Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsPage()));
                    if (mounted) loadPosts();
                  },
                  icon: Icon(Icons.settings_outlined, color: isDark ? Colors.white : Colors.black),
                ),
              ],
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(1),
                child: Divider(height: 1, color: borderColor),
              ),
            )
          : null,

      body: IndexedStack(
        index: _currentNavIndex,
        children: [
          // ── 0: Feed ──
          RefreshIndicator(
            onRefresh: loadPosts,
            child: buildFeed(),
          ),
          // ── 1: Search ──
          const SearchPage(),
          // ── 2: Create Post (modal, not a page in stack) ──
          const SizedBox.shrink(),
          // ── 3: Notifications ──
          _currentNavIndex == 3 ? const NotificationsPage() : const SizedBox.shrink(),
          // ── 4: Messages ──
          const SizedBox.shrink(),
          // ── 5: Profile ──
          const ProfilePage(),
        ],
      ),

      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: borderColor, width: 1)),
        ),
        child: ValueListenableBuilder<UnreadCounts>(
          valueListenable: UnreadCounter.notifier,
          builder: (context, unread, _) => BottomNavigationBar(
            currentIndex: _currentNavIndex == 2 ? 0 : _currentNavIndex,
            onTap: (index) async {
              if (index == 2) {
                await _openCreateMenu();
                return;
              }

              if (index == 4) {
                UnreadCounter.clearMessages();
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const MessagesPage(),
                  ),
                );
                UnreadCounter.refresh();
                return;
              }

              if (index == 0 && _currentNavIndex == 0 && _scroll.hasClients) {
                _scroll.animateTo(0, duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
              }
              setState(() => _currentNavIndex = index);
              if (index == 3) UnreadCounter.clearActivity();
            },
            items: [
              const BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined),
                activeIcon: Icon(Icons.home),
                label: 'Home',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.search_outlined),
                activeIcon: Icon(Icons.search),
                label: 'Search',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.add_box_outlined),
                activeIcon: Icon(Icons.add_box),
                label: 'Add',
              ),
              BottomNavigationBarItem(
                icon: Badge(
                  isLabelVisible: unread.activity > 0,
                  label: Text(unread.activity > 99 ? '99+' : '${unread.activity}'),
                  backgroundColor: const Color(0xFFD94D6A),
                  child: const Icon(Icons.favorite_outline),
                ),
                activeIcon: const Icon(Icons.favorite),
                label: 'Notifications',
              ),
              BottomNavigationBarItem(
                icon: Badge(
                  isLabelVisible: unread.messages > 0,
                  label: Text(unread.messages > 99 ? '99+' : '${unread.messages}'),
                  backgroundColor: const Color(0xFFD94D6A),
                  child: const Icon(Icons.chat_bubble_outline_rounded),
                ),
                activeIcon: const Icon(Icons.chat_bubble_rounded),
                label: 'Messages',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.person_outline),
                activeIcon: Icon(Icons.person),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ====================================================
  // FEED
  // ====================================================

  Future<void> _openCreateMenu() async {
    final choice = await showModalBottomSheet<String>(
      context: context, showDragHandle: true,
      builder: (sheetContext) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const ListTile(title: Text('Create', style: TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('Share something with your followers')),
        ListTile(leading: const Icon(Icons.add_circle_outline), title: const Text('Story'), subtitle: const Text('Photo or quick update · 24 hours'), onTap: () => Navigator.pop(sheetContext, 'story')),
        ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Post'), subtitle: const Text('Photo, text, caption, @mentions and #hashtags'), onTap: () => Navigator.pop(sheetContext, 'post')),
      ])),
    );
    if (!mounted || choice == null) return;
    if (choice == 'story') {
      await Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateStoryPage()));
      if (mounted) setState(() {});
    } else {
      final created = await Navigator.push(context, MaterialPageRoute(builder: (_) => const CreatePostPage()));
      if (created == true && mounted) loadPosts();
    }
  }

  Widget _scopeTabs(bool isDark) {
    Widget tab(String value, String label) {
      final active = scope == value;
      return Expanded(
        child: GestureDetector(
          onTap: () => _switchScope(value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: active ? (isDark ? const Color(0xFF1F1F1F) : const Color(0xFFF1F1EE)) : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              border: active ? const Border(bottom: BorderSide(color: Color(0xFFD94D6A), width: 2)) : null,
            ),
            alignment: Alignment.center,
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: active ? (isDark ? Colors.white : Colors.black) : Colors.grey,
              ),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE7E7E2)),
        ),
        child: Row(children: [tab('all', 'For you'), tab('following', 'Following')]),
      ),
    );
  }

  Widget buildFeed() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (isLoading && posts.isEmpty) return const Center(child: CircularProgressIndicator());
    if (errorMessage != null && posts.isEmpty) {
      return ListView(children: [
        SizedBox(height: MediaQuery.of(context).size.height * .3),
        Center(child: Column(children: [
          const Icon(Icons.wifi_off_rounded, size: 60, color: Colors.grey),
          const SizedBox(height: 12), Text(errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
          const SizedBox(height: 16), ElevatedButton(onPressed: loadPosts, child: const Text('Retry')),
        ])),
      ]);
    }
    final visible = posts
        .where((p) => !containsHiddenWord('${p['title'] ?? ''} ${p['content'] ?? ''}', hiddenWords))
        .toList();
    return ListView(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        StoryStrip(posts: posts, onCreateStory: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateStoryPage()));
          if (mounted) setState(() {});
        }),
        _scopeTabs(isDark),
        if (visible.isEmpty)
          Padding(padding: const EdgeInsets.symmetric(vertical: 100), child: Column(children: [
            Icon(scope == 'following' ? Icons.people_outline : Icons.photo_camera_outlined, size: 70, color: Colors.grey),
            const SizedBox(height: 12),
            Text(scope == 'following' ? 'Your following feed is quiet' : 'No posts yet',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(scope == 'following' ? 'Follow people to see their posts here' : 'Be the first to share something',
                style: const TextStyle(color: Colors.grey)),
          ]))
        else ...visible.map((post) => PostCard(key: ValueKey('post-${post['id']}'), post: post, onChanged: loadPosts)),
        if (isLoadingMore)
          const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4))),
        if (!hasMore && visible.isNotEmpty)
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 18, 20, 30),
            child: Center(child: Text("You're all caught up ✓", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600))),
          ),
      ],
    );
  }
}



const String _localStoriesKey = 'localStories';
Future<List<Map<String,dynamic>>> _loadLocalStories() async {
  final p=await SharedPreferences.getInstance();final raw=p.getStringList(_localStoriesKey)??[];final valid=<Map<String,dynamic>>[];final now=DateTime.now();
  for(final item in raw){try{final d=Map<String,dynamic>.from(jsonDecode(item));final created=DateTime.tryParse(d['createdAt']?.toString()??'');if(created!=null&&now.difference(created).inHours<24)valid.add(d);}catch(_){}}
  await p.setStringList(_localStoriesKey,valid.map(jsonEncode).toList());return valid;
}
class StoryStrip extends StatefulWidget{
 final List<dynamic> posts;final VoidCallback onCreateStory;const StoryStrip({super.key,required this.posts,required this.onCreateStory});
 @override State<StoryStrip> createState()=>_StoryStripState();
}
class _StoryStripState extends State<StoryStrip>{
 List<Map<String,dynamic>> localStories=[];
 @override void initState(){super.initState();_load();}
 Future<void> _load()async{final s=await _loadLocalStories();if(mounted)setState(()=>localStories=s);}
 @override Widget build(BuildContext context){final seen=<String>{};final users=<dynamic>[];for(final p in widget.posts){final a=p['author'];final id=a?['id']?.toString()??a?['username']?.toString()??'';if(id.isNotEmpty&&seen.add(id))users.add(p);if(users.length>=8)break;}return SizedBox(height:112,child:ListView(scrollDirection:Axis.horizontal,padding:const EdgeInsets.symmetric(horizontal:10,vertical:10),children:[
  _item('Your story',localStories.isNotEmpty?localStories.last['imageBase64']:null,true,widget.onCreateStory),
  ...users.map((p){final a=p['author'];return _item((a?['username']??'User').toString(),a?['profileImageUrl']??p['imageUrl'],false,()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>StoryViewerPage(post:p))));}),
 ]));}
 Widget _item(String label,dynamic image,bool mine,VoidCallback tap)=>GestureDetector(onTap:tap,child:SizedBox(width:82,child:Column(children:[Stack(children:[
  Container(width:68,height:68,padding:const EdgeInsets.all(3),decoration:BoxDecoration(shape:BoxShape.circle,gradient:LinearGradient(colors:mine?[Colors.grey,Colors.grey]:const[Color(0xFFFCAF45),Color(0xFFE1306C),Color(0xFF833AB4)])),child:Container(padding:const EdgeInsets.all(2),decoration:BoxDecoration(color:Theme.of(context).scaffoldBackgroundColor,shape:BoxShape.circle),child:_img(image))),
  if(mine)Positioned(right:0,bottom:0,child:Container(width:23,height:23,decoration:BoxDecoration(color:Theme.of(context).colorScheme.primary,shape:BoxShape.circle,border:Border.all(color:Theme.of(context).scaffoldBackgroundColor,width:2)),child:const Icon(Icons.add,color:Colors.white,size:16))),
 ]),const SizedBox(height:5),Text(label,maxLines:1,overflow:TextOverflow.ellipsis,style:const TextStyle(fontSize:11))]))); 
 Widget _img(dynamic image){if(image==null||image.toString().isEmpty)return const CircleAvatar(radius:29,child:Icon(Icons.person_outline));final v=image.toString();if(v.length>200&&!v.startsWith('http')){try{return CircleAvatar(radius:29,backgroundImage:MemoryImage(base64Decode(v)));}catch(_){}}return CircleAvatar(radius:29,backgroundImage:NetworkImage(v));}
}
class CreateStoryPage extends StatefulWidget{const CreateStoryPage({super.key});@override State<CreateStoryPage> createState()=>_CreateStoryPageState();}
class _CreateStoryPageState extends State<CreateStoryPage>{
 final ImagePicker picker=ImagePicker();Uint8List? bytes;bool saving=false;
 Future<void> pick()async{final x=await picker.pickImage(source:ImageSource.gallery,imageQuality:70,maxWidth:1080);if(x!=null){final b=await x.readAsBytes();if(mounted)setState(()=>bytes=b);}}
 Future<void> publish()async{if(bytes==null)return;setState(()=>saving=true);final p=await SharedPreferences.getInstance();final stories=await _loadLocalStories();stories.add({'imageBase64':base64Encode(bytes!),'createdAt':DateTime.now().toIso8601String()});await p.setStringList(_localStoriesKey,stories.map(jsonEncode).toList());if(mounted){setState(()=>saving=false);ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Story added for 24 hours')));Navigator.pop(context);}}
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Create Story'),centerTitle:true,actions:[TextButton(onPressed:bytes==null||saving?null:publish,child:const Text('Share'))]),body:Padding(padding:const EdgeInsets.all(20),child:Column(children:[
  if(bytes!=null)ClipRRect(borderRadius:BorderRadius.circular(20),child:Image.memory(bytes!,height:420,width:double.infinity,fit:BoxFit.cover))
  else Expanded(child:Center(child:Column(mainAxisSize:MainAxisSize.min,children:[const Icon(Icons.add_photo_alternate_rounded,size:70),const SizedBox(height:12),const Text('Add a photo to your story',style:TextStyle(fontSize:18,fontWeight:FontWeight.w700)),const SizedBox(height:18),ElevatedButton.icon(onPressed:pick,icon:const Icon(Icons.photo_library_outlined),label:const Text('Choose Photo'))]))),
  if(bytes!=null)...[const SizedBox(height:20),ElevatedButton.icon(onPressed:pick,icon:const Icon(Icons.change_circle_outlined),label:const Text('Change Photo')),const SizedBox(height:10),const Text('Your story will be visible for 24 hours',style:TextStyle(color:Colors.grey))],
 ])));
}
class StoryViewerPage extends StatelessWidget{
 final dynamic post;const StoryViewerPage({super.key,required this.post});
 @override Widget build(BuildContext context){final a=post['author'];final image=post['imageUrl'];return Scaffold(backgroundColor:Colors.black,appBar:AppBar(backgroundColor:Colors.transparent,foregroundColor:Colors.white,title:Text(a?['username']?.toString()??'Story')),body:Center(child:image!=null&&image.toString().isNotEmpty?Image.network(image.toString(),fit:BoxFit.contain,errorBuilder:(_,_,_)=>_text()):_text()));}
 Widget _text()=>Padding(padding:const EdgeInsets.all(30),child:Text((post['content']?.toString().isNotEmpty==true?post['content']:post['title'])?.toString()??'Story',textAlign:TextAlign.center,style:const TextStyle(color:Colors.white,fontSize:28,fontWeight:FontWeight.w700)));
}
// ======================================================
// POST CARD
// ======================================================

Color _postColor(dynamic hex, bool isDark) {
  if (hex is String) {
    final value = hex.replaceAll('#', '').trim();
    try {
      if (value.length == 6) return Color(int.parse('FF$value', radix: 16));
      if (value.length == 8) return Color(int.parse(value, radix: 16));
    } catch (_) {}
  }
  return isDark ? const Color(0xFF1C1C1C) : const Color(0xFFF8F8F8);
}

Color _postTextColor(dynamic hex, bool isDark) => _postColor(hex, isDark).computeLuminance() < 0.35 ? Colors.white : Colors.black87;

class PostCard extends StatefulWidget {
  final dynamic post;
  /// Called after the card changes the feed (delete, mute, block).
  final VoidCallback? onChanged;

  const PostCard({
    super.key,
    required this.post,
    this.onChanged,
  });

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard>
    with SingleTickerProviderStateMixin {
  bool isLiked = false;
  bool isLoadingLike = false;
  int likeCount = 0;
  bool _showHeart = false;
  bool isSaved = false;
  bool isLoadingSave = false;
  bool _removed = false;
  int? _myId;
  late AnimationController _heartController;
  late Animation<double> _heartAnim;

  @override
  void initState() {
    super.initState();
    // Use data from backend response if available
    likeCount = widget.post['likesCount'] ?? 0;
    isLiked = widget.post['isLiked'] ?? false;
    isSaved = widget.post['isSaved'] == true;
    Api.currentUserId().then((id) {
      if (mounted) setState(() => _myId = id);
    });

    _heartController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _heartAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _heartController, curve: Curves.elasticOut),
    );
    _heartController.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) setState(() => _showHeart = false);
        });
      }
    });
  }

  @override
  void dispose() {
    _heartController.dispose();
    super.dispose();
  }

  Future<void> toggleLike() async {
    if (isLoadingLike) return;
    setState(() => isLoadingLike = true);

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');
      if (token == null) return;

      final postId = widget.post['id'];
      http.Response response;

      if (isLiked) {
        response = await http.delete(
          Uri.parse('$apiBaseUrl/likes/$postId'),
          headers: {'Authorization': 'Bearer $token'},
        );
      } else {
        response = await http.post(
          Uri.parse('$apiBaseUrl/likes/$postId'),
          headers: {'Authorization': 'Bearer $token'},
        );
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        setState(() {
          isLiked = !isLiked;
          likeCount += isLiked ? 1 : -1;
        });
      } else if (mounted) {
        String msg = 'Could not update like';
        try {
          final d = jsonDecode(response.body);
          if (d['message'] != null) msg = d['message'].toString();
        } catch (_) {}
        showSnack(context, msg, error: true);
      }
    } catch (_) {}
    finally {
      if (mounted) setState(() => isLoadingLike = false);
    }
  }

  // Saved posts live on the server, so they sync with the web app.
  Future<void> toggleSave() async {
    if (isLoadingSave) return;
    final next = !isSaved;
    setState(() {
      isLoadingSave = true;
      isSaved = next;
    });
    final id = widget.post['id'];
    final res = next ? await Api.post('/posts/$id/save') : await Api.delete('/posts/$id/save');
    if (!mounted) return;
    setState(() => isLoadingSave = false);
    if (res.ok) {
      showSnack(context, next ? 'Saved to your collection' : 'Removed from saved');
    } else {
      setState(() => isSaved = !next);
      showSnack(context, res.message('Could not update saved posts'), error: true);
    }
  }

  int get _ownerId {
    final owner = widget.post['ownerId'];
    if (owner is int) return owner;
    final reposter = widget.post['repostedBy'];
    if (widget.post['isRepost'] == true && reposter is Map && reposter['id'] is int) return reposter['id'];
    final a = widget.post['authorId'];
    return a is int ? a : int.tryParse('$a') ?? 0;
  }

  bool get _isOwner => _myId != null && _myId == _ownerId;

  Map<String, dynamic>? get _menuTarget {
    final reposter = widget.post['repostedBy'];
    if (widget.post['isRepost'] == true && reposter is Map) return Map<String, dynamic>.from(reposter);
    final author = widget.post['author'];
    return author is Map ? Map<String, dynamic>.from(author) : null;
  }

  Future<void> _deletePost() async {
    final isRepost = widget.post['isRepost'] == true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isRepost ? 'Undo repost?' : 'Delete post?'),
        content: Text(isRepost ? 'It will be removed from your profile.' : "This can't be undone."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isRepost ? 'Undo' : 'Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final res = await Api.delete('/posts/${widget.post['id']}');
    if (!mounted) return;
    if (res.ok) {
      setState(() => _removed = true);
      showSnack(context, isRepost ? 'Repost removed' : 'Post deleted');
      widget.onChanged?.call();
    } else {
      showSnack(context, res.message("Couldn't delete"), error: true);
    }
  }

  Future<void> _muteOrBlock({required bool block}) async {
    final target = _menuTarget;
    final id = target?['id'];
    if (id == null) return;
    if (block) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Block @${target?['username'] ?? 'user'}?'),
          content: const Text("They won't be able to find your profile, see your posts or message you."),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Block'),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }
    final res = await Api.post('/users/$id/${block ? 'block' : 'mute'}');
    if (!mounted) return;
    if (res.ok) {
      setState(() => _removed = true);
      showSnack(context, block ? 'Blocked @${target?['username']}' : 'Muted @${target?['username']}. Undo in Settings → Safety.');
      widget.onChanged?.call();
    } else {
      showSnack(context, res.message("Couldn't update"), error: true);
    }
  }

  void _showPostMenu() {
    final target = _menuTarget;
    final linkId = widget.post['originalPostId'] ?? widget.post['id'];
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.open_in_full_rounded),
            title: const Text('Open post'),
            onTap: () {
              Navigator.pop(ctx);
              Navigator.push(context, MaterialPageRoute(builder: (_) => PostDetailPage(post: widget.post)));
            },
          ),
          ListTile(
            leading: const Icon(Icons.link_rounded),
            title: const Text('Copy link'),
            onTap: () {
              Navigator.pop(ctx);
              Clipboard.setData(ClipboardData(text: '$webAppUrl/post/$linkId'));
              showSnack(context, 'Link copied');
            },
          ),
          if (!_isOwner) ...[
            ListTile(
              leading: const Icon(Icons.volume_off_outlined),
              title: Text('Mute @${target?['username'] ?? 'user'}'),
              onTap: () {
                Navigator.pop(ctx);
                _muteOrBlock(block: false);
              },
            ),
            ListTile(
              leading: const Icon(Icons.block, color: Colors.redAccent),
              title: Text('Block @${target?['username'] ?? 'user'}', style: const TextStyle(color: Colors.redAccent)),
              onTap: () {
                Navigator.pop(ctx);
                _muteOrBlock(block: true);
              },
            ),
          ] else
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
              title: Text(widget.post['isRepost'] == true ? 'Undo repost' : 'Delete post',
                  style: const TextStyle(color: Colors.redAccent)),
              onTap: () {
                Navigator.pop(ctx);
                _deletePost();
              },
            ),
        ]),
      ),
    );
  }

  Map<String, dynamic> _buildSharePayload(String displayTitle, String displayContent) {
    final author = widget.post['author'];
    final authorId = int.tryParse(author?['id']?.toString() ?? '') ?? 0;
    return {
      'id': widget.post['originalPostId'] ?? widget.post['id'],
      'title': displayTitle,
      'content': displayContent,
      'imageUrl': widget.post['imageUrl'],
      'backgroundColor': widget.post['backgroundColor'],
      'fontSize': widget.post['fontSize'],
      'author': {
        'id': authorId,
        'username': (author?['username'] ?? 'user').toString(),
        'name': author?['name']?.toString(),
        'profileImageUrl': author?['profileImageUrl']?.toString(),
      },
    };
  }

  void _showShareOptions(BuildContext context, String displayTitle, String displayContent) {
    final author = widget.post['author'];
    final authorUsername = (author?['username'] ?? author?['name'] ?? 'author').toString();
    final authorId = int.tryParse(author?['id']?.toString() ?? '');
    final sharePayload = _buildSharePayload(displayTitle, displayContent);

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              if (authorId != null)
                ListTile(
                  leading: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF6366F1)),
                  title: Text('Message @$authorUsername with post'),
                  subtitle: const Text('Send direct message to the author'),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ChatPage(
                          userId: authorId,
                          username: authorUsername,
                          profileImageUrl: author?['profileImageUrl']?.toString(),
                          sharedPost: sharePayload,
                        ),
                      ),
                    );
                  },
                ),
              ListTile(
                leading: const Icon(Icons.send_rounded, color: Color(0xFF10B981)),
                title: const Text('Share in another chat...'),
                subtitle: const Text('Choose a friend or conversation to share with'),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => MessagesPage(initialSharedPost: sharePayload),
                    ),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.link_rounded),
                title: const Text('Copy Post Link'),
                onTap: () {
                  Navigator.pop(ctx);
                  final link = '$webAppUrl/post/${widget.post['originalPostId'] ?? widget.post['id']}';
                  Clipboard.setData(ClipboardData(text: link));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Post link copied to clipboard')),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.repeat_rounded, color: Color(0xFF10B981)),
                title: const Text('Repost to your feed'),
                onTap: () {
                  Navigator.pop(ctx);
                  repostPost();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void openPostChat() {
    final rawTitle = widget.post['title']?.toString() ?? '';
    final rawContent = widget.post['content']?.toString() ?? '';
    String displayTitle = rawTitle.replaceFirst(RegExp(r'^Reposted:\s*', caseSensitive: false), '').trim();
    String displayContent = rawContent
        .replaceAll(RegExp(r'\[REPOST_META:[^\]]+\]\s*'), '')
        .replaceAll(RegExp(r'\n*↻\s*Reposted from post #\d+'), '')
        .trim();

    _showShareOptions(context, displayTitle, displayContent);
  }


  Future<void> repostPost() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');
      if (token == null || token.isEmpty) return;
      final response = await http.post(
        Uri.parse('$apiBaseUrl/posts/repost/${widget.post["id"]}'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (!mounted) return;
      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Post reposted to your feed')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Repost failed (${response.statusCode})')));
      }
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Repost error: $e'))); }
  }

  void _doubleTapLike() {
    if (!isLiked) toggleLike();
    setState(() => _showHeart = true);
    _heartController.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    if (_removed) return const SizedBox.shrink();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final author = widget.post['author'];
    final username = author?['username'] ?? author?['name'] ?? 'Unknown';
    final name = author?['name'] ?? username;

    final rawTitle = widget.post['title']?.toString() ?? '';
    final rawContent = widget.post['content']?.toString() ?? '';

    // Check if post is a repost
    final isRepost = widget.post['isRepost'] == true ||
        widget.post['repostedBy'] != null ||
        rawTitle.startsWith('Reposted:') ||
        rawContent.contains('↻ Reposted from post #') ||
        rawContent.contains('[REPOST_META:');

    final reposter = widget.post['repostedBy'] is Map
        ? Map<String, dynamic>.from(widget.post['repostedBy'] as Map)
        : (isRepost && author is Map ? Map<String, dynamic>.from(author) : null);

    // Clean title and content if legacy or not yet parsed
    String displayTitle = rawTitle;
    String displayContent = rawContent;

    if (displayTitle.startsWith('Reposted:')) {
      displayTitle = displayTitle.replaceFirst(RegExp(r'^Reposted:\s*', caseSensitive: false), '').trim();
    }
    if (displayContent.contains('[REPOST_META:')) {
      displayContent = displayContent.replaceAll(RegExp(r'\[REPOST_META:[^\]]+\]\s*'), '').trim();
    }
    if (displayContent.contains('↻ Reposted from post #')) {
      displayContent = displayContent.replaceAll(RegExp(r'\n*↻\s*Reposted from post #\d+'), '').trim();
    }

    final imageUrl = widget.post['imageUrl'];
    final authorPic = author?['profileImageUrl'];
    final commentsCount = widget.post['commentsCount'] ?? 0;
    final timeAgo = formatTimeAgo(widget.post['createdAt']);

    final cardBg = isDark ? Colors.black : Colors.white;
    final dividerColor = isDark ? const Color(0xFF1C1C1C) : const Color(0xFFEFEFEF);

    return Container(
      color: cardBg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [

          // ── Modern Repost Header (Twitter/Threads style) ──
          if (isRepost && reposter != null)
            InkWell(
              onTap: () {
                final reposterId = reposter['id'];
                final reposterName = reposter['username'] ?? reposter['name'] ?? 'User';
                if (reposterId != null) {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => UserProfilePage(
                        userId: reposterId is int ? reposterId : int.tryParse(reposterId.toString()) ?? 0,
                        userName: reposterName.toString(),
                      ),
                    ),
                  );
                }
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF10B981).withValues(alpha: 0.12) : const Color(0xFFECFDF5),
                  border: Border(
                    bottom: BorderSide(
                      color: isDark ? const Color(0xFF10B981).withValues(alpha: 0.2) : const Color(0xFFA7F3D0),
                      width: 0.8,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.repeat_rounded,
                      size: 16,
                      color: Color(0xFF10B981),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: RichText(
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        text: TextSpan(
                          style: TextStyle(
                            fontSize: 12.5,
                            color: isDark ? Colors.grey[300] : Colors.grey[700],
                          ),
                          children: [
                            TextSpan(
                              text: '${reposter['username'] ?? reposter['name'] ?? 'Someone'}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            const TextSpan(text: ' reposted'),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ── Header: Avatar + Username + Dots ──
          GestureDetector(
            onTap: () {
              final authorId = author?['id'];
              if (authorId != null) {
                Navigator.push(context, MaterialPageRoute(
                  builder: (context) => UserProfilePage(
                    userId: authorId,
                    userName: name.toString(),
                  ),
                ));
              }
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  // Avatar with gradient ring
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Color(0xFFE1306C), Color(0xFFF77737), Color(0xFFFCAF45)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: cardBg,
                        shape: BoxShape.circle,
                      ),
                      child: CircleAvatar(
                        radius: 16,
                        backgroundColor: isDark ? Colors.grey[800] : Colors.grey[200],
                        backgroundImage: (authorPic != null && authorPic.toString().isNotEmpty)
                            ? NetworkImage(authorPic.toString())
                            : null,
                        child: (authorPic == null || authorPic.toString().isEmpty)
                            ? Text(
                                username.toString().substring(0, 1).toUpperCase(),
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                              )
                            : null,
                      ),
                    ),
                  ),

                  const SizedBox(width: 10),

                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          username.toString(),
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                            color: isDark ? Colors.white : Colors.black,
                          ),
                        ),
                        if (timeAgo.isNotEmpty)
                          Text(
                            timeAgo,
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? Colors.grey[500] : Colors.grey[500],
                            ),
                          ),
                      ],
                    ),
                  ),

                  IconButton(
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    icon: Icon(Icons.more_horiz,
                        color: isDark ? Colors.white : Colors.black),
                    onPressed: _showPostMenu,
                  ),
                ],
              ),
            ),
          ),

          // ── Image with double-tap to like ──
          if (imageUrl != null && imageUrl.toString().isNotEmpty)
            GestureDetector(
              onDoubleTap: _doubleTapLike,
              onTap: () {
                Navigator.push(context, MaterialPageRoute(
                  builder: (context) => PostDetailPage(post: widget.post),
                ));
              },
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Image.network(
                    imageUrl.toString(),
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      height: 300,
                      color: isDark ? Colors.grey[900] : Colors.grey[100],
                      child: const Center(
                        child: Icon(Icons.broken_image_outlined, size: 50, color: Colors.grey),
                      ),
                    ),
                  ),
                  if (_showHeart)
                    ScaleTransition(
                      scale: _heartAnim,
                      child: const Icon(Icons.favorite, color: Colors.white, size: 100),
                    ),
                ],
              ),
            )
          else
            // No image - show text as tap-target
            GestureDetector(
              onTap: () {
                Navigator.push(context, MaterialPageRoute(
                  builder: (context) => PostDetailPage(post: widget.post),
                ));
              },
              child: Container(
                width: double.infinity,
                constraints: const BoxConstraints(minHeight: 220),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
                decoration: BoxDecoration(color: _postColor(widget.post['backgroundColor'], isDark)),
                child: Center(child: Text(
                  displayContent.isNotEmpty ? displayContent : displayTitle,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: (widget.post['fontSize'] is num) ? (widget.post['fontSize'] as num).toDouble() : 22,
                    fontWeight: FontWeight.w700,
                    color: _postTextColor(widget.post['backgroundColor'], isDark),
                    height: 1.3,
                  ),
                )),
              ),
            ),

          // ── Action Row: Like / Comment / Share / Bookmark ──
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              children: [
                // Like
                GestureDetector(
                  onTap: isLoadingLike ? null : toggleLike,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: isLoadingLike
                        ? const SizedBox(
                            width: 22, height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            isLiked ? Icons.favorite : Icons.favorite_border,
                            size: 26,
                            color: isLiked ? Colors.red : (isDark ? Colors.white : Colors.black),
                          ),
                  ),
                ),
                const SizedBox(width: 4),

                // Comment
                GestureDetector(
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(
                      builder: (context) => CommentsPage(postId: widget.post['id'], postOwnerId: _ownerId),
                    ));
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: Icon(Icons.chat_bubble_outline_rounded,
                        size: 24, color: isDark ? Colors.white : Colors.black),
                  ),
                ),
                const SizedBox(width: 4),

                // Repost to Feed
                GestureDetector(
                  onTap: repostPost,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: Icon(Icons.repeat_rounded, size: 25, color: isDark ? Colors.white : Colors.black),
                  ),
                ),
                const SizedBox(width: 4),

                // Send / Share Post with chat
                GestureDetector(
                  onTap: () => _showShareOptions(context, displayTitle, displayContent),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: Icon(Icons.send_outlined,
                        size: 24, color: isDark ? Colors.white : Colors.black),
                  ),
                ),

                const Spacer(),

                // Bookmark / Save
                GestureDetector(
                  onTap: toggleSave,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: Icon(
                      isSaved ? Icons.bookmark : Icons.bookmark_border,
                      size: 26,
                      color: isDark ? Colors.white : Colors.black,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Likes count (authors can hide it from others) ──
          if (widget.post['likesHidden'] == true)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text(
                isLiked ? 'Liked by you' : 'Likes are hidden',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.grey[500]),
              ),
            )
          else if (likeCount > 0)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text(
                '$likeCount ${likeCount == 1 ? 'like' : 'likes'}',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13.5,
                  color: isDark ? Colors.white : Colors.black,
                ),
              ),
            ),

          // ── Caption ──
          if (displayTitle.isNotEmpty || displayContent.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 2),
              child: RichTextView(
                displayTitle.isNotEmpty
                    ? (displayContent.isNotEmpty && displayContent != displayTitle
                        ? '$displayTitle\n$displayContent'
                        : displayTitle)
                    : displayContent,
                style: TextStyle(
                  fontSize: 13.5,
                  color: isDark ? Colors.white : Colors.black,
                  height: 1.4,
                ),
                leading: [
                  TextSpan(
                    text: '${username.toString()} ',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),

          // ── View comments ──
          if (commentsCount > 0)
            GestureDetector(
              onTap: () {
                Navigator.push(context, MaterialPageRoute(
                  builder: (context) => CommentsPage(postId: widget.post['id'], postOwnerId: _ownerId),
                ));
              },
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 2, 14, 2),
                child: Text(
                  'View all $commentsCount comment${commentsCount == 1 ? '' : 's'}',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.grey[500] : Colors.grey[500],
                  ),
                ),
              ),
            ),

          const SizedBox(height: 10),

          Divider(height: 1, color: dividerColor),
        ],
      ),
    );
  }
  }
class CommentsPage extends StatefulWidget {
  final int postId;
  /// Lets the post's owner moderate (delete) any comment.
  final int? postOwnerId;

  const CommentsPage({
    super.key,
    required this.postId,
    this.postOwnerId,
  });

  @override
  State<CommentsPage> createState() => _CommentsPageState();
}

class _CommentsPageState extends State<CommentsPage> {
  List<dynamic> comments = [];
  bool isLoading = true;
  String? errorMessage;
  int? currentUserId;
  String? restriction;
  List<String> hiddenWords = [];

  final commentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    loadComments();
  }

  @override
  void dispose() {
    commentController.dispose();
    super.dispose();
  }

  int? _extractUserId(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final normalized = base64Url.normalize(parts[1]);
      final payload = jsonDecode(utf8.decode(base64Url.decode(normalized)));
      return payload['sub'];
    } catch (_) {
      return null;
    }
  }

  Future<void> loadComments() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');

      if (token == null || token.isEmpty) {
        setState(() {
          errorMessage = 'Login token not found';
          isLoading = false;
        });
        return;
      }

      currentUserId = _extractUserId(token);

      final response = await http.get(
        Uri.parse(
          '$apiBaseUrl/comments/${widget.postId}',
        ),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final words = await loadHiddenWords();

        setState(() {
          hiddenWords = words;
          comments = (data['comments'] as List? ?? [])
              .where((c) => !containsHiddenWord(c['content']?.toString(), words))
              .toList();
          restriction = data['canComment'] == false
              ? (data['commentRestriction']?.toString() ?? 'Comments are limited on this post')
              : null;
          isLoading = false;
        });
      } else {
        setState(() {
          errorMessage =
              'Failed to load comments: ${response.statusCode}';
          isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        errorMessage = 'Connection error: $e';
        isLoading = false;
      });
    }
  }

  Future<void> addComment() async {
    final content = commentController.text.trim();

    if (content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a comment'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');

      if (token == null || token.isEmpty) return;

      final response = await http.post(
        Uri.parse(
          '$apiBaseUrl/comments/${widget.postId}',
        ),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'content': content,
        }),
      );

      if (response.statusCode == 200 ||
          response.statusCode == 201) {
        commentController.clear();
        await loadComments();
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add comment: ${response.body}'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Connection error: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> deleteComment(int commentId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Comment?'),
        content: const Text('Are you sure you want to delete this comment?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');
      if (token == null) return;

      final response = await http.delete(
        Uri.parse('$apiBaseUrl/comments/$commentId'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        setState(() {
          comments.removeWhere((c) => c['id'] == commentId);
        });
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Comment deleted')),
        );
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete comment: ${response.body}'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Connection error: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Comments',
          style: TextStyle(
            fontWeight: FontWeight.bold,
          ),
        ),
      ),

      body: Column(
        children: [
          Expanded(
            child: buildComments(),
          ),

          if (restriction != null)
            SafeArea(
              top: false,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                color: Theme.of(context).cardColor,
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.lock_outline, size: 16, color: Colors.grey),
                  const SizedBox(width: 8),
                  Flexible(child: Text(restriction!, style: const TextStyle(color: Colors.grey))),
                ]),
              ),
            )
          else
          Container(
            padding: const EdgeInsets.fromLTRB(
              12,
              8,
              12,
              8,
            ),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              boxShadow: const [
                BoxShadow(
                  blurRadius: 5,
                  color: Colors.black12,
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: commentController,
                    textInputAction:
                        TextInputAction.send,
                    onSubmitted: (_) {
                      addComment();
                    },
                    decoration: const InputDecoration(
                      hintText: 'Write a comment...',
                      border: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.all(
                          Radius.circular(25),
                        ),
                      ),
                      contentPadding:
                          EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                IconButton(
                  onPressed: addComment,
                  icon: const Icon(
                    Icons.send_rounded,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget buildComments() {
    if (isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment:
              MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 60,
              color: Colors.red,
            ),
            const SizedBox(height: 16),
            Text(
              errorMessage!,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  isLoading = true;
                  errorMessage = null;
                });

                loadComments();
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (comments.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.chat_bubble_outline_rounded,
              size: 60,
              color: Colors.grey[300],
            ),
            const SizedBox(height: 12),
            Text(
              'No comments yet',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Be the first to comment!',
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: comments.length,
      separatorBuilder: (context, index) => const Divider(
        height: 1,
        indent: 68,
      ),
      itemBuilder: (context, index) {
        final comment = comments[index];

        final username =
            comment['username'] ??
            comment['name'] ??
            'Unknown User';
        final name = comment['name'] ?? username;
        final content = comment['content'] ?? '';
        final profileImageUrl = comment['profileImageUrl'];
        final createdAt = comment['createdAt'];
        final commentUserId = comment['userId'];
        final isMyComment = currentUserId != null &&
            commentUserId == currentUserId;
        final canModerate = isMyComment ||
            (currentUserId != null && currentUserId == widget.postOwnerId);

        return ListTile(
          onTap: () {
            if (commentUserId != null) {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => UserProfilePage(
                    userId: commentUserId,
                    userName: name.toString(),
                  ),
                ),
              );
            }
          },
          leading: CircleAvatar(
            radius: 20,
            backgroundImage: profileImageUrl != null &&
                    profileImageUrl.toString().isNotEmpty
                ? NetworkImage(profileImageUrl.toString())
                : null,
            child: profileImageUrl == null ||
                    profileImageUrl.toString().isEmpty
                ? Text(
                    username
                        .toString()
                        .substring(0, 1)
                        .toUpperCase(),
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                    ),
                  )
                : null,
          ),
          title: Row(
            children: [
              Text(
                name.toString(),
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              const SizedBox(width: 8),
              if (createdAt != null)
                Text(
                  formatTimeAgo(createdAt),
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey[500],
                  ),
                ),
            ],
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: RichTextView(
              content.toString(),
              style: TextStyle(fontSize: 14, color: Theme.of(context).colorScheme.onSurface),
            ),
          ),
          trailing: canModerate
              ? IconButton(
                  icon: const Icon(
                    Icons.delete_outline,
                    color: Colors.redAccent,
                    size: 20,
                  ),
                  onPressed: () {
                    if (comment['id'] != null) {
                      deleteComment(comment['id']);
                    }
                  },
                )
              : null,
        );
      },
    );
  }
}


class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final emailController = TextEditingController();
  final usernameController = TextEditingController();
  final nameController = TextEditingController();
  final passwordController = TextEditingController();

  bool isLoading = false;

  @override
  void dispose() {
    emailController.dispose();
    usernameController.dispose();
    nameController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> register() async {
    final email = emailController.text.trim();
    final username = usernameController.text.trim();
    final name = nameController.text.trim();
    final password = passwordController.text;

    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter your name'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (username.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a username'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (username.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Username must be at least 3 characters'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter your email address'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid email address'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (password.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password must be at least 6 characters'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() {
      isLoading = true;
    });

    try {
      final response = await http.post(
        Uri.parse(
          '$apiBaseUrl/auth/register',
        ),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'username': username,
          'password': password,
          'name': name,
        }),
      );

      if (response.statusCode == 201 ||
          response.statusCode == 200) {
        if (!mounted) return;

        final data = jsonDecode(response.body);
        if (data is Map && data['accessToken'] != null) {
          // The API returns a session on signup — no second login needed.
          await completeLogin(context, data);
          return;
        }
        if (!mounted) return;

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Registration successful! Please login.',
            ),
            backgroundColor: Colors.green,
          ),
        );

        Navigator.pop(context);
      } else {
        if (!mounted) return;

        String errorMessage = 'Registration failed';
        try {
          final err = jsonDecode(response.body);
          if (err['message'] != null) {
            errorMessage = err['message'] is List
                ? (err['message'] as List).join(', ')
                : err['message'].toString();
          }
        } catch (_) {}

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Connection error: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? Colors.black : Colors.white,
      appBar: AppBar(
        backgroundColor: isDark ? Colors.black : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new_rounded,
              color: isDark ? Colors.white : Colors.black, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Logo ──
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [
                            Color(0xFFE1306C),
                            Color(0xFFF77737),
                            Color(0xFFFCAF45),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(
                        Icons.person_add_rounded,
                        color: Colors.white,
                        size: 36,
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  Text(
                    'Create Account',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: isDark ? Colors.white : Colors.black,
                    ),
                  ),

                  const SizedBox(height: 6),

                  Text(
                    'Sign up to see photos and videos\nfrom your friends',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),

                  const SizedBox(height: 32),

                  // ── Name ──
                  TextField(
                    controller: nameController,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: InputDecoration(
                      hintText: 'Full Name',
                      prefixIcon: Icon(Icons.badge_outlined,
                          color: isDark ? Colors.grey[400] : Colors.grey[600], size: 20),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Username ──
                  TextField(
                    controller: usernameController,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: InputDecoration(
                      hintText: 'Username',
                      prefixIcon: Icon(Icons.alternate_email,
                          color: isDark ? Colors.grey[400] : Colors.grey[600], size: 20),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Email ──
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: InputDecoration(
                      hintText: 'Email address',
                      prefixIcon: Icon(Icons.email_outlined,
                          color: isDark ? Colors.grey[400] : Colors.grey[600], size: 20),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Password ──
                  TextField(
                    controller: passwordController,
                    obscureText: true,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: InputDecoration(
                      hintText: 'Password (min. 6 chars)',
                      prefixIcon: Icon(Icons.lock_outline,
                          color: isDark ? Colors.grey[400] : Colors.grey[600], size: 20),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── Register Button ──
                  SizedBox(
                    height: 50,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : register,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isDark ? Colors.white : Colors.black,
                        foregroundColor: isDark ? Colors.black : Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: isLoading
                          ? SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: isDark ? Colors.black : Colors.white,
                              ),
                            )
                          : const Text(
                              'Sign up',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── OR Divider ──
                  Row(
                    children: [
                      Expanded(child: Divider(color: isDark ? Colors.grey[800] : Colors.grey[300])),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Text(
                          'OR',
                          style: TextStyle(
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      Expanded(child: Divider(color: isDark ? Colors.grey[800] : Colors.grey[300])),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // ── Google Sign-In ──
                  if (kIsWeb)
                    GoogleWebSignInButton(
                      onSuccess: (idToken) =>
                          _exchangeTokenAndLogin(context, idToken),
                      onError: (error) =>
                          _showAuthErrorDialog(context, 'Google Sign-In', error),
                    )
                  else
                    SizedBox(
                      height: 50,
                      child: OutlinedButton(
                        onPressed: isLoading
                            ? null
                            : () => handleGoogleSignIn(context),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(
                              color: isDark
                                  ? Colors.grey[700]!
                                  : Colors.grey[300]!),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          foregroundColor:
                              isDark ? Colors.white : Colors.black,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Image.network(
                              'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
                              height: 20,
                              width: 20,
                              errorBuilder: (_, _, _) =>
                                  const Icon(Icons.g_mobiledata, size: 24),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'Continue with Google',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                  const SizedBox(height: 28),

                  // ── Login link ──
                  Center(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: RichText(
                        text: TextSpan(
                          style: TextStyle(fontSize: 14, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                          children: [
                            const TextSpan(text: 'Already have an account? '),
                            TextSpan(
                              text: 'Log in',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : Colors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}


class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  int? myUserId;
  String? username;
  bool isPrivateAccount = false;
  String? name;
  String? email;
  String? bio;
  String? profileImageUrl;

  bool isLoading = true;
  bool isSaving = false;
  String? errorMessage;
  int followersCount = 0;
  int followingCount = 0;

  List<dynamic> myPosts = [];
  bool isPostsLoading = true;
  List<Map<String, dynamic>> savedPosts = [];
  bool isSavedPostsLoading = true;

  XFile? selectedImage;

  final TextEditingController nameController =
      TextEditingController();

  final TextEditingController usernameController =
      TextEditingController();

  final TextEditingController bioController =
      TextEditingController();

  @override
  void initState() {
    super.initState();
    loadProfile();
    loadSavedPostsForProfile();
    loadMyPosts();
  }

  @override
  void dispose() {
    nameController.dispose();
    usernameController.dispose();
    bioController.dispose();
    super.dispose();
  }

  Future<void> loadProfile() async {
    try {
      final prefs =
          await SharedPreferences.getInstance();

      final token =
          prefs.getString('accessToken');

      if (token == null || token.isEmpty) {
        setState(() {
          errorMessage = 'Login token not found';
          isLoading = false;
        });
        return;
      }

      final response = await http.get(
        Uri.parse(
          '$apiBaseUrl/users/me',
        ),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        setState(() {
          myUserId = data['id'];
          isPrivateAccount = data['isPrivate'] == true;
          username = data['username'];
          name = data['name'];
          email = data['email'];
          bio = data['bio'];
          profileImageUrl =
              data['profileImageUrl'];
          followersCount = data['followersCount'] ?? 0;
          followingCount = data['followingCount'] ?? 0;

          nameController.text = name ?? '';
          usernameController.text =
              username ?? '';
          bioController.text = bio ?? '';

          isLoading = false;
        });
      } else {
        setState(() {
          errorMessage =
              'Failed to load profile: ${response.statusCode}';
          isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        errorMessage =
            'Connection error: $e';
        isLoading = false;
      });
    }
  }

  Future<void> loadMyPosts() async {
    try {
      final prefs =
          await SharedPreferences.getInstance();

      final token =
          prefs.getString('accessToken');

      if (token == null || token.isEmpty) {
        return;
      }

      final response = await http.get(
        Uri.parse(
          '$apiBaseUrl/posts/me',
        ),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        setState(() {
          myPosts = data;
          isPostsLoading = false;
        });
      } else {
        setState(() {
          isPostsLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        isPostsLoading = false;
      });
    }
  }

  // Saved posts are stored on the server (shared with the web app).
  Future<void> loadSavedPostsForProfile() async {
    final res = await Api.get('/posts/saved');
    if (!mounted) return;
    setState(() {
      if (res.ok && res.data is List) {
        savedPosts = (res.data as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      isSavedPostsLoading = false;
    });
  }

  Future<void> pickImage() async {
    final ImagePicker picker =
        ImagePicker();

    final XFile? image =
        await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );

    if (image != null) {
      setState(() {
        selectedImage = image;
      });
    }
  }

  Future<void> updateProfile() async {
    setState(() {
      isSaving = true;
    });

    try {
      final prefs =
          await SharedPreferences.getInstance();

      final token =
          prefs.getString('accessToken');

      if (token == null || token.isEmpty) {
        throw Exception(
          'Login token not found',
        );
      }

      final request =
          http.MultipartRequest(
        'PATCH',
        Uri.parse(
          '$apiBaseUrl/users/me',
        ),
      );

      request.headers['Authorization'] =
          'Bearer $token';

      request.fields['name'] =
          nameController.text.trim();

      request.fields['username'] =
          usernameController.text.trim();

      request.fields['bio'] =
          bioController.text;

      if (selectedImage != null) {
        final bytes =
            await selectedImage!.readAsBytes();

        request.files.add(
          http.MultipartFile.fromBytes(
            'image',
            bytes,
            filename: selectedImage!.name,
          ),
        );
      }

      final streamedResponse =
          await request.send();

      final response =
          await http.Response.fromStream(
        streamedResponse,
      );

      if (response.statusCode == 200) {
        final data =
            jsonDecode(response.body);

        final user = data['user'];

        setState(() {
          name = user['name'];
          username = user['username'];
          bio = user['bio'];
          profileImageUrl =
              user['profileImageUrl'];

          selectedImage = null;
          isSaving = false;
        });

        if (!mounted) return;

        ScaffoldMessenger.of(context)
            .showSnackBar(
          const SnackBar(
            content: Text(
              'Profile updated successfully',
            ),
          ),
        );
      } else {
        setState(() {
          isSaving = false;
        });

        if (!mounted) return;

        ScaffoldMessenger.of(context)
            .showSnackBar(
          SnackBar(
            content: Text(
              'Failed to update profile: ${response.statusCode}',
            ),
          ),
        );
      }
    } catch (e) {
      setState(() {
        isSaving = false;
      });

      if (!mounted) return;

      ScaffoldMessenger.of(context)
          .showSnackBar(
        SnackBar(
          content: Text(
            'Error: $e',
          ),
        ),
      );
    }
  }

  void _showEditProfileModal() {
    nameController.text = name ?? '';
    usernameController.text = username ?? '';
    bioController.text = bio ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF121212) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          final isDark = Theme.of(context).brightness == Brightness.dark;
          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom,
              left: 20,
              right: 20,
              top: 16,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: Text('Cancel', style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[700])),
                      ),
                      Text(
                        'Edit profile',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black,
                        ),
                      ),
                      TextButton(
                        onPressed: isSaving
                            ? null
                            : () async {
                                Navigator.pop(context);
                                await updateProfile();
                              },
                        child: Text(
                          'Done',
                          style: TextStyle(
                            color: const Color(0xFF3797EF),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(),
                  const SizedBox(height: 12),
                  Center(
                    child: Column(
                      children: [
                        CircleAvatar(
                          radius: 45,
                          backgroundImage: profileImageUrl != null && profileImageUrl!.isNotEmpty
                              ? NetworkImage(profileImageUrl!)
                              : null,
                          child: profileImageUrl == null || profileImageUrl!.isEmpty
                              ? const Icon(Icons.person, size: 45)
                              : null,
                        ),
                        const SizedBox(height: 8),
                        GestureDetector(
                          onTap: () async {
                            await pickImage();
                            setModalState(() {});
                          },
                          child: const Text(
                            'Change profile photo',
                            style: TextStyle(
                              color: Color(0xFF3797EF),
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: nameController,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: const InputDecoration(
                      labelText: 'Name',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: usernameController,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: bioController,
                    maxLines: 3,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: const InputDecoration(
                      labelText: 'Bio',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  int _selectedTab = 0;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = isDark ? const Color(0xFF2A2A2A) : const Color(0xFFEFEFEF);

    return Scaffold(
      backgroundColor: isDark ? Colors.black : Colors.white,
      appBar: AppBar(
        backgroundColor: isDark ? Colors.black : Colors.white,
        elevation: 0,
        titleSpacing: 16,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isPrivateAccount) ...[
              Icon(Icons.lock_outline, size: 16, color: isDark ? Colors.white : Colors.black),
              const SizedBox(width: 6),
            ],
            Text(
              username ?? 'profile',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 20,
                color: isDark ? Colors.white : Colors.black,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.add_box_outlined, color: isDark ? Colors.white : Colors.black),
            onPressed: () async {
              final created = await Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const CreatePostPage()),
              );
              if (created == true) loadMyPosts();
            },
          ),
          PopupMenuButton<String>(
            icon: Icon(Icons.menu_rounded, color: isDark ? Colors.white : Colors.black),
            onSelected: (val) async {
              if (val == 'settings') {
                Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsPage()));
              } else if (val == 'theme') {
                openThemeSheet(context);
              } else if (val == 'logout') {
                await logoutUser(context);
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'settings',
                child: Row(
                  children: [
                    Icon(Icons.settings_outlined, size: 20),
                    SizedBox(width: 10),
                    Text('Settings'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'theme',
                child: Row(
                  children: [
                    Icon(
                      themeNotifier.value == ThemeMode.light
                          ? Icons.dark_mode_outlined
                          : themeNotifier.value == ThemeMode.dark
                              ? Icons.light_mode_outlined
                              : Icons.brightness_auto_outlined,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      themeNotifier.value == ThemeMode.system
                          ? 'System theme'
                          : themeNotifier.value == ThemeMode.light
                              ? 'Dark mode'
                              : 'Light mode',
                    ),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 20, color: Colors.redAccent),
                    SizedBox(width: 10),
                    Text('Log out', style: TextStyle(color: Colors.redAccent)),
                  ],
                ),
              ),
            ],
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, color: borderColor),
        ),
      ),
      body: buildBody(),
    );
  }

  Widget _buildStatColumn(String label, String count) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          count,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white : Colors.black,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
        ),
      ],
    );
  }

  Widget _buildHighlightItem(String title, IconData icon, bool isDark, bool isAdd) {
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF2F2F2),
              border: Border.all(
                color: isDark ? const Color(0xFF363636) : const Color(0xFFDBDBDB),
                width: 1.5,
              ),
            ),
            child: Icon(icon, color: isDark ? Colors.white : Colors.black, size: 24),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[300] : Colors.grey[700]),
          ),
        ],
      ),
    );
  }

  Widget buildBody() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 60),
            const SizedBox(height: 16),
            Text(errorMessage!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  isLoading = true;
                  errorMessage = null;
                });
                loadProfile();
                loadMyPosts();
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    final displayName = name?.isNotEmpty == true ? name! : username ?? 'User';
    final firstLetter = displayName.isNotEmpty ? displayName.substring(0, 1).toUpperCase() : 'U';

    return RefreshIndicator(
      onRefresh: () async {
        await loadProfile();
        await loadMyPosts();
      },
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),

                  // ── Header Row: Avatar + Stats ──
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: [
                              Color(0xFFE1306C),
                              Color(0xFFF77737),
                              Color(0xFFFCAF45),
                            ],
                            begin: Alignment.topRight,
                            end: Alignment.bottomLeft,
                          ),
                        ),
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isDark ? Colors.black : Colors.white,
                          ),
                          child: CircleAvatar(
                            radius: 40,
                            backgroundImage: profileImageUrl != null && profileImageUrl!.isNotEmpty
                                ? NetworkImage(profileImageUrl!)
                                : null,
                            child: profileImageUrl == null || profileImageUrl!.isEmpty
                                ? Text(
                                    firstLetter,
                                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                                  )
                                : null,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _buildStatColumn('Posts', isPostsLoading ? '–' : '${myPosts.length}'),
                            GestureDetector(
                              onTap: myUserId == null
                                  ? null
                                  : () => Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => UserListPage(
                                            userId: myUserId!,
                                            title: 'Followers',
                                            endpoint: 'followers',
                                          ),
                                        ),
                                      ),
                              child: _buildStatColumn('Followers', '$followersCount'),
                            ),
                            GestureDetector(
                              onTap: myUserId == null
                                  ? null
                                  : () => Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => UserListPage(
                                            userId: myUserId!,
                                            title: 'Following',
                                            endpoint: 'following',
                                          ),
                                        ),
                                      ),
                              child: _buildStatColumn('Following', '$followingCount'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // ── Name & Bio ──
                  Text(
                    displayName,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: isDark ? Colors.white : Colors.black,
                    ),
                  ),
                  if (bio != null && bio!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      bio!,
                      style: TextStyle(
                        fontSize: 14,
                        color: isDark ? Colors.grey[300] : Colors.grey[800],
                        height: 1.3,
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  // ── Action Buttons ──
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _showEditProfileModal,
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: isDark ? const Color(0xFF363636) : const Color(0xFFDBDBDB)),
                            backgroundColor: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFEFEFEF),
                            foregroundColor: isDark ? Colors.white : Colors.black,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text('Edit profile', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Profile link copied: @$username')),
                            );
                          },
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: isDark ? const Color(0xFF363636) : const Color(0xFFDBDBDB)),
                            backgroundColor: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFEFEFEF),
                            foregroundColor: isDark ? Colors.white : Colors.black,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text('Share profile', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 18),

                  // ── Highlights Row ──
                  SizedBox(
                    height: 85,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _buildHighlightItem('New', Icons.add, isDark, true),
                        _buildHighlightItem('Memories', Icons.star_border, isDark, false),
                        _buildHighlightItem('Travel', Icons.flight, isDark, false),
                        _buildHighlightItem('Vibes', Icons.music_note, isDark, false),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Tab Bar (Grid / Tagged) ──
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _selectedTab = 0),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: _selectedTab == 0 ? (isDark ? Colors.white : Colors.black) : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                            ),
                            child: Icon(
                              Icons.grid_on_sharp,
                              color: _selectedTab == 0 ? (isDark ? Colors.white : Colors.black) : Colors.grey,
                              size: 22,
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _selectedTab = 1),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: _selectedTab == 1 ? (isDark ? Colors.white : Colors.black) : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                            ),
                            child: Icon(
                              Icons.account_box_outlined,
                              color: _selectedTab == 1 ? (isDark ? Colors.white : Colors.black) : Colors.grey,
                              size: 24,
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _selectedTab = 2),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: _selectedTab == 2 ? (isDark ? Colors.white : Colors.black) : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                            ),
                            child: Icon(
                              isDark ? Icons.bookmark : Icons.bookmark_border,
                              color: _selectedTab == 2 ? (isDark ? Colors.white : Colors.black) : Colors.grey,
                              size: 24,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // ── Posts Grid or Tagged Empty State ──
          if (_selectedTab == 2)
            isSavedPostsLoading
                ? const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  )
                : savedPosts.isEmpty
                    ? SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 60),
                          child: Center(
                            child: Column(
                              children: [
                                Icon(Icons.bookmark_border, size: 54, color: Colors.grey),
                                const SizedBox(height: 12),
                                Text('No saved posts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black)),
                                const SizedBox(height: 6),
                                Text('Posts you save will appear here.', style: TextStyle(color: Colors.grey[500], fontSize: 13)),
                              ],
                            ),
                          ),
                        ),
                      )
                    : SliverPadding(
                        padding: const EdgeInsets.all(3),
                        sliver: SliverGrid(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final post = savedPosts[index];
                              final imageUrl = post['imageUrl']?.toString();
                              return InkWell(
                                onTap: () async {
                                  await Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => PostDetailPage(post: post)),
                                  );
                                  await loadSavedPostsForProfile();
                                },
                                child: imageUrl != null && imageUrl.isNotEmpty
                                    ? Image.network(imageUrl, fit: BoxFit.cover)
                                    : Container(
                                        color: isDark ? const Color(0xFF222222) : Colors.grey[200],
                                        padding: const EdgeInsets.all(8),
                                        child: Center(
                                          child: Text(
                                            (post['title'] ?? post['content'] ?? 'Saved post').toString(),
                                            maxLines: 5,
                                            overflow: TextOverflow.ellipsis,
                                            textAlign: TextAlign.center,
                                          ),
                                        ),
                                      ),
                              );
                            },
                            childCount: savedPosts.length,
                          ),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            crossAxisSpacing: 3,
                            mainAxisSpacing: 3,
                          ),
                        ),
                      )
          else if (_selectedTab == 1)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 60),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.assignment_ind_outlined, size: 54, color: Colors.grey[600]),
                      const SizedBox(height: 12),
                      Text('Photos and videos of you', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black)),
                      const SizedBox(height: 6),
                      Text("When people tag you in photos and videos,\nthey'll appear here.", textAlign: TextAlign.center, style: TextStyle(color: Colors.grey[500], fontSize: 13)),
                    ],
                  ),
                ),
              ),
            )
          else if (isPostsLoading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (myPosts.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 60),
                child: Center(
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: isDark ? Colors.white : Colors.black, width: 2),
                        ),
                        child: Icon(Icons.camera_alt_outlined, size: 36, color: isDark ? Colors.white : Colors.black),
                      ),
                      const SizedBox(height: 16),
                      Text('Profile Photos', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black)),
                      const SizedBox(height: 8),
                      Text('When you share photos, they will appear on your profile.', style: TextStyle(color: Colors.grey[500], fontSize: 14)),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () async {
                          final created = await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const CreatePostPage()),
                          );
                          if (created == true) loadMyPosts();
                        },
                        child: const Text('Share your first photo', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF3797EF))),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 1.5,
                mainAxisSpacing: 1.5,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final post = myPosts[index];
                  final imageUrl = post['imageUrl'];
                  return GestureDetector(
                    onTap: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => PostDetailPage(post: post),
                        ),
                      );
                      if (result == 'deleted') loadMyPosts();
                    },
                    child: imageUrl != null && imageUrl.toString().isNotEmpty
                        ? Image.network(imageUrl, fit: BoxFit.cover)
                        : PostGridTile(
                            post: Map<String, dynamic>.from(post as Map),
                            onTap: () async {
                              final result = await Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (context) => PostDetailPage(post: Map<String, dynamic>.from(post))),
                              );
                              if (result == 'deleted') loadMyPosts();
                            },
                          ),
                  );
                },
                childCount: myPosts.length,
              ),
            ),
        ],
      ),
    );
  }
}

// ======================================================
// POST DETAIL PAGE
// ======================================================

class PostDetailPage extends StatefulWidget {
  final Map<String, dynamic> post;

  const PostDetailPage({
    super.key,
    required this.post,
  });

  @override
  State<PostDetailPage> createState() =>
      _PostDetailPageState();
}

class _PostDetailPageState
    extends State<PostDetailPage> {
  late Map<String, dynamic> post;
  bool isDeleting = false;

  @override
  void initState() {
    super.initState();
    post = Map<String, dynamic>.from(
      widget.post,
    );
  }

  String _formatDate(String? raw) {
    if (raw == null) return '';
    try {
      final dt =
          DateTime.parse(raw).toLocal();
      return '${dt.year}/${dt.month.toString().padLeft(2, '0')}/${dt.day.toString().padLeft(2, '0')}  '
          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return raw;
    }
  }

  Future<String?> _getToken() async {
    final prefs =
        await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  // ── EDIT ──────────────────────────────
  void _showEditSheet() {
    final titleCtrl = TextEditingController(
      text: post['title'] ?? '',
    );
    final contentCtrl =
        TextEditingController(
      text: post['content'] ?? '',
    );
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(
                  ctx,
                ).viewInsets.bottom,
              ),
              child: Container(
                decoration:
                    const BoxDecoration(
                  color: Colors.white,
                  borderRadius:
                      BorderRadius.vertical(
                    top: Radius.circular(20),
                  ),
                ),
                padding:
                    const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize:
                      MainAxisSize.min,
                  crossAxisAlignment:
                      CrossAxisAlignment
                          .start,
                  children: [
                    // Handle bar
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration:
                            BoxDecoration(
                          color: Colors
                              .grey[300],
                          borderRadius:
                              BorderRadius
                                  .circular(
                                    2,
                                  ),
                        ),
                      ),
                    ),
                    const SizedBox(
                      height: 16,
                    ),

                    const Text(
                      'Edit Post',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight:
                            FontWeight.bold,
                      ),
                    ),

                    const SizedBox(
                      height: 20,
                    ),

                    TextField(
                      controller: titleCtrl,
                      decoration:
                          const InputDecoration(
                        labelText: 'Title',
                        border:
                            OutlineInputBorder(),
                      ),
                    ),

                    const SizedBox(
                      height: 16,
                    ),

                    TextField(
                      controller:
                          contentCtrl,
                      maxLines: 4,
                      decoration:
                          const InputDecoration(
                        labelText: 'Content',
                        border:
                            OutlineInputBorder(),
                        alignLabelWithHint:
                            true,
                      ),
                    ),

                    const SizedBox(
                      height: 20,
                    ),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: isSaving
                            ? null
                            : () async {
                                // Capture before async
                                final sheetNav = Navigator.of(sheetCtx);
                                final sheetMsg = ScaffoldMessenger.of(sheetCtx);
                                setSheetState(
                                  () =>
                                      isSaving =
                                          true,
                                );

                                try {
                                  final token =
                                      await _getToken();
                                  final res =
                                      await http
                                          .patch(
                                    Uri.parse(
                                      '$apiBaseUrl/posts/${post['id']}',
                                    ),
                                    headers: {
                                      'Authorization':
                                          'Bearer $token',
                                      'Content-Type':
                                          'application/json',
                                    },
                                    body:
                                        jsonEncode({
                                      'title':
                                          titleCtrl
                                              .text
                                              .trim(),
                                      'content':
                                          contentCtrl
                                              .text
                                              .trim(),
                                    }),
                                  );

                                  if (res.statusCode ==
                                      200) {
                                    setState(
                                      () {
                                        post['title'] =
                                            titleCtrl
                                                .text
                                                .trim();
                                        post['content'] =
                                            contentCtrl
                                                .text
                                                .trim();
                                      },
                                    );

                                    if (mounted) {
                                      sheetNav.pop();
                                      sheetMsg.showSnackBar(
                                        const SnackBar(
                                          content:
                                              Text(
                                            'Post updated ✓',
                                          ),
                                          backgroundColor:
                                              Colors
                                                  .green,
                                        ),
                                      );
                                    }
                                  } else {
                                    setSheetState(
                                      () =>
                                          isSaving =
                                              false,
                                    );
                                    if (mounted) {
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        SnackBar(
                                          content:
                                              Text(
                                            'Failed: ${res.statusCode}',
                                          ),
                                          backgroundColor:
                                              Colors
                                                  .red,
                                        ),
                                      );
                                    }
                                  }
                                } catch (e) {
                                  setSheetState(
                                    () =>
                                        isSaving =
                                            false,
                                  );
                                }
                              },
                        style: ElevatedButton
                            .styleFrom(
                          padding:
                              const EdgeInsets
                                  .symmetric(
                            vertical: 16,
                          ),
                          backgroundColor:
                              Colors.blue,
                          foregroundColor:
                              Colors.white,
                        ),
                        child: isSaving
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child:
                                    CircularProgressIndicator(
                                  strokeWidth:
                                      2,
                                  color: Colors
                                      .white,
                                ),
                              )
                            : const Text(
                                'Save Changes',
                                style:
                                    TextStyle(
                                  fontSize: 16,
                                  fontWeight:
                                      FontWeight
                                          .bold,
                                ),
                              ),
                      ),
                    ),

                    const SizedBox(
                      height: 8,
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  // ── DELETE ────────────────────────────
  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Delete Post'),
        content: const Text(
          'Are you sure you want to delete this post? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () =>
                Navigator.pop(dialogCtx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: isDeleting
                ? null
                : () async {
                    Navigator.pop(dialogCtx);
                    setState(() {
                      isDeleting = true;
                    });

                    try {
                      final token =
                          await _getToken();
                      final res =
                          await http.delete(
                        Uri.parse(
                          '$apiBaseUrl/posts/${post['id']}',
                        ),
                        headers: {
                          'Authorization':
                              'Bearer $token',
                        },
                      );

                      if (res.statusCode ==
                          200) {
                        if (mounted) {
                          Navigator.pop(
                            context,
                            'deleted',
                          );
                        }
                      } else {
                        setState(() {
                          isDeleting = false;
                        });
                        if (mounted) {
                          ScaffoldMessenger.of(
                            context,
                          ).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Failed: ${res.statusCode}',
                              ),
                              backgroundColor:
                                  Colors.red,
                            ),
                          );
                        }
                      }
                    } catch (e) {
                      setState(() {
                        isDeleting = false;
                      });
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  // ── BUILD ─────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final author = post['author'] as Map?;
    final authorUsername = (author?['username'] ?? author?['name'] ?? 'User').toString();
    final authorName = (author?['name'] ?? authorUsername).toString();
    final authorPic = author?['profileImageUrl']?.toString();
    final authorId = author?['id'];

    final rawTitle = post['title']?.toString() ?? '';
    final rawContent = post['content']?.toString() ?? '';

    // Check if post is a repost
    final isRepost = post['isRepost'] == true ||
        post['repostedBy'] != null ||
        rawTitle.startsWith('Reposted:') ||
        rawContent.contains('↻ Reposted from post #') ||
        rawContent.contains('[REPOST_META:');

    final reposter = post['repostedBy'] is Map
        ? Map<String, dynamic>.from(post['repostedBy'] as Map)
        : (isRepost && author is Map ? Map<String, dynamic>.from(author) : null);

    // Clean title and content if legacy or not yet parsed
    String displayTitle = rawTitle;
    String displayContent = rawContent;

    if (displayTitle.startsWith('Reposted:')) {
      displayTitle = displayTitle.replaceFirst(RegExp(r'^Reposted:\s*', caseSensitive: false), '').trim();
    }
    if (displayContent.contains('[REPOST_META:')) {
      displayContent = displayContent.replaceAll(RegExp(r'\[REPOST_META:[^\]]+\]\s*'), '').trim();
    }
    if (displayContent.contains('↻ Reposted from post #')) {
      displayContent = displayContent.replaceAll(RegExp(r'\n*↻\s*Reposted from post #\d+'), '').trim();
    }

    final imageUrl = post['imageUrl'];
    final createdAt = _formatDate(
      post['createdAt']?.toString(),
    );

    return Scaffold(
      backgroundColor:
          Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: const Text('Post'),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Edit',
            onPressed: _showEditSheet,
          ),
          IconButton(
            icon: isDeleting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                    ),
                  )
                : const Icon(
                    Icons.delete_outline,
                    color: Colors.red,
                  ),
            tooltip: 'Delete',
            onPressed:
                isDeleting ? null : _confirmDelete,
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment:
              CrossAxisAlignment.start,
          children: [
            // ── Modern Repost Header (Twitter/Threads style) ──
            if (isRepost && reposter != null)
              InkWell(
                onTap: () {
                  final reposterId = reposter['id'];
                  final repName = reposter['username'] ?? reposter['name'] ?? 'User';
                  if (reposterId != null) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => UserProfilePage(
                          userId: reposterId is int ? reposterId : int.tryParse(reposterId.toString()) ?? 0,
                          userName: repName.toString(),
                        ),
                      ),
                    );
                  }
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF10B981).withValues(alpha: 0.12) : const Color(0xFFECFDF5),
                    border: Border(
                      bottom: BorderSide(
                        color: isDark ? const Color(0xFF10B981).withValues(alpha: 0.2) : const Color(0xFFA7F3D0),
                        width: 0.8,
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.repeat_rounded,
                        size: 18,
                        color: Color(0xFF10B981),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: RichText(
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 13,
                              color: isDark ? Colors.grey[300] : Colors.grey[700],
                            ),
                            children: [
                              TextSpan(
                                text: '${reposter['username'] ?? reposter['name'] ?? 'Someone'}',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              const TextSpan(text: ' reposted'),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // ── Author Header ──
            if (author != null)
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                leading: CircleAvatar(
                  radius: 20,
                  backgroundImage: authorPic != null && authorPic.isNotEmpty
                      ? NetworkImage(authorPic)
                      : null,
                  backgroundColor: const Color(0xFF6366F1).withValues(alpha: 0.15),
                  child: authorPic == null || authorPic.isEmpty
                      ? Text(
                          authorUsername.isNotEmpty ? authorUsername[0].toUpperCase() : 'U',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        )
                      : null,
                ),
                title: Text(
                  authorName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                subtitle: Text('@$authorUsername'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () {
                  if (authorId != null) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => UserProfilePage(
                          userId: authorId is int ? authorId : int.tryParse(authorId.toString()) ?? 0,
                          userName: authorName,
                        ),
                      ),
                    );
                  }
                },
              ),

            // IMAGE
            if (imageUrl != null &&
                imageUrl.toString().isNotEmpty)
              Hero(
                tag: 'post-${post['id']}',
                child: AspectRatio(
                  aspectRatio: 1,
                  child: Image.network(
                    imageUrl,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder:
                        (context, error, stackTrace) {
                      return Container(
                        color: Colors.grey[200],
                        child: const Icon(
                          Icons.broken_image_outlined,
                          size: 60,
                        ),
                      );
                    },
                  ),
                ),
              )
            else
              Container(
                width: double.infinity,
                constraints: const BoxConstraints(minHeight: 260),
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(color: _postColor(post['backgroundColor'], isDark)),
                child: Center(child: Text(
                  displayContent.isNotEmpty ? displayContent : displayTitle,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: (post['fontSize'] is num) ? (post['fontSize'] as num).toDouble() : 22,
                    fontWeight: FontWeight.w700,
                    color: _postTextColor(post['backgroundColor'], isDark),
                    height: 1.3,
                  ),
                )),
              ),

            // CONTENT
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment:
                    CrossAxisAlignment.start,
                children: [
                  if (displayTitle.isNotEmpty)
                    Text(
                      displayTitle,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        height: 1.3,
                      ),
                    ),

                  if (createdAt.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(
                          Icons.access_time,
                          size: 14,
                          color: Colors.grey[500],
                        ),
                        const SizedBox(width: 4),
                        Text(
                          createdAt,
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey[500],
                          ),
                        ),
                      ],
                    ),
                  ],

                  if (displayContent.isNotEmpty && displayContent != displayTitle) ...[
                    const SizedBox(height: 16),
                    const Divider(),
                    const SizedBox(height: 16),
                    Text(
                      displayContent,
                      style: const TextStyle(
                        fontSize: 16,
                        height: 1.6,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ======================================================
// SEARCH PAGE
// ======================================================

class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final TextEditingController searchController = TextEditingController();

  List<dynamic> results = [];
  List<Map<String, dynamic>> history = [];
  bool isSearching = false;
  bool hasSearched = false;
  Timer? _debounceTimer;

  static const String _historyKey = 'search_history';

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    searchController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_historyKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          setState(() {
            history = decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _saveHistory(List<Map<String, dynamic>> newHistory) async {
    setState(() => history = newHistory);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_historyKey, jsonEncode(newHistory));
    } catch (_) {}
  }

  void _addToHistoryUser(Map<String, dynamic> user) {
    final userId = user['id'];
    if (userId == null) return;
    final newItem = <String, dynamic>{
      'id': 'user_$userId',
      'type': 'user',
      'user': user,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    final filtered = history.where((item) => item['id'] != newItem['id']).toList();
    final updated = [newItem, ...filtered];
    if (updated.length > 15) updated.removeRange(15, updated.length);
    _saveHistory(updated);
  }

  void _addToHistoryKeyword(String query) {
    final clean = query.trim();
    if (clean.isEmpty) return;
    final newItem = <String, dynamic>{
      'id': 'kw_${clean.toLowerCase()}',
      'type': 'keyword',
      'query': clean,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    final filtered = history.where((item) => item['id'] != newItem['id']).toList();
    final updated = [newItem, ...filtered];
    if (updated.length > 15) updated.removeRange(15, updated.length);
    _saveHistory(updated);
  }

  void _removeHistoryItem(String id) {
    final updated = history.where((item) => item['id'] != id).toList();
    _saveHistory(updated);
  }

  void _clearAllHistory() {
    _saveHistory([]);
  }

  void _onSearchChanged(String query) {
    setState(() {}); // updates clear button
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      search(query);
    });
  }

  Future<void> search(String query) async {
    final clean = query.trim();
    if (clean.isEmpty) {
      setState(() {
        results = [];
        hasSearched = false;
        isSearching = false;
      });
      return;
    }

    setState(() {
      isSearching = true;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');

      if (token == null || token.isEmpty) return;

      final encoded = Uri.encodeQueryComponent(clean);
      final response = await http.get(
        Uri.parse('$apiBaseUrl/users/search?q=$encoded'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          setState(() {
            results = data is List ? data : [];
            isSearching = false;
            hasSearched = true;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            isSearching = false;
            hasSearched = true;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          isSearching = false;
          hasSearched = true;
        });
      }
    }
  }

  void _handleSelectUser(Map<String, dynamic> user) {
    _addToHistoryUser(user);
    final userId = user['id'];
    final name = (user['name'] ?? user['username'] ?? 'User').toString();
    if (userId != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => UserProfilePage(
            userId: userId is int ? userId : int.tryParse(userId.toString()) ?? 0,
            userName: name,
          ),
        ),
      );
    }
  }

  void _handleSelectHistoryItem(Map<String, dynamic> item) {
    if (item['type'] == 'user' && item['user'] is Map) {
      _handleSelectUser(Map<String, dynamic>.from(item['user'] as Map));
    } else if (item['query'] != null) {
      final q = item['query'].toString();
      searchController.text = q;
      searchController.selection = TextSelection.fromPosition(
        TextPosition(offset: q.length),
      );
      search(q);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final queryText = searchController.text.trim();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Search',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => PostSearchPage(initialQuery: searchController.text.trim())),
            ),
            icon: const Icon(Icons.tag_rounded, size: 18),
            label: const Text('Posts'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // ── Search Input Box (Modern styling with clear button) ──
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isDark ? const Color(0xFF2E2E2E) : const Color(0xFFE5E7EB),
                  width: 1,
                ),
              ),
              child: TextField(
                controller: searchController,
                autofocus: true,
                onChanged: _onSearchChanged,
                onSubmitted: (val) {
                  if (val.trim().isNotEmpty) {
                    _addToHistoryKeyword(val.trim());
                  }
                },
                decoration: InputDecoration(
                  hintText: 'Search by username or name...',
                  hintStyle: TextStyle(
                    fontSize: 14.5,
                    color: isDark ? Colors.grey[500] : Colors.grey[500],
                  ),
                  prefixIcon: Icon(
                    Icons.search_rounded,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    size: 22,
                  ),
                  suffixIcon: queryText.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close_rounded, size: 18),
                          color: Colors.grey,
                          onPressed: () {
                            searchController.clear();
                            search('');
                          },
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ),

          // ── Content Area: Results vs History ──
          Expanded(
            child: queryText.isNotEmpty
                ? _buildSearchResults(isDark, queryText)
                : _buildRecentHistory(isDark),
          ),
        ],
      ),
    );
  }

  // ── Live Search Results ──
  Widget _buildSearchResults(bool isDark, String queryText) {
    if (isSearching) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(
              'Searching accounts...',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }

    if (results.isEmpty && hasSearched) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF3F4F6),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.person_off_rounded,
                  size: 48,
                  color: isDark ? Colors.grey[600] : Colors.grey[400],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'No accounts found',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'We couldn\'t find anyone matching "$queryText".',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      itemCount: results.length,
      separatorBuilder: (_, _) => Divider(
        height: 1,
        indent: 74,
        color: isDark ? const Color(0xFF262626) : const Color(0xFFF1F1F1),
      ),
      itemBuilder: (context, index) {
        final user = results[index] as Map;
        final userMap = Map<String, dynamic>.from(user);
        final profileImageUrl = user['profileImageUrl']?.toString();
        final name = (user['name'] ?? '').toString();
        final username = (user['username'] ?? '').toString();
        final bio = (user['bio'] ?? '').toString();

        final initials = name.isNotEmpty
            ? name[0].toUpperCase()
            : username.isNotEmpty
                ? username[0].toUpperCase()
                : '?';

        return ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          onTap: () => _handleSelectUser(userMap),
          leading: CircleAvatar(
            radius: 24,
            backgroundColor: const Color(0xFF6366F1).withValues(alpha: 0.15),
            backgroundImage: profileImageUrl != null && profileImageUrl.isNotEmpty
                ? NetworkImage(profileImageUrl)
                : null,
            child: profileImageUrl == null || profileImageUrl.isEmpty
                ? Text(
                    initials,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Color(0xFF6366F1),
                    ),
                  )
                : null,
          ),
          title: Text(
            '@$username',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (name.isNotEmpty)
                Text(
                  name,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.grey[300] : Colors.grey[800],
                  ),
                ),
              if (bio.isNotEmpty)
                Text(
                  bio,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: isDark ? Colors.grey[500] : Colors.grey[600],
                    fontSize: 12,
                  ),
                ),
            ],
          ),
          trailing: const Icon(
            Icons.chevron_right_rounded,
            color: Colors.grey,
            size: 20,
          ),
        );
      },
    );
  }

  // ── Recent Searches (When search input is empty) ──
  Widget _buildRecentHistory(bool isDark) {
    if (history.isEmpty) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF3F4F6),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.history_rounded,
                  size: 46,
                  color: isDark ? Colors.grey[600] : Colors.grey[400],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'No recent searches',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Search for friends, creators, and community members to see them here!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header with Clear All
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 4, 14, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Recent Searches',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.2,
                ),
              ),
              TextButton(
                onPressed: _clearAllHistory,
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF6366F1),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  'Clear all',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
          ),
        ),

        // Recent items list
        Expanded(
          child: ListView.separated(
            itemCount: history.length,
            separatorBuilder: (_, _) => Divider(
              height: 1,
              indent: 68,
              color: isDark ? const Color(0xFF262626) : const Color(0xFFF1F1F1),
            ),
            itemBuilder: (context, index) {
              final item = history[index];
              final isUserType = item['type'] == 'user' && item['user'] is Map;

              if (isUserType) {
                final user = Map<String, dynamic>.from(item['user'] as Map);
                final profileImageUrl = user['profileImageUrl']?.toString();
                final username = (user['username'] ?? '').toString();
                final name = (user['name'] ?? '').toString();
                final initials = username.isNotEmpty
                    ? username[0].toUpperCase()
                    : name.isNotEmpty
                        ? name[0].toUpperCase()
                        : 'U';

                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  onTap: () => _handleSelectHistoryItem(item),
                  leading: CircleAvatar(
                    radius: 20,
                    backgroundColor: const Color(0xFF6366F1).withValues(alpha: 0.15),
                    backgroundImage: profileImageUrl != null && profileImageUrl.isNotEmpty
                        ? NetworkImage(profileImageUrl)
                        : null,
                    child: profileImageUrl == null || profileImageUrl.isEmpty
                        ? Text(
                            initials,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: Color(0xFF6366F1),
                            ),
                          )
                        : null,
                  ),
                  title: Text(
                    '@$username',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                  ),
                  subtitle: name.isNotEmpty
                      ? Text(
                          name,
                          style: TextStyle(
                            fontSize: 12.5,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        )
                      : null,
                  trailing: IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18),
                    color: Colors.grey,
                    tooltip: 'Remove',
                    onPressed: () => _removeHistoryItem(item['id']),
                  ),
                );
              } else {
                // Keyword history item
                final query = item['query']?.toString() ?? '';
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  onTap: () => _handleSelectHistoryItem(item),
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF262626) : const Color(0xFFF3F4F6),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.history_rounded,
                      size: 20,
                      color: Colors.grey,
                    ),
                  ),
                  title: Text(
                    query,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5),
                  ),
                  subtitle: Text(
                    'Search term',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18),
                    color: Colors.grey,
                    tooltip: 'Remove',
                    onPressed: () => _removeHistoryItem(item['id']),
                  ),
                );
              }
            },
          ),
        ),
      ],
    );
  }
}

// ======================================================
// CREATE POST PAGE
// ======================================================

class CreatePostPage extends StatefulWidget {
  const CreatePostPage({super.key});

  @override
  State<CreatePostPage> createState() => _CreatePostPageState();
}

class _CreatePostPageState extends State<CreatePostPage> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _contentController = TextEditingController();
  final TextEditingController _tagController = TextEditingController();
  final List<String> _taggedUsers = [];
  final ImagePicker _picker = ImagePicker();

  XFile? _selectedImage;
  Uint8List? _imageBytes;
  bool _isSubmitting = false;
  int _selectedBackgroundColor = 0xFFF3F4F6;
  double _selectedFontSize = 22;

  final List<int> _backgroundColors = const [
    0xFFF3F4F6, 0xFFFFF3E0, 0xFFFFE4E6, 0xFFE0F2FE,
    0xFFDCFCE7, 0xFFEDE9FE, 0xFFFFF7ED, 0xFF111827,
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    _tagController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        imageQuality: 85,
      );
      if (image != null) {
        final bytes = await image.readAsBytes();
        setState(() {
          _selectedImage = image;
          _imageBytes = bytes;
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to pick image: $e')),
      );
    }
  }

  void _removeImage() {
    setState(() {
      _selectedImage = null;
      _imageBytes = null;
    });
  }

  Future<void> _submitPost() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a post title'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');

      if (token == null || token.isEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Login token not found. Please log in again.'),
            backgroundColor: Colors.redAccent,
          ),
        );
        return;
      }

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$apiBaseUrl/posts'),
      );

      request.headers['Authorization'] = 'Bearer $token';
      request.fields['title'] = title;

      final content = _contentController.text.trim();
      final tagText = _taggedUsers.isEmpty ? '' : '\n\nTagged: ${_taggedUsers.map((u) => '@$u').join(' ')}';
      final finalContent = content + tagText;
      if (finalContent.isNotEmpty) {
        request.fields['content'] = finalContent;
      }

      request.fields['backgroundColor'] = '#${_selectedBackgroundColor.toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}';
      request.fields['fontSize'] = _selectedFontSize.round().toString();

      if (_selectedImage != null && _imageBytes != null) {
        request.files.add(
          http.MultipartFile.fromBytes(
            'image',
            _imageBytes!,
            filename: _selectedImage!.name,
          ),
        );
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200 || response.statusCode == 201) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Post published successfully! 🎉'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
      } else {
        String errorMsg = 'Failed to publish post (${response.statusCode})';
        try {
          final data = jsonDecode(response.body);
          if (data['message'] != null) {
            errorMsg = data['message'] is List
                ? (data['message'] as List).join(', ')
                : data['message'].toString();
          }
        } catch (_) {}
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Create Post',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton.icon(
              onPressed: _isSubmitting ? null : _submitPost,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_rounded, size: 18),
              label: const Text(
                'Post',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // IMAGE PICKER / PREVIEW CARD
            if (_imageBytes != null)
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.memory(
                      _imageBytes!,
                      width: double.infinity,
                      height: 230,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 10,
                    right: 10,
                    child: CircleAvatar(
                      radius: 18,
                      backgroundColor: Colors.black.withValues(alpha: 0.6),
                      child: IconButton(
                        padding: EdgeInsets.zero,
                        icon: const Icon(
                          Icons.close,
                          color: Colors.white,
                          size: 18,
                        ),
                        onPressed: _removeImage,
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 10,
                    right: 10,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black.withValues(alpha: 0.65),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                      ),
                      onPressed: () => _pickImage(ImageSource.gallery),
                      icon: const Icon(Icons.change_circle_outlined, size: 16),
                      label: const Text('Change', style: TextStyle(fontSize: 12)),
                    ),
                  ),
                ],
              )
            else
              Container(
                padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest
                      .withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: theme.colorScheme.outline.withValues(alpha: 0.3),
                    width: 1.5,
                  ),
                ),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: theme.colorScheme.primary
                          .withValues(alpha: 0.12),
                      child: Icon(
                        Icons.add_photo_alternate_rounded,
                        size: 30,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Add a photo to your post',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'JPG or PNG images are supported',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        OutlinedButton.icon(
                          onPressed: () => _pickImage(ImageSource.gallery),
                          icon: const Icon(Icons.photo_library_outlined, size: 18),
                          label: const Text('Gallery'),
                          style: OutlinedButton.styleFrom(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        OutlinedButton.icon(
                          onPressed: () => _pickImage(ImageSource.camera),
                          icon: const Icon(Icons.camera_alt_outlined, size: 18),
                          label: const Text('Camera'),
                          style: OutlinedButton.styleFrom(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 24),

            // POST TITLE
            TextField(
              controller: _titleController,
              decoration: InputDecoration(
                labelText: 'Post Title *',
                hintText: 'What is this post about?',
                prefixIcon: const Icon(Icons.title_rounded),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                filled: true,
                fillColor: theme.colorScheme.surface,
              ),
              textCapitalization: TextCapitalization.sentences,
            ),

            const SizedBox(height: 16),

            // POST CONTENT / CAPTION
            TextField(
              controller: _contentController,
              minLines: 3,
              maxLines: 6,
              decoration: InputDecoration(
                labelText: 'Caption (Optional)',
                hintText: 'Write more details or your thoughts...',
                prefixIcon: const Padding(
                  padding: EdgeInsets.only(bottom: 50),
                  child: Icon(Icons.notes_rounded),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                filled: true,
                fillColor: theme.colorScheme.surface,
              ),
              textCapitalization: TextCapitalization.sentences,
            ),

            Container(
              margin: const EdgeInsets.only(top: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(14),border: Border.all(color: theme.colorScheme.outline.withValues(alpha: .25))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start,children:[
                Row(children:[const Icon(Icons.person_add_alt_1_outlined,size:20),const SizedBox(width:8),const Text('Tag people',style:TextStyle(fontWeight:FontWeight.w700))]),
                const SizedBox(height:8),
                TextField(controller:_tagController,decoration:const InputDecoration(hintText:'username (e.g. @choppa)',prefixIcon:Icon(Icons.alternate_email),isDense:true),onSubmitted:(v){final x=v.trim().replaceAll('@','');if(x.isNotEmpty&&!_taggedUsers.contains(x))setState((){_taggedUsers.add(x);_tagController.clear();});}),
                if(_taggedUsers.isNotEmpty)...[const SizedBox(height:10),Wrap(spacing:6,runSpacing:6,children:_taggedUsers.map((u)=>InputChip(label:Text('@$u'),onDeleted:()=>setState(()=>_taggedUsers.remove(u)))).toList()),const SizedBox(height:4),const Text('Tagged usernames are added to the post caption.',style:TextStyle(fontSize:11,color:Colors.grey))],
              ]),
            ),

            // TEXT POST STYLING
            if (_selectedImage == null) ...[
              Text('Text Post Style', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: theme.colorScheme.onSurface)),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(color: Color(_selectedBackgroundColor), borderRadius: BorderRadius.circular(18)),
                child: Text(
                  _titleController.text.trim().isEmpty ? 'Your text post preview' : _titleController.text.trim(),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: _selectedFontSize, fontWeight: FontWeight.w700, color: _selectedBackgroundColor == 0xFF111827 ? Colors.white : Colors.black87, height: 1.25),
                ),
              ),
              const SizedBox(height: 14),
              const Text('Background', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: _backgroundColors.map((colorValue) {
                  final selected = _selectedBackgroundColor == colorValue;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedBackgroundColor = colorValue),
                    child: Container(
                      width: 38, height: 38,
                      decoration: BoxDecoration(color: Color(colorValue), shape: BoxShape.circle, border: Border.all(color: selected ? theme.colorScheme.primary : Colors.grey.shade300, width: selected ? 3 : 1)),
                      child: selected ? Icon(Icons.check, size: 18, color: colorValue == 0xFF111827 ? Colors.white : Colors.black87) : null,
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),
              Row(children: [const Text('Font size', style: TextStyle(fontWeight: FontWeight.w600)), const Spacer(), Text('${_selectedFontSize.round()} px', style: const TextStyle(fontWeight: FontWeight.bold))]),
              Slider(min: 16, max: 40, divisions: 12, value: _selectedFontSize, label: '${_selectedFontSize.round()} px', onChanged: (value) => setState(() => _selectedFontSize = value)),
              const SizedBox(height: 14),
            ],

            // PUBLISH BUTTON
            SizedBox(
              height: 50,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _submitPost,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.publish_rounded, size: 20),
                label: Text(
                  _isSubmitting ? 'Publishing...' : 'Publish Post',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.colorScheme.primary,
                  foregroundColor: Colors.white,
                  elevation: 2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}