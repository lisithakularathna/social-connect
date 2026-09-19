import 'dart:convert';

import 'messages_page.dart';
import 'dart:typed_data';
import 'package:image_picker/image_picker.dart';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:google_sign_in/google_sign_in.dart';

// Google Sign-In instance
// Google OAuth client created in Google Cloud Console.
// For this Android build, the OAuth client is:
// 991770544980-h1jr6bpuq3t064mjk80u6kkd3af14nee.apps.googleusercontent.com
final GoogleSignIn _googleSignIn = GoogleSignIn(
  serverClientId:
      '991770544980-h1jr6bpuq3t064mjk80u6kkd3af14nee.apps.googleusercontent.com',
  scopes: ['email', 'profile'],
);

// ======================================================
// GOOGLE SIGN-IN HELPER
// ======================================================

Future<String?> getGoogleIdToken() async {
  try {
    // Sign out first so the user gets the Google account picker.
    await _googleSignIn.signOut();

    final account = await _googleSignIn.signIn();
    if (account == null) return null;

    final auth = await account.authentication;
    final idToken = auth.idToken;

    if (idToken == null || idToken.isEmpty) {
      throw Exception(
        'Google did not return an ID token. Check the OAuth client configuration.',
      );
    }

    return idToken;
  } catch (e) {
    throw Exception('Google sign-in failed: $e');
  }
}

Future<void> handleGoogleSignIn(BuildContext context) async {
  // Capture context-dependent objects before async gaps
  final messenger = ScaffoldMessenger.of(context);
  final navigator = Navigator.of(context);

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
    final response = await http.post(
      Uri.parse('$apiBaseUrl/auth/google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'idToken': idToken}),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      final accessToken = data['accessToken'];
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('accessToken', accessToken);

      navigator.pushAndRemoveUntil(
        MaterialPageRoute(builder: (context) => const HomePage()),
        (route) => false,
      );
    } else {
      String errorMessage = 'Google sign-in failed';
      try {
        final err = jsonDecode(response.body);
        if (err['message'] != null) {
          errorMessage = err['message'].toString();
        }
      } catch (_) {}
      messenger.showSnackBar(
        SnackBar(
          content: Text(errorMessage),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  } catch (e) {
    messenger.showSnackBar(
      SnackBar(
        content: Text('Connection error: $e'),
        backgroundColor: Colors.redAccent,
      ),
    );
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
          home: const LoginPage(),
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
// SAVED POSTS (LOCAL)
// ======================================================

const String _savedPostsKey = 'savedPosts';

Future<List<Map<String, dynamic>>> loadSavedPosts() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getStringList(_savedPostsKey) ?? [];
  final result = <Map<String, dynamic>>[];
  for (final item in raw) {
    try {
      final decoded = jsonDecode(item);
      if (decoded is Map) {
        result.add(Map<String, dynamic>.from(decoded));
      }
    } catch (_) {}
  }
  return result;
}

Future<bool> isPostSaved(dynamic postId) async {
  final posts = await loadSavedPosts();
  return posts.any((p) => p['id'].toString() == postId.toString());
}

Future<bool> toggleSavedPost(Map<String, dynamic> post) async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getStringList(_savedPostsKey) ?? [];
  final postId = post['id']?.toString();
  if (postId == null) return false;

  final index = raw.indexWhere((item) {
    try {
      final decoded = jsonDecode(item);
      return decoded is Map && decoded['id']?.toString() == postId;
    } catch (_) {
      return false;
    }
  });

  final bool saved;
  if (index >= 0) {
    raw.removeAt(index);
    saved = false;
  } else {
    raw.add(jsonEncode(post));
    saved = true;
  }
  await prefs.setStringList(_savedPostsKey, raw);
  return saved;
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

        final accessToken = data['accessToken'];

        final prefs = await SharedPreferences.getInstance();

        await prefs.setString(
          'accessToken',
          accessToken,
        );

        if (!mounted) return;

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => const HomePage(),
          ),
        );
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
      body: SafeArea(
        child: Center(
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
                  SizedBox(
                    height: 52,
                    child: OutlinedButton(
                      onPressed: isLoading ? null : () => handleGoogleSignIn(context),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        foregroundColor: isDark ? Colors.white : Colors.black,
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

                  // ── Register link ──
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
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
  String? errorMessage;
  int unreadNotificationCount = 0;

  @override
  void initState() {
    super.initState();
    loadPosts();
    loadUnreadNotifications();
  }

  // ====================================================
  // LOAD UNREAD NOTIFICATIONS
  // ====================================================

  Future<void> loadUnreadNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');
      if (token == null) return;

      final response = await http.get(
        Uri.parse('$apiBaseUrl/notifications/unread-count'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          setState(() {
            unreadNotificationCount = data['count'] ?? 0;
          });
        }
      }
    } catch (_) {}
  }

  // ====================================================
  // LOAD POSTS
  // ====================================================

  Future<void> loadPosts() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    loadUnreadNotifications();

    try {
      final prefs =
          await SharedPreferences.getInstance();

      final token = prefs.getString('accessToken');

      if (token == null || token.isEmpty) {
        setState(() {
          errorMessage = 'Login token not found';
          isLoading = false;
        });
        return;
      }

      final response = await http.get(
        Uri.parse('$apiBaseUrl/posts'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        if (data is List) {
          posts = data;
        } else if (data is Map && data['posts'] is List) {
          // Backend now returns { posts, pagination } for /posts.
          posts = data['posts'];
        } else if (data is Map &&
            data['value'] is List) {
          posts = data['value'];
        } else {
          posts = [];
        }

        setState(() {
          isLoading = false;
        });
      } else {
        setState(() {
          errorMessage =
              'Failed to load posts: ${response.statusCode}';
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

  // ====================================================
  // LOGOUT
  // ====================================================

  Future<void> logout() async {
    final prefs =
        await SharedPreferences.getInstance();

    await prefs.remove('accessToken');

    if (!mounted) return;

    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(
        builder: (context) => const LoginPage(),
      ),
      (route) => false,
    );
  }

  // ====================================================
  // BUILD
  // ====================================================

  int _currentNavIndex = 0;

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
                  tooltip: 'Theme',
                  onPressed: () {
                    themeNotifier.value = themeNotifier.value == ThemeMode.light
                        ? ThemeMode.dark
                        : ThemeMode.light;
                  },
                  icon: Icon(
                    themeNotifier.value == ThemeMode.light
                        ? Icons.dark_mode_outlined
                        : Icons.light_mode_outlined,
                    color: isDark ? Colors.white : Colors.black,
                  ),
                ),
                IconButton(
                  onPressed: logout,
                  icon: Icon(Icons.logout, color: isDark ? Colors.white : Colors.black),
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
          const NotificationsPage(),
          // ── 4: Messages ──
          const MessagesPage(),
          // ── 5: Profile ──
          const ProfilePage(),
        ],
      ),

      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: borderColor, width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentNavIndex == 2 ? 0 : _currentNavIndex,
          onTap: (index) async {
            if (index == 2) {
              await _openCreateMenu();
              return;
            }

            if (index == 4) {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const MessagesPage(),
                ),
              );
              return;
            }

            setState(() => _currentNavIndex = index);
            if (index == 3) loadUnreadNotifications();
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
              icon: unreadNotificationCount > 0
                  ? Badge.count(
                      count: unreadNotificationCount,
                      child: const Icon(Icons.favorite_outline),
                    )
                  : const Icon(Icons.favorite_outline),
              activeIcon: const Icon(Icons.favorite),
              label: 'Notifications',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.chat_bubble_outline_rounded),
              activeIcon: Icon(Icons.chat_bubble_rounded),
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
        ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Post'), subtitle: const Text('Photo, text, caption and tags'), onTap: () => Navigator.pop(sheetContext, 'post')),
        ListTile(leading: const Icon(Icons.repeat_rounded), title: const Text('Repost'), subtitle: const Text('Repost a post from your feed'), onTap: () => Navigator.pop(sheetContext, 'repost')),
        ListTile(leading: const Icon(Icons.person_add_alt_1_outlined), title: const Text('Tag people'), subtitle: const Text('Tag users while creating a post'), onTap: () => Navigator.pop(sheetContext, 'post')),
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

  Widget buildFeed() {
    if (isLoading) return const Center(child: CircularProgressIndicator());
    if (errorMessage != null) return ListView(children: [
      SizedBox(height: MediaQuery.of(context).size.height * .3),
      Center(child: Column(children: [
        const Icon(Icons.wifi_off_rounded, size: 60, color: Colors.grey),
        const SizedBox(height: 12), Text(errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
        const SizedBox(height: 16), ElevatedButton(onPressed: loadPosts, child: const Text('Retry')),
      ])),
    ]);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        StoryStrip(posts: posts, onCreateStory: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateStoryPage()));
          if (mounted) setState(() {});
        }),
        if (posts.isEmpty)
          const Padding(padding: EdgeInsets.symmetric(vertical: 120), child: Column(children: [
            Icon(Icons.photo_camera_outlined, size: 70, color: Colors.grey),
            SizedBox(height: 12), Text('No posts yet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            SizedBox(height: 4), Text('Follow people to see their posts', style: TextStyle(color: Colors.grey)),
          ]))
        else ...posts.map((post) => PostCard(post: post)),
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
      if (value.length == 6) return Color(int.parse('FF' + value, radix: 16));
      if (value.length == 8) return Color(int.parse(value, radix: 16));
    } catch (_) {}
  }
  return isDark ? const Color(0xFF1C1C1C) : const Color(0xFFF8F8F8);
}

Color _postTextColor(dynamic hex, bool isDark) => _postColor(hex, isDark).computeLuminance() < 0.35 ? Colors.white : Colors.black87;

class PostCard extends StatefulWidget {
  final dynamic post;

  const PostCard({
    super.key,
    required this.post,
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
  late AnimationController _heartController;
  late Animation<double> _heartAnim;

  @override
  void initState() {
    super.initState();
    // Use data from backend response if available
    likeCount = widget.post['likesCount'] ?? 0;
    isLiked = widget.post['isLiked'] ?? false;
    _loadSavedState();

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
      }
    } catch (_) {}
    finally {
      if (mounted) setState(() => isLoadingLike = false);
    }
  }

  Future<void> _loadSavedState() async {
    final saved = await isPostSaved(widget.post['id']);
    if (mounted) setState(() => isSaved = saved);
  }

  Future<void> toggleSave() async {
    if (isLoadingSave) return;
    setState(() => isLoadingSave = true);
    try {
      final saved = await toggleSavedPost(Map<String, dynamic>.from(widget.post as Map));
      if (!mounted) return;
      setState(() => isSaved = saved);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(saved ? 'Post saved' : 'Post removed from saved')),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update saved post')),
        );
      }
    } finally {
      if (mounted) setState(() => isLoadingSave = false);
    }
  }

  void openPostChat() {
    final author = widget.post['author'];
    final authorId = int.tryParse(author?['id']?.toString() ?? '');
    if (authorId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Post owner could not be found')),
      );
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ChatPage(
          userId: authorId,
          username: (author?['username'] ?? author?['name'] ?? 'User').toString(),
          profileImageUrl: author?['profileImageUrl']?.toString(),
          sharedPost: Map<String, dynamic>.from(widget.post as Map),
        ),
      ),
    );
  }


  Future<void> repostPost() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');
      if (token == null || token.isEmpty) return;
      final response = await http.post(
        Uri.parse(apiBaseUrl + '/posts/repost/' + widget.post['id'].toString()),
        headers: {'Authorization': 'Bearer ' + token},
      );
      if (!mounted) return;
      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Post reposted to your feed')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Repost failed (' + response.statusCode.toString() + ')')));
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final author = widget.post['author'];
    final username = author?['username'] ?? author?['name'] ?? 'Unknown';
    final name = author?['name'] ?? username;
    final title = widget.post['title'] ?? '';
    final content = widget.post['content'] ?? '';
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
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(
                        builder: (context) => PostDetailPage(post: widget.post),
                      ));
                    },
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
            // No image - show title as tap-target
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
                  content.toString().trim().isNotEmpty ? content.toString() : title.toString(),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: (widget.post['fontSize'] is num) ? (widget.post['fontSize'] as num).toDouble() : 22, fontWeight: FontWeight.w700, color: _postTextColor(widget.post['backgroundColor'], isDark), height: 1.3),
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
                      builder: (context) => CommentsPage(postId: widget.post['id']),
                    ));
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: Icon(Icons.chat_bubble_outline_rounded,
                        size: 24, color: isDark ? Colors.white : Colors.black),
                  ),
                ),
                const SizedBox(width: 4),

                // Message / Share
                GestureDetector(
                  onTap: repostPost,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    child: Icon(Icons.repeat_rounded, size: 25, color: isDark ? Colors.white : Colors.black),
                  ),
                ),
                const SizedBox(width: 4),

                GestureDetector(
                  onTap: openPostChat,
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

          // ── Likes count ──
          if (likeCount > 0)
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
          if (title.toString().isNotEmpty || content.toString().isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 2),
              child: RichText(
                text: TextSpan(
                  style: TextStyle(
                    fontSize: 13.5,
                    color: isDark ? Colors.white : Colors.black,
                    height: 1.4,
                  ),
                  children: [
                    TextSpan(
                      text: '${username.toString()} ',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    TextSpan(
                      text: title.toString().isNotEmpty ? title.toString() : content.toString(),
                    ),
                  ],
                ),
              ),
            ),

          // ── View comments ──
          if (commentsCount > 0)
            GestureDetector(
              onTap: () {
                Navigator.push(context, MaterialPageRoute(
                  builder: (context) => CommentsPage(postId: widget.post['id']),
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

  const CommentsPage({
    super.key,
    required this.postId,
  });

  @override
  State<CommentsPage> createState() => _CommentsPageState();
}

class _CommentsPageState extends State<CommentsPage> {
  List<dynamic> comments = [];
  bool isLoading = true;
  String? errorMessage;
  int? currentUserId;

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

        setState(() {
          comments = data['comments'] ?? [];
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
            child: Text(
              content.toString(),
              style: const TextStyle(fontSize: 14),
            ),
          ),
          trailing: isMyComment
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
                  SizedBox(
                    height: 50,
                    child: OutlinedButton(
                      onPressed: isLoading ? null : () => handleGoogleSignIn(context),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        foregroundColor: isDark ? Colors.white : Colors.black,
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


// ======================================================
// ======================================================
// PRIVACY & BLOCKED USERS (LOCAL SETTINGS)
// ======================================================

const String _privateAccountKey = 'privateAccount';
const String _messagePrivacyKey = 'messagePrivacy';
const String _blockedUsersKey = 'blockedUsers';

Future<bool> loadPrivateAccountPreference() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool(_privateAccountKey) ?? false;
}

Future<void> setPrivateAccountPreference(bool value) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(_privateAccountKey, value);
}

Future<String> loadMessagePrivacyPreference() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(_messagePrivacyKey) ?? 'Everyone';
}

Future<void> setMessagePrivacyPreference(String value) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_messagePrivacyKey, value);
}

Future<List<Map<String, dynamic>>> loadBlockedUsers() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getStringList(_blockedUsersKey) ?? [];
  final result = <Map<String, dynamic>>[];
  for (final item in raw) {
    try {
      final decoded = jsonDecode(item);
      if (decoded is Map) result.add(Map<String, dynamic>.from(decoded));
    } catch (_) {}
  }
  return result;
}

Future<void> saveBlockedUsers(List<Map<String, dynamic>> users) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setStringList(_blockedUsersKey, users.map((u) => jsonEncode(u)).toList());
}

class PrivacySettingsPage extends StatefulWidget {
  const PrivacySettingsPage({super.key});
  @override
  State<PrivacySettingsPage> createState() => _PrivacySettingsPageState();
}

class _PrivacySettingsPageState extends State<PrivacySettingsPage> {
  bool privateAccount = false;
  String messagePrivacy = 'Everyone';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final privateValue = await loadPrivateAccountPreference();
    final messageValue = await loadMessagePrivacyPreference();
    if (!mounted) return;
    setState(() {
      privateAccount = privateValue;
      messagePrivacy = messageValue;
    });
  }

  Future<void> _chooseMessagePrivacy() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              title: Text('Message Privacy', style: TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text('Choose who can send you messages'),
            ),
            for (final option in ['Everyone', 'Followers', 'No one'])
              RadioListTile<String>(
                value: option,
                groupValue: messagePrivacy,
                title: Text(option),
                onChanged: (value) => Navigator.pop(ctx, value),
              ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (selected == null) return;
    await setMessagePrivacyPreference(selected);
    if (mounted) setState(() => messagePrivacy = selected);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy'), centerTitle: true),
      body: ListView(
        children: [
          SwitchListTile(
            secondary: const Icon(Icons.lock_outline),
            title: const Text('Private Account', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(privateAccount ? 'Only approved followers can see your content' : 'Anyone can see your profile and posts'),
            value: privateAccount,
            onChanged: (value) async {
              setState(() => privateAccount = value);
              await setPrivateAccountPreference(value);
            },
          ),
          ListTile(
            leading: const Icon(Icons.chat_bubble_outline),
            title: const Text('Message Privacy', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(messagePrivacy),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: _chooseMessagePrivacy,
          ),
          ListTile(
            leading: const Icon(Icons.block_outlined),
            title: const Text('Blocked Users', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: const Text('Manage accounts you have blocked'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BlockedUsersPage())),
          ),
        ],
      ),
    );
  }
}

class BlockedUsersPage extends StatefulWidget {
  const BlockedUsersPage({super.key});
  @override
  State<BlockedUsersPage> createState() => _BlockedUsersPageState();
}

class _BlockedUsersPageState extends State<BlockedUsersPage> {
  final searchController = TextEditingController();
  List<Map<String, dynamic>> blockedUsers = [];
  List<dynamic> searchResults = [];
  bool searching = false;

  @override
  void initState() {
    super.initState();
    _loadBlocked();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> _loadBlocked() async {
    final users = await loadBlockedUsers();
    if (mounted) setState(() => blockedUsers = users);
  }

  Future<void> _searchUsers(String value) async {
    final query = value.trim();
    if (query.isEmpty) {
      if (mounted) setState(() => searchResults = []);
      return;
    }
    setState(() => searching = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');
      if (token == null || token.isEmpty) return;
      final encoded = Uri.encodeQueryComponent(query);
      final response = await http.get(
        Uri.parse('$apiBaseUrl/users/search?q=$encoded'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) setState(() => searchResults = data is List ? data : []);
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => searching = false);
    }
  }

  Future<void> _blockUser(dynamic user) async {
    final id = user['id'];
    if (id == null || blockedUsers.any((u) => u['id'].toString() == id.toString())) return;
    final item = <String, dynamic>{
      'id': id,
      'username': user['username'] ?? 'user',
      'name': user['name'] ?? '',
      'profileImageUrl': user['profileImageUrl'],
    };
    final updated = [...blockedUsers, item];
    await saveBlockedUsers(updated);
    if (!mounted) return;
    setState(() {
      blockedUsers = updated;
      searchResults = [];
      searchController.clear();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('@' + item['username'].toString() + ' blocked')),
    );
  }

  Future<void> _unblockUser(Map<String, dynamic> user) async {
    final updated = blockedUsers.where((u) => u['id'].toString() != user['id'].toString()).toList();
    await saveBlockedUsers(updated);
    if (mounted) {
      setState(() => blockedUsers = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('@' + user['username'].toString() + ' unblocked')),
      );
    }
  }

  Widget _avatar(dynamic imageUrl) {
    if (imageUrl != null && imageUrl.toString().isNotEmpty) {
      return CircleAvatar(radius: 24, backgroundImage: NetworkImage(imageUrl.toString()));
    }
    return const CircleAvatar(radius: 24, child: Icon(Icons.person_outline));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Blocked Users'), centerTitle: true),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          TextField(
            controller: searchController,
            onChanged: _searchUsers,
            decoration: InputDecoration(
              hintText: 'Search username to block',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: searching ? const Padding(
                padding: EdgeInsets.all(12),
                child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              ) : null,
            ),
          ),
          if (searchResults.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('Search results', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.grey)),
            ...searchResults.map((user) => ListTile(
              leading: _avatar(user['profileImageUrl']),
              title: Text(user['username']?.toString() ?? 'user'),
              subtitle: Text(user['name']?.toString() ?? ''),
              trailing: const Icon(Icons.block_outlined),
              onTap: () => _blockUser(user),
            )),
          ],
          const SizedBox(height: 20),
          const Text('Blocked accounts', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.grey)),
          if (blockedUsers.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 32), child: Center(child: Text('No blocked users')))
          else
            ...blockedUsers.map((user) => ListTile(
              leading: _avatar(user['profileImageUrl']),
              title: Text(user['username']?.toString() ?? 'user'),
              subtitle: Text(user['name']?.toString() ?? ''),
              trailing: TextButton(onPressed: () => _unblockUser(user), child: const Text('Unblock')),
            )),
        ],
      ),
    );
  }
}

// SETTINGS
// ======================================================

class SettingsPage extends StatefulWidget{const SettingsPage({super.key});@override State<SettingsPage> createState()=>_SettingsPageState();}
class _SettingsPageState extends State<SettingsPage>{
 bool likes=true,comments=true,followers=true,messages=true,mentions=true;
 @override void initState(){super.initState();_load();}
 Future<void> _load()async{final p=await SharedPreferences.getInstance();if(!mounted)return;setState((){likes=p.getBool('notif_likes')??true;comments=p.getBool('notif_comments')??true;followers=p.getBool('notif_followers')??true;messages=p.getBool('notif_messages')??true;mentions=p.getBool('notif_mentions')??true;});}
 void _theme(){showModalBottomSheet(context:context,showDragHandle:true,builder:(s)=>ValueListenableBuilder<ThemeMode>(valueListenable:themeNotifier,builder:(c,m,_)=>SafeArea(child:Column(mainAxisSize:MainAxisSize.min,children:[const ListTile(title:Text('Appearance',style:TextStyle(fontWeight:FontWeight.w800)),subtitle:Text('Choose Light, Dark or System')),RadioListTile(value:ThemeMode.light,groupValue:m,title:const Text('Light'),secondary:const Icon(Icons.light_mode_outlined),onChanged:(v)async{await setThemePreference(v!);if(s.mounted)Navigator.pop(s);}),RadioListTile(value:ThemeMode.dark,groupValue:m,title:const Text('Dark'),secondary:const Icon(Icons.dark_mode_outlined),onChanged:(v)async{await setThemePreference(v!);if(s.mounted)Navigator.pop(s);}),RadioListTile(value:ThemeMode.system,groupValue:m,title:const Text('System'),secondary:const Icon(Icons.brightness_auto_outlined),onChanged:(v)async{await setThemePreference(v!);if(s.mounted)Navigator.pop(s);})]))));}
 Widget tile(IconData i,String t,String st,VoidCallback f)=>ListTile(contentPadding:const EdgeInsets.symmetric(horizontal:4),leading:Icon(i),title:Text(t,style:const TextStyle(fontWeight:FontWeight.w600)),subtitle:Text(st),trailing:const Icon(Icons.chevron_right_rounded),onTap:f);
 void _notifications()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>NotificationSettingsPage(likes:likes,comments:comments,followers:followers,messages:messages,mentions:mentions))).then((_)=>_load());
 @override Widget build(BuildContext context){final m=themeNotifier.value;final n=m==ThemeMode.dark?'Dark':m==ThemeMode.system?'System':'Light';return Scaffold(appBar:AppBar(title:const Text('Settings'),centerTitle:true),body:ListView(padding:const EdgeInsets.fromLTRB(16,8,16,24),children:[const Text('Preferences',style:TextStyle(fontSize:13,fontWeight:FontWeight.w800,color:Colors.grey)),const SizedBox(height:6),tile(Icons.brightness_6_outlined,'Theme',n,_theme),tile(Icons.notifications_none_rounded,'Notification Settings','Likes, comments, followers, messages and mentions',_notifications),tile(Icons.lock_outline,'Privacy','Private account, message privacy and blocked users',()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const PrivacySettingsPage()))),const SizedBox(height:18),const Text('Account & Security',style:TextStyle(fontSize:13,fontWeight:FontWeight.w800,color:Colors.grey)),const SizedBox(height:6),tile(Icons.volume_off_outlined,'Muted Users','Manage accounts you have muted',()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const MutedUsersPage()))),tile(Icons.lock_reset_outlined,'Change Password','Update your account password',()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const ChangePasswordPage()))),tile(Icons.security_outlined,'Two-Factor Authentication','Extra security for your account',()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const TwoFactorPage()))),tile(Icons.circle_outlined,'Activity Status','Show or hide your active status',()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const ActivityStatusPage()))),tile(Icons.delete_outline,'Delete Account','Permanently delete your account',()=>deleteAccount(context)),tile(Icons.logout_rounded,'Logout','Sign out of this device',()=>logoutUser(context))]));}
}
class NotificationSettingsPage extends StatefulWidget{final bool likes,comments,followers,messages,mentions;const NotificationSettingsPage({super.key,required this.likes,required this.comments,required this.followers,required this.messages,required this.mentions});@override State<NotificationSettingsPage> createState()=>_NotificationSettingsPageState();}
class _NotificationSettingsPageState extends State<NotificationSettingsPage>{late bool likes,comments,followers,messages,mentions;@override void initState(){super.initState();likes=widget.likes;comments=widget.comments;followers=widget.followers;messages=widget.messages;mentions=widget.mentions;}Future<void> ch(String k,bool v)async{final p=await SharedPreferences.getInstance();await p.setBool(k,v);}@override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Notifications'),centerTitle:true),body:ListView(padding:const EdgeInsets.fromLTRB(16,8,16,24),children:[const Text('Push notifications',style:TextStyle(fontSize:13,fontWeight:FontWeight.w800,color:Colors.grey)),SwitchListTile(title:const Text('Likes'),subtitle:const Text('When someone likes your post'),value:likes,onChanged:(v){setState(()=>likes=v);ch('notif_likes',v);}),SwitchListTile(title:const Text('Comments'),subtitle:const Text('When someone comments on your post'),value:comments,onChanged:(v){setState(()=>comments=v);ch('notif_comments',v);}),SwitchListTile(title:const Text('New followers'),subtitle:const Text('When someone follows you'),value:followers,onChanged:(v){setState(()=>followers=v);ch('notif_followers',v);}),SwitchListTile(title:const Text('Messages'),subtitle:const Text('New direct messages'),value:messages,onChanged:(v){setState(()=>messages=v);ch('notif_messages',v);}),SwitchListTile(title:const Text('Mentions'),subtitle:const Text('When someone mentions you'),value:mentions,onChanged:(v){setState(()=>mentions=v);ch('notif_mentions',v);})]));}
void _openThemeSettingsFromProfile(BuildContext context) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => ValueListenableBuilder<ThemeMode>(
      valueListenable: themeNotifier,
      builder: (context, mode, _) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              title: Text('Theme', style: TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text('Choose Light, Dark or System'),
            ),
            RadioListTile<ThemeMode>(
              value: ThemeMode.light,
              groupValue: mode,
              title: const Text('Light'),
              onChanged: (v) async { await setThemePreference(v!); if (sheetContext.mounted) Navigator.pop(sheetContext); },
            ),
            RadioListTile<ThemeMode>(
              value: ThemeMode.dark,
              groupValue: mode,
              title: const Text('Dark'),
              onChanged: (v) async { await setThemePreference(v!); if (sheetContext.mounted) Navigator.pop(sheetContext); },
            ),
            RadioListTile<ThemeMode>(
              value: ThemeMode.system,
              groupValue: mode,
              title: const Text('System'),
              onChanged: (v) async { await setThemePreference(v!); if (sheetContext.mounted) Navigator.pop(sheetContext); },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    ),
  );
}


// ======================================================
// MORE ACCOUNT SETTINGS
// ======================================================
const String _mutedUsersKey='mutedUsers';
const String _twoFactorKey='twoFactorEnabled';
const String _activityStatusKey='activityStatus';

Future<List<Map<String,dynamic>>> loadMutedUsers()async{
  final p=await SharedPreferences.getInstance(); final raw=p.getStringList(_mutedUsersKey)??[];
  return raw.map((x){try{final d=jsonDecode(x);return d is Map?Map<String,dynamic>.from(d):<String,dynamic>{};}catch(_){return <String,dynamic>{};}}).where((x)=>x.isNotEmpty).toList();
}
Future<void> saveMutedUsers(List<Map<String,dynamic>> users)async{final p=await SharedPreferences.getInstance();await p.setStringList(_mutedUsersKey,users.map(jsonEncode).toList());}

class MutedUsersPage extends StatefulWidget{const MutedUsersPage({super.key});@override State<MutedUsersPage> createState()=>_MutedUsersPageState();}
class _MutedUsersPageState extends State<MutedUsersPage>{
 final controller=TextEditingController();List<Map<String,dynamic>> muted=[];List<dynamic> results=[];bool searching=false;
 @override void initState(){super.initState();_load();}@override void dispose(){controller.dispose();super.dispose();}
 Future<void> _load()async{final v=await loadMutedUsers();if(mounted)setState(()=>muted=v);}
 Future<void> _search(String value)async{final q=value.trim();if(q.isEmpty){if(mounted)setState(()=>results=[]);return;}setState(()=>searching=true);try{final p=await SharedPreferences.getInstance();final t=p.getString('accessToken');if(t==null||t.isEmpty)return;final res=await http.get(Uri.parse('$apiBaseUrl/users/search?q='+Uri.encodeQueryComponent(q)),headers:{'Authorization':'Bearer $t'});if(res.statusCode==200){final d=jsonDecode(res.body);if(mounted)setState(()=>results=d is List?d:[]);}}catch(_){}finally{if(mounted)setState(()=>searching=false);}}
 Future<void> _mute(dynamic u)async{final id=u['id'];if(id==null||muted.any((x)=>x['id'].toString()==id.toString()))return;final item=<String,dynamic>{'id':id,'username':u['username']??'user','name':u['name']??'','profileImageUrl':u['profileImageUrl']};final updated=[...muted,item];await saveMutedUsers(updated);if(!mounted)return;setState((){muted=updated;results=[];controller.clear();});ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('@'+item['username'].toString()+' muted')));}
 Future<void> _unmute(Map<String,dynamic> u)async{final updated=muted.where((x)=>x['id'].toString()!=u['id'].toString()).toList();await saveMutedUsers(updated);if(mounted)setState(()=>muted=updated);}
 Widget _avatar(dynamic url)=>url!=null&&url.toString().isNotEmpty?CircleAvatar(radius:24,backgroundImage:NetworkImage(url.toString())):const CircleAvatar(radius:24,child:Icon(Icons.person_outline));
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Muted Users'),centerTitle:true),body:ListView(padding:const EdgeInsets.fromLTRB(16,8,16,24),children:[
  TextField(controller:controller,onChanged:_search,decoration:InputDecoration(hintText:'Search username to mute',prefixIcon:const Icon(Icons.search),suffixIcon:searching?const Padding(padding:EdgeInsets.all(12),child:SizedBox(width:18,height:18,child:CircularProgressIndicator(strokeWidth:2))):null)),
  if(results.isNotEmpty)...[const SizedBox(height:16),const Text('Search results',style:TextStyle(fontWeight:FontWeight.w800,color:Colors.grey)),...results.map((u)=>ListTile(leading:_avatar(u['profileImageUrl']),title:Text(u['username']?.toString()??'user'),subtitle:Text(u['name']?.toString()??''),trailing:const Icon(Icons.volume_off_outlined),onTap:()=>_mute(u)))],
  const SizedBox(height:20),const Text('Muted accounts',style:TextStyle(fontWeight:FontWeight.w800,color:Colors.grey)),
  if(muted.isEmpty)const Padding(padding:EdgeInsets.symmetric(vertical:32),child:Center(child:Text('No muted users')))else...muted.map((u)=>ListTile(leading:_avatar(u['profileImageUrl']),title:Text(u['username']?.toString()??'user'),subtitle:Text(u['name']?.toString()??''),trailing:TextButton(onPressed:()=>_unmute(u),child:const Text('Unmute')))),
 ]));
}

class ChangePasswordPage extends StatefulWidget{const ChangePasswordPage({super.key});@override State<ChangePasswordPage> createState()=>_ChangePasswordPageState();}
class _ChangePasswordPageState extends State<ChangePasswordPage>{
 final current=TextEditingController(),next=TextEditingController(),confirm=TextEditingController();bool loading=false;
 @override void dispose(){current.dispose();next.dispose();confirm.dispose();super.dispose();}
 Future<void> _change()async{if(next.text.length<6){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('New password must be at least 6 characters')));return;}if(next.text!=confirm.text){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Passwords do not match')));return;}setState(()=>loading=true);try{final p=await SharedPreferences.getInstance();final t=p.getString('accessToken');final res=await http.post(Uri.parse('$apiBaseUrl/auth/change-password'),headers:{'Content-Type':'application/json','Authorization':'Bearer $t'},body:jsonEncode({'currentPassword':current.text,'newPassword':next.text}));if(!mounted)return;if(res.statusCode==200){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Password changed successfully')));Navigator.pop(context);}else{String m='Failed to change password';try{final d=jsonDecode(res.body);m=d['message']?.toString()??m;}catch(_){ }ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(m)));}}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Connection error: $e')));}finally{if(mounted)setState(()=>loading=false);}}
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Change Password'),centerTitle:true),body:ListView(padding:const EdgeInsets.all(20),children:[TextField(controller:current,obscureText:true,decoration:const InputDecoration(labelText:'Current password',prefixIcon:Icon(Icons.lock_outline))),const SizedBox(height:14),TextField(controller:next,obscureText:true,decoration:const InputDecoration(labelText:'New password',prefixIcon:Icon(Icons.lock_reset_outlined))),const SizedBox(height:14),TextField(controller:confirm,obscureText:true,decoration:const InputDecoration(labelText:'Confirm new password',prefixIcon:Icon(Icons.check_circle_outline))),const SizedBox(height:24),SizedBox(height:50,child:ElevatedButton(onPressed:loading?null:_change,child:loading?const CircularProgressIndicator():const Text('Change Password')))]));
}

class TwoFactorPage extends StatefulWidget{const TwoFactorPage({super.key});@override State<TwoFactorPage> createState()=>_TwoFactorPageState();}
class _TwoFactorPageState extends State<TwoFactorPage>{bool enabled=false;@override void initState(){super.initState();_load();}Future<void> _load()async{final p=await SharedPreferences.getInstance();if(mounted)setState(()=>enabled=p.getBool(_twoFactorKey)??false);}Future<void> _toggle(bool v)async{final p=await SharedPreferences.getInstance();await p.setBool(_twoFactorKey,v);if(mounted)setState(()=>enabled=v);}@override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Two-Factor Authentication'),centerTitle:true),body:ListView(children:[SwitchListTile(secondary:const Icon(Icons.security_outlined),title:const Text('Two-Factor Authentication',style:TextStyle(fontWeight:FontWeight.w600)),subtitle:Text(enabled?'Enabled on this device':'Disabled'),value:enabled,onChanged:_toggle),const Padding(padding:EdgeInsets.all(20),child:Text('2FA is currently a local setting. A production OTP/authenticator verification flow can be connected to the backend later.',style:TextStyle(color:Colors.grey)))]));}

class ActivityStatusPage extends StatefulWidget{const ActivityStatusPage({super.key});@override State<ActivityStatusPage> createState()=>_ActivityStatusPageState();}
class _ActivityStatusPageState extends State<ActivityStatusPage>{bool enabled=true;@override void initState(){super.initState();_load();}Future<void> _load()async{final p=await SharedPreferences.getInstance();if(mounted)setState(()=>enabled=p.getBool(_activityStatusKey)??true);}Future<void> _toggle(bool v)async{final p=await SharedPreferences.getInstance();await p.setBool(_activityStatusKey,v);if(mounted)setState(()=>enabled=v);}@override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Activity Status'),centerTitle:true),body:SwitchListTile(secondary:const Icon(Icons.circle_outlined),title:const Text('Show Activity Status',style:TextStyle(fontWeight:FontWeight.w600)),subtitle:const Text('Let others see when you are active'),value:enabled,onChanged:_toggle));}

Future<void> logoutUser(BuildContext context)async{final p=await SharedPreferences.getInstance();await p.remove('accessToken');if(!context.mounted)return;Navigator.pushAndRemoveUntil(context,MaterialPageRoute(builder:(_)=>const LoginPage()),(route)=>false);}
Future<void> deleteAccount(BuildContext context)async{final ok=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(title:const Text('Delete Account'),content:const Text('This permanently deletes your account, posts, likes, comments and follows. This action cannot be undone.'),actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),ElevatedButton(style:ElevatedButton.styleFrom(backgroundColor:Colors.red,foregroundColor:Colors.white),onPressed:()=>Navigator.pop(ctx,true),child:const Text('Delete'))]));if(ok!=true)return;try{final p=await SharedPreferences.getInstance();final t=p.getString('accessToken');final res=await http.delete(Uri.parse('$apiBaseUrl/users/me'),headers:{'Authorization':'Bearer $t'});if(!context.mounted)return;if(res.statusCode==200){await p.clear();if(!context.mounted)return;Navigator.pushAndRemoveUntil(context,MaterialPageRoute(builder:(_)=>const LoginPage()),(route)=>false);}else{ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Failed to delete account ('+res.statusCode.toString()+')')));}}catch(e){if(context.mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Connection error: $e')));}}
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  int? myUserId;
  String? username;
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

  Future<void> loadSavedPostsForProfile() async {
    try {
      final posts = await loadSavedPosts();
      if (!mounted) return;
      setState(() {
        savedPosts = posts;
        isSavedPostsLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => isSavedPostsLoading = false);
    }
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
            Icon(Icons.lock_outline, size: 16, color: isDark ? Colors.white : Colors.black),
            const SizedBox(width: 6),
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
                _openThemeSettingsFromProfile(context);
              } else if (val == 'logout') {
                final prefs = await SharedPreferences.getInstance();
                await prefs.remove('accessToken');
                if (!context.mounted) return;
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (context) => const LoginPage()),
                  (route) => false,
                );
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
                        : Container(
                            color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFEAEAEA),
                            child: Center(
                              child: Padding(
                                padding: const EdgeInsets.all(8),
                                child: Text(
                                  post['title'] ?? post['content'] ?? '',
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[400] : Colors.grey[700]),
                                ),
                              ),
                            ),
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
    final imageUrl = post['imageUrl'];
    final title = post['title'] ?? '';
    final content = post['content'] ?? '';
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
                decoration: BoxDecoration(color: _postColor(post['backgroundColor'], Theme.of(context).brightness == Brightness.dark)),
                child: Center(child: Text(
                  content.trim().isNotEmpty ? content : title,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: (post['fontSize'] is num) ? (post['fontSize'] as num).toDouble() : 22, fontWeight: FontWeight.w700, color: _postTextColor(post['backgroundColor'], Theme.of(context).brightness == Brightness.dark), height: 1.3),
                )),
              ),

            // CONTENT
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment:
                    CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
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

                  if (content.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Divider(),
                    const SizedBox(height: 16),
                    Text(
                      content,
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
  State<SearchPage> createState() =>
      _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final TextEditingController searchController =
      TextEditingController();

  List<dynamic> results = [];
  bool isSearching = false;
  bool hasSearched = false;

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> search(String query) async {
    if (query.trim().isEmpty) {
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
      final prefs =
          await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');

      if (token == null || token.isEmpty) return;

      final encoded = Uri.encodeQueryComponent(
        query.trim(),
      );

      final response = await http.get(
        Uri.parse(
          '$apiBaseUrl/users/search?q=$encoded',
        ),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          results = data is List ? data : [];
          isSearching = false;
          hasSearched = true;
        });
      } else {
        setState(() {
          isSearching = false;
          hasSearched = true;
        });
      }
    } catch (e) {
      setState(() {
        isSearching = false;
        hasSearched = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Search Users'),
        centerTitle: true,
      ),
      body: Column(
        children: [
          // SEARCH BAR
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: searchController,
              autofocus: true,
              decoration: InputDecoration(
                hintText:
                    'Search by name or username...',
                prefixIcon:
                    const Icon(Icons.search),
                suffixIcon:
                    searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(
                              Icons.clear,
                            ),
                            onPressed: () {
                              searchController
                                  .clear();
                              search('');
                            },
                          )
                        : null,
                border: OutlineInputBorder(
                  borderRadius:
                      BorderRadius.circular(12),
                ),
                filled: true,
              ),
              onChanged: (value) {
                setState(() {}); // update suffix icon
                Future.delayed(
                  const Duration(
                    milliseconds: 400,
                  ),
                  () {
                    if (searchController.text ==
                        value) {
                      search(value);
                    }
                  },
                );
              },
            ),
          ),

          // RESULTS
          Expanded(
            child: _buildResults(),
          ),
        ],
      ),
    );
  }

  Widget _buildResults() {
    if (isSearching) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (!hasSearched) {
      return Center(
        child: Column(
          mainAxisAlignment:
              MainAxisAlignment.center,
          children: [
            Icon(
              Icons.person_search,
              size: 80,
              color: Colors.grey[300],
            ),
            const SizedBox(height: 16),
            Text(
              'Search for people',
              style: TextStyle(
                fontSize: 18,
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    if (results.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment:
              MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_off,
              size: 80,
              color: Colors.grey[300],
            ),
            const SizedBox(height: 16),
            Text(
              'No users found',
              style: TextStyle(
                fontSize: 18,
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (context, index) {
        final user = results[index];
        final profileImageUrl =
            user['profileImageUrl'];
        final name = user['name'] ?? '';
        final username =
            user['username'] ?? '';
        final bio = user['bio'] ?? '';

        final initials = name.isNotEmpty
            ? name[0].toUpperCase()
            : username.isNotEmpty
                ? username[0].toUpperCase()
                : '?';

        return ListTile(
          contentPadding:
              const EdgeInsets.symmetric(
            horizontal: 20,
            vertical: 8,
          ),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) =>
                    UserProfilePage(
                  userId: user['id'],
                  userName: name.isNotEmpty
                      ? name
                      : username,
                ),
              ),
            );
          },
          leading: CircleAvatar(
            radius: 26,
            backgroundImage: profileImageUrl !=
                        null &&
                    profileImageUrl
                        .toString()
                        .isNotEmpty
                ? NetworkImage(profileImageUrl)
                : null,
            child: profileImageUrl == null ||
                    profileImageUrl
                        .toString()
                        .isEmpty
                ? Text(
                    initials,
                    style: const TextStyle(
                      fontWeight:
                          FontWeight.bold,
                    ),
                  )
                : null,
          ),
          title: Text(
            name.isNotEmpty ? name : username,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
            ),
          ),
          subtitle: Column(
            crossAxisAlignment:
                CrossAxisAlignment.start,
            children: [
              Text('@$username'),
              if (bio.isNotEmpty)
                Text(
                  bio,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 12,
                  ),
                ),
            ],
          ),
          isThreeLine: bio.isNotEmpty,
          trailing: const Icon(
            Icons.arrow_forward_ios,
            size: 14,
          ),
        );
      },
    );
  }
}

// ======================================================
// USER PROFILE PAGE  (Step 6 — Other Profiles)
// ======================================================

class UserProfilePage extends StatefulWidget {
  final int userId;
  final String userName;

  const UserProfilePage({
    super.key,
    required this.userId,
    required this.userName,
  });

  @override
  State<UserProfilePage> createState() =>
      _UserProfilePageState();
}

class _UserProfilePageState
    extends State<UserProfilePage> {
  Map<String, dynamic>? profile;
  List<dynamic> posts = [];
  bool isProfileLoading = true;
  bool isPostsLoading = true;
  bool isFollowing = false;
  bool isFollowActionLoading = false;
  int followersCount = 0;
  int followingCount = 0;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadPosts();
  }

  Future<String?> _getToken() async {
    final prefs =
        await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  Future<void> _loadProfile() async {
    try {
      final token = await _getToken();
      if (token == null) return;

      final response = await http.get(
        Uri.parse(
          '$apiBaseUrl/users/${widget.userId}',
        ),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          profile = data;
          isFollowing = data['isFollowing'] ?? false;
          followersCount = data['followersCount'] ?? 0;
          followingCount = data['followingCount'] ?? 0;
          isProfileLoading = false;
        });
      } else {
        setState(() {
          isProfileLoading = false;
          errorMessage =
              'Failed to load profile';
        });
      }
    } catch (e) {
      setState(() {
        isProfileLoading = false;
        errorMessage = 'Connection error: $e';
      });
    }
  }

  Future<void> toggleFollow() async {
    if (isFollowActionLoading) return;
    setState(() {
      isFollowActionLoading = true;
    });

    try {
      final token = await _getToken();
      if (token == null) return;

      final response = await http.post(
        Uri.parse(
          '$apiBaseUrl/users/${widget.userId}/follow',
        ),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        setState(() {
          isFollowing = data['isFollowing'] ?? !isFollowing;
          followersCount = data['followersCount'] ?? followersCount;
          followingCount = data['followingCount'] ?? followingCount;
        });

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isFollowing
                  ? 'Followed ${widget.userName}'
                  : 'Unfollowed ${widget.userName}',
            ),
            duration: const Duration(seconds: 2),
            backgroundColor: isFollowing ? Colors.indigo : Colors.grey[800],
          ),
        );
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Action failed: ${response.body}'),
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
          isFollowActionLoading = false;
        });
      }
    }
  }

  Future<void> _loadPosts() async {
    try {
      final token = await _getToken();
      if (token == null) return;

      final response = await http.get(
        Uri.parse(
          '$apiBaseUrl/posts/user/${widget.userId}',
        ),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          posts = data is List ? data : [];
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

  @override
  Widget build(BuildContext context) {
    final name =
        profile?['name'] ?? widget.userName;
    final username =
        profile?['username'] ?? '';
    final bio = profile?['bio'] ?? '';
    final imageUrl =
        profile?['profileImageUrl'];

    final initials = name.isNotEmpty
        ? name[0].toUpperCase()
        : '?';

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.userName),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _loadProfile();
          await _loadPosts();
        },
        child: isProfileLoading
            ? const Center(
                child: CircularProgressIndicator(),
              )
            : errorMessage != null
                ? Center(
                    child: Text(errorMessage!),
                  )
                : ListView(
                    padding: const EdgeInsets.all(
                      20,
                    ),
                    children: [
                      const SizedBox(height: 16),

                      // AVATAR
                      Center(
                        child: CircleAvatar(
                          radius: 55,
                          backgroundImage: imageUrl !=
                                      null &&
                                  imageUrl
                                      .toString()
                                      .isNotEmpty
                              ? NetworkImage(
                                  imageUrl,
                                )
                              : null,
                          child: imageUrl == null ||
                                  imageUrl
                                      .toString()
                                      .isEmpty
                              ? Text(
                                  initials,
                                  style:
                                      const TextStyle(
                                    fontSize: 36,
                                    fontWeight:
                                        FontWeight
                                            .bold,
                                  ),
                                )
                              : null,
                        ),
                      ),

                      const SizedBox(height: 16),

                      // NAME
                      Center(
                        child: Text(
                          name,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight:
                                FontWeight.bold,
                          ),
                        ),
                      ),

                      if (username.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Center(
                          child: Text(
                            '@$username',
                            style: TextStyle(
                              fontSize: 15,
                              color:
                                  Colors.grey[600],
                            ),
                          ),
                        ),
                      ],

                      if (bio.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Center(
                          child: Text(
                            bio,
                            textAlign:
                                TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              color:
                                  Colors.grey[700],
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 20),

                      // FOLLOW / UNFOLLOW BUTTON
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: SizedBox(
                          height: 46,
                          child: isFollowing
                              ? OutlinedButton.icon(
                                  onPressed: isFollowActionLoading
                                      ? null
                                      : toggleFollow,
                                  icon: isFollowActionLoading
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.check,
                                          size: 20,
                                        ),
                                  label: const Text(
                                    'Following',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    shape: RoundedRectangleBorder(
                                      borderRadius:
                                          BorderRadius.circular(14),
                                    ),
                                    side: BorderSide(
                                      color: Colors.grey.shade400,
                                      width: 1.5,
                                    ),
                                  ),
                                )
                              : ElevatedButton.icon(
                                  onPressed: isFollowActionLoading
                                      ? null
                                      : toggleFollow,
                                  icon: isFollowActionLoading
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.person_add_rounded,
                                          size: 20,
                                        ),
                                  label: const Text(
                                    'Follow',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor:
                                        Theme.of(context).colorScheme.primary,
                                    foregroundColor: Colors.white,
                                    elevation: 2,
                                    shape: RoundedRectangleBorder(
                                      borderRadius:
                                          BorderRadius.circular(14),
                                    ),
                                  ),
                                ),
                        ),
                      ),

                      const SizedBox(height: 20),

                      // STATS ROW
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          border: Border.all(color: Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            Column(
                              children: [
                                Text(
                                  isPostsLoading ? '–' : '${posts.length}',
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Posts',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                            Container(
                                height: 28,
                                width: 1,
                                color: Colors.grey.shade300),
                            InkWell(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => UserListPage(
                                      userId: widget.userId,
                                      title: '${widget.userName}\'s Followers',
                                      endpoint: 'followers',
                                    ),
                                  ),
                                );
                              },
                              borderRadius: BorderRadius.circular(8),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 4,
                                ),
                                child: Column(
                                  children: [
                                    Text(
                                      '$followersCount',
                                      style: const TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Followers',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Colors.grey[600],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Container(
                                height: 28,
                                width: 1,
                                color: Colors.grey.shade300),
                            InkWell(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => UserListPage(
                                      userId: widget.userId,
                                      title: '${widget.userName}\'s Following',
                                      endpoint: 'following',
                                    ),
                                  ),
                                );
                              },
                              borderRadius: BorderRadius.circular(8),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 4,
                                ),
                                child: Column(
                                  children: [
                                    Text(
                                      '$followingCount',
                                      style: const TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Following',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Colors.grey[600],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 24),

                      // POSTS GRID
                      if (isPostsLoading)
                        const Center(
                          child: CircularProgressIndicator(),
                        )
                      else if (posts.isEmpty)
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(
                              children: [
                                Icon(
                                  Icons.photo_library_outlined,
                                  size: 60,
                                  color: Colors.grey[300],
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  'No posts yet',
                                  style: TextStyle(
                                    color: Colors.grey[500],
                                    fontSize: 16,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: posts.length,
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            crossAxisSpacing: 3,
                            mainAxisSpacing: 3,
                          ),
                          itemBuilder: (context, index) {
                            final post = posts[index];
                            final pImageUrl = post['imageUrl'];

                            return InkWell(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => PostDetailPage(
                                      post: post,
                                    ),
                                  ),
                                );
                              },
                              child: pImageUrl == null ||
                                      pImageUrl.toString().isEmpty
                                  ? Container(
                                      color: Colors.grey[200],
                                      child: const Icon(
                                        Icons.image_not_supported_outlined,
                                        color: Colors.grey,
                                      ),
                                    )
                                  : Image.network(
                                      pImageUrl.toString(),
                                      fit: BoxFit.cover,
                                      errorBuilder: (ctx, e, st) => Container(
                                        color: Colors.grey[200],
                                        child: const Icon(
                                          Icons.broken_image_outlined,
                                          color: Colors.grey,
                                        ),
                                      ),
                                    ),
                            );
                          },
                        ),
                    ],
                  ),
      ),
    );
  }
}

// ======================================================
// NOTIFICATIONS PAGE  (Step 8 — Notifications)
// ======================================================

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<dynamic> notifications = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    loadNotifications();
  }

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  Future<void> loadNotifications() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final token = await _getToken();
      if (token == null) return;

      final response = await http.get(
        Uri.parse('$apiBaseUrl/notifications'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          notifications = data is List ? data : [];
          isLoading = false;
        });
      } else {
        setState(() {
          errorMessage = 'Failed to load notifications';
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

  Future<void> markAllAsRead() async {
    try {
      final token = await _getToken();
      if (token == null) return;

      final response = await http.patch(
        Uri.parse('$apiBaseUrl/notifications/read-all'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        setState(() {
          for (var item in notifications) {
            item['isRead'] = true;
          }
        });
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('All notifications marked as read'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (_) {}
  }

  Future<void> markSingleAsRead(int id) async {
    try {
      final token = await _getToken();
      if (token == null) return;

      await http.patch(
        Uri.parse('$apiBaseUrl/notifications/$id/read'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      setState(() {
        final idx = notifications.indexWhere((n) => n['id'] == id);
        if (idx != -1) {
          notifications[idx]['isRead'] = true;
        }
      });
    } catch (_) {}
  }

  IconData _getNotificationIcon(String? type) {
    switch (type) {
      case 'like':
        return Icons.favorite;
      case 'comment':
        return Icons.chat_bubble_rounded;
      case 'follow':
        return Icons.person_add_rounded;
      default:
        return Icons.notifications;
    }
  }

  Color _getNotificationColor(String? type) {
    switch (type) {
      case 'like':
        return Colors.redAccent;
      case 'comment':
        return Colors.blue;
      case 'follow':
        return Colors.purple;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount =
        notifications.where((n) => n['isRead'] == false).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Notifications',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
        actions: [
          if (unreadCount > 0)
            TextButton(
              onPressed: markAllAsRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: loadNotifications,
        child: isLoading
            ? const Center(
                child: CircularProgressIndicator(),
              )
            : errorMessage != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.error_outline,
                          size: 60,
                          color: Colors.red,
                        ),
                        const SizedBox(height: 16),
                        Text(errorMessage!),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: loadNotifications,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                : notifications.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.notifications_none_rounded,
                              size: 80,
                              color: Colors.grey[300],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No notifications yet',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.grey[600],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'When people follow you, like or comment on your posts,\nyou will see them here.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[500],
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        itemCount: notifications.length,
                        separatorBuilder: (context, index) => const Divider(
                          height: 1,
                          indent: 72,
                        ),
                        itemBuilder: (context, index) {
                          final item = notifications[index];
                          final isRead = item['isRead'] == true;
                          final type = item['type']?.toString();
                          final message = item['message'] ?? '';
                          final createdAt = item['createdAt'];

                          return InkWell(
                            onTap: () {
                              if (!isRead && item['id'] != null) {
                                markSingleAsRead(item['id']);
                              }
                            },
                            child: Container(
                              color: isRead
                                  ? Colors.transparent
                                  : Theme.of(context)
                                      .colorScheme
                                      .primary
                                      .withValues(alpha: 0.06),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  CircleAvatar(
                                    radius: 22,
                                    backgroundColor: _getNotificationColor(type)
                                        .withValues(alpha: 0.15),
                                    child: Icon(
                                      _getNotificationIcon(type),
                                      color: _getNotificationColor(type),
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          message,
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: isRead
                                                ? FontWeight.normal
                                                : FontWeight.bold,
                                            color: Colors.black87,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          formatTimeAgo(createdAt),
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.grey[500],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (!isRead)
                                    Container(
                                      width: 9,
                                      height: 9,
                                      margin: const EdgeInsets.only(
                                        top: 6,
                                        left: 8,
                                      ),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Theme.of(context)
                                            .colorScheme
                                            .primary,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}

// ======================================================
// USER LIST PAGE (FOLLOWERS / FOLLOWING)
// ======================================================

class UserListPage extends StatefulWidget {
  final int userId;
  final String title;
  final String endpoint; // 'followers' or 'following'

  const UserListPage({
    super.key,
    required this.userId,
    required this.title,
    required this.endpoint,
  });

  @override
  State<UserListPage> createState() => _UserListPageState();
}

class _UserListPageState extends State<UserListPage> {
  List<dynamic> users = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    fetchUsers();
  }

  Future<void> fetchUsers() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('accessToken');

      final response = await http.get(
        Uri.parse(
          '$apiBaseUrl/users/${widget.userId}/${widget.endpoint}',
        ),
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          setState(() {
            users = data is List ? data : [];
            isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            errorMessage = 'Failed to load list: ${response.statusCode}';
            isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          errorMessage = 'Connection error: $e';
          isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (!isLoading && errorMessage == null)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context)
                        .colorScheme
                        .primary
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${users.length}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: buildBody(),
    );
  }

  Widget buildBody() {
    if (isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 56,
                color: Colors.redAccent,
              ),
              const SizedBox(height: 16),
              Text(
                errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: fetchUsers,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (users.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.people_outline,
                size: 64,
                color: Colors.grey.shade400,
              ),
              const SizedBox(height: 16),
              Text(
                widget.endpoint == 'followers'
                    ? 'No followers yet'
                    : 'Not following anyone yet',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade600,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'When people connect, they will appear here.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade500,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: fetchUsers,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: users.length,
        separatorBuilder: (context, index) => Divider(
          height: 1,
          indent: 72,
          color: Colors.grey.shade200,
        ),
        itemBuilder: (context, index) {
          final user = users[index];
          final String name = user['name'] ?? '';
          final String username = user['username'] ?? '';
          final String displayName =
              name.isNotEmpty ? name : (username.isNotEmpty ? username : 'User');
          final String? profileImageUrl = user['profileImageUrl'];
          final String? bio = user['bio'];
          final String firstLetter = displayName.isNotEmpty
              ? displayName.substring(0, 1).toUpperCase()
              : 'U';

          return ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 4,
            ),
            leading: CircleAvatar(
              radius: 24,
              backgroundImage: (profileImageUrl != null &&
                      profileImageUrl.isNotEmpty)
                  ? NetworkImage(profileImageUrl)
                  : null,
              child: (profileImageUrl == null || profileImageUrl.isEmpty)
                  ? Text(
                      firstLetter,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    )
                  : null,
            ),
            title: Text(
              displayName,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (username.isNotEmpty)
                  Text(
                    '@$username',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                    ),
                  ),
                if (bio != null && bio.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    bio.trim(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ],
            ),
            trailing: const Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: Colors.grey,
            ),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => UserProfilePage(
                    userId: user['id'],
                    userName: displayName,
                  ),
                ),
              );
            },
          );
        },
      ),
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
      final tagText = _taggedUsers.isEmpty ? '' : '\n\nTagged: ' + _taggedUsers.map((u) => '@$u').join(' ');
      final finalContent = content + tagText;
      if (finalContent.isNotEmpty) {
        request.fields['content'] = finalContent;
      }

      request.fields['backgroundColor'] = '#' + _selectedBackgroundColor.toRadixString(16).padLeft(8, '0').substring(2).toUpperCase();
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
              Row(children: [const Text('Font size', style: TextStyle(fontWeight: FontWeight.w600)), const Spacer(), Text(_selectedFontSize.round().toString() + ' px', style: const TextStyle(fontWeight: FontWeight.bold))]),
              Slider(min: 16, max: 40, divisions: 12, value: _selectedFontSize, label: _selectedFontSize.round().toString() + ' px', onChanged: (value) => setState(() => _selectedFontSize = value)),
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