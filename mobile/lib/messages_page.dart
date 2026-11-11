import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

String apiBaseUrl = const String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000',
);

Future<void> loadApiBaseUrl() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('custom_api_base_url');
    if (saved != null && saved.trim().isNotEmpty) {
      apiBaseUrl = saved.trim();
    }
  } catch (_) {}
}

Future<void> setApiBaseUrl(String newUrl) async {
  apiBaseUrl = newUrl.trim();
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('custom_api_base_url', apiBaseUrl);
  } catch (_) {}
}

// Decoupled callbacks for opening full Post Detail & User Profile from messages
typedef OpenPostCallback = void Function(BuildContext context, Map<String, dynamic> post);
typedef OpenProfileCallback = void Function(BuildContext context, int userId, String name);

class MessageNavigationCallbacks {
  static OpenPostCallback? onOpenPost;
  static OpenProfileCallback? onOpenProfile;
}

/// Formats date for conversation dividers
String formatDateDivider(String dateString) {
  try {
    final dt = DateTime.parse(dateString).toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDate = DateTime(dt.year, dt.month, dt.day);

    if (messageDate == today) return 'Today';
    if (messageDate == today.subtract(const Duration(days: 1))) return 'Yesterday';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  } catch (_) {
    return dateString;
  }
}

/// Clean sidebar last message preview text
String cleanSidebarPreview(String? txt) {
  if (txt == null || txt.isEmpty) return '';

  // Web format: [POST_SHARE:{...}] userComment
  final match = RegExp(r'^\[POST_SHARE:(.+?)\]\s*(.*)$', dotAll: true).firstMatch(txt);
  if (match != null) {
    final userComment = match.group(2)?.trim() ?? '';
    if (userComment.isNotEmpty) {
      return '📷 $userComment';
    }
    try {
      final parsed = jsonDecode(match.group(1)!);
      final title = parsed['title']?.toString() ?? '';
      if (title.isNotEmpty) return '📷 Shared post: "$title"';
    } catch (_) {}
    return '📷 Shared a post';
  }

  // Legacy mobile format: {"__sharedPost__": true, ...}
  if (txt.contains('"__sharedPost__":') || txt.contains('"__sharedPost__": true')) {
    try {
      final parsed = jsonDecode(txt);
      if (parsed is Map && parsed['__sharedPost__'] == true) {
        final comment = parsed['text']?.toString() ?? '';
        return comment.isNotEmpty ? '📷 $comment' : '📷 Shared a post';
      }
    } catch (_) {}
    return '📷 Shared a post';
  }

  if (txt.startsWith('[IMAGE:')) return '📷 Image';
  if (txt.startsWith('[VOICE:')) return '🎤 Voice message';
  if (txt.startsWith('[FILE:')) return '📎 Attachment';

  return txt;
}

/// Clean pinned message snippet for top banner
String cleanPinnedSnippet(String? txt) {
  if (txt == null || txt.isEmpty) return 'Pinned message';

  final match = RegExp(r'^\[POST_SHARE:(.+?)\]\s*(.*)$', dotAll: true).firstMatch(txt);
  if (match != null) {
    try {
      final data = jsonDecode(match.group(1)!);
      final userComment = match.group(2)?.trim() ?? '';
      final title = data['title']?.toString() ?? 'Post';
      if (userComment.isNotEmpty) {
        return '📷 Shared post: "$title" • $userComment';
      }
      return '📷 Shared post: "$title"';
    } catch (_) {
      return '📷 Shared post';
    }
  }

  if (txt.startsWith('[IMAGE:')) return '📷 Image';
  if (txt.startsWith('[VOICE:')) return '🎤 Voice message';
  if (txt.startsWith('[FILE:')) return '📎 Attachment';

  return txt.length > 75 ? '${txt.substring(0, 75)}...' : txt;
}

// ======================================================
// MESSAGES LIST PAGE
// ======================================================

class MessagesPage extends StatefulWidget {
  final Map<String, dynamic>? initialSharedPost;

  const MessagesPage({
    super.key,
    this.initialSharedPost,
  });

  @override
  State<MessagesPage> createState() => _MessagesPageState();
}

class _MessagesPageState extends State<MessagesPage> {
  final TextEditingController searchController = TextEditingController();
  List<Map<String, dynamic>> conversations = [];
  Map<String, dynamic>? currentUser;
  bool loading = true;
  String? error;
  String searchQuery = '';

  @override
  void initState() {
    super.initState();
    loadConversations();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<String?> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  Future<void> loadConversations() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('Please log in again.');

      final responses = await Future.wait([
        http.get(
          Uri.parse('$apiBaseUrl/messages/conversations'),
          headers: {'Authorization': 'Bearer $token'},
        ),
        http.get(
          Uri.parse('$apiBaseUrl/users/me'),
          headers: {'Authorization': 'Bearer $token'},
        ),
      ]);

      if (responses[0].statusCode != 200) {
        throw Exception('Failed to load messages (${responses[0].statusCode})');
      }

      final convData = jsonDecode(responses[0].body);
      final meData = responses[1].statusCode == 200 ? jsonDecode(responses[1].body) : null;

      final rawList = convData is List
          ? convData.map((e) => Map<String, dynamic>.from(e as Map)).toList()
          : <Map<String, dynamic>>[];

      List<Map<String, dynamic>> finalConversations = [];

      if (meData != null && meData is Map) {
        currentUser = Map<String, dynamic>.from(meData);
        final myId = currentUser!['id']?.toString();

        // Find if user already had self-notes
        final existingSelf = rawList.firstWhere(
          (c) => c['user']?['id']?.toString() == myId,
          orElse: () => <String, dynamic>{},
        );

        final others = rawList.where(
          (c) => c['user']?['id']?.toString() != myId,
        ).toList();

        // Always prepend "You (Message yourself)" at the top
        final youConversation = <String, dynamic>{
          'user': {
            'id': currentUser!['id'],
            'username': currentUser!['username'] ?? 'You',
            'name': 'You (Message yourself)',
            'profileImageUrl': currentUser!['profileImageUrl'],
          },
          'lastMessage': existingSelf.isNotEmpty
              ? existingSelf['lastMessage']
              : {
                  'id': 0,
                  'content': 'Message yourself • Notes, posts & reminders',
                  'senderId': currentUser!['id'],
                  'createdAt': '',
                },
          'isSelf': true,
        };

        finalConversations = [youConversation, ...others];
      } else {
        finalConversations = rawList;
      }

      setState(() {
        conversations = finalConversations;
      });
    } catch (e) {
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> openConversation(Map<String, dynamic> user, {bool isSelf = false}) async {
    final userId = user['id'] is int ? user['id'] as int : int.tryParse(user['id'].toString()) ?? 0;
    final username = isSelf ? 'You (Notes)' : (user['username'] ?? user['name'] ?? 'User').toString();

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ChatPage(
          userId: userId,
          username: username,
          profileImageUrl: user['profileImageUrl']?.toString(),
          sharedPost: widget.initialSharedPost,
        ),
      ),
    );
    loadConversations();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final filteredConversations = conversations.where((item) {
      if (searchQuery.trim().isEmpty) return true;
      final user = item['user'] as Map?;
      final uname = (user?['username'] ?? '').toString().toLowerCase();
      final name = (user?['name'] ?? '').toString().toLowerCase();
      final q = searchQuery.toLowerCase().trim();
      return uname.contains(q) || name.contains(q);
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Messages',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: loadConversations,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: loadConversations,
        child: Column(
          children: [
            // Search / filter bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Container(
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: TextField(
                  controller: searchController,
                  onChanged: (val) => setState(() => searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search chats...',
                    hintStyle: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                    prefixIcon: Icon(
                      Icons.search_rounded,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      size: 20,
                    ),
                    suffixIcon: searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18),
                            onPressed: () {
                              searchController.clear();
                              setState(() => searchQuery = '');
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ),

            // Conversation list
            Expanded(
              child: loading
                  ? const Center(child: CircularProgressIndicator())
                  : error != null
                      ? ListView(
                          children: [
                            const SizedBox(height: 120),
                            Center(
                              child: Text(
                                error!,
                                style: const TextStyle(color: Colors.redAccent),
                              ),
                            ),
                            const SizedBox(height: 14),
                            Center(
                              child: ElevatedButton.icon(
                                onPressed: loadConversations,
                                icon: const Icon(Icons.refresh),
                                label: const Text('Retry'),
                              ),
                            ),
                          ],
                        )
                      : filteredConversations.isEmpty
                          ? ListView(
                              children: [
                                const SizedBox(height: 120),
                                Icon(
                                  Icons.chat_bubble_outline_rounded,
                                  size: 64,
                                  color: isDark ? Colors.grey[700] : Colors.grey[300],
                                ),
                                const SizedBox(height: 16),
                                Center(
                                  child: Text(
                                    searchQuery.isNotEmpty
                                        ? 'No chats match "$searchQuery"'
                                        : 'No conversations yet',
                                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Center(
                                  child: Text(
                                    searchQuery.isNotEmpty
                                        ? 'Try another username or name.'
                                        : 'Message yourself or connect with friends.',
                                    style: TextStyle(
                                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              itemCount: filteredConversations.length,
                              separatorBuilder: (_, _) => Divider(
                                height: 1,
                                indent: 76,
                                color: isDark ? const Color(0xFF262626) : const Color(0xFFF1F1F1),
                              ),
                              itemBuilder: (context, index) {
                                final item = filteredConversations[index];
                                final user = Map<String, dynamic>.from(item['user'] as Map);
                                final last = item['lastMessage'] is Map
                                    ? Map<String, dynamic>.from(item['lastMessage'] as Map)
                                    : <String, dynamic>{};
                                final isSelf = item['isSelf'] == true;

                                final rawLastContent = last['content']?.toString() ?? '';
                                final cleanPreview = cleanSidebarPreview(rawLastContent);
                                final unreadCount = (item['unreadCount'] as num?)?.toInt() ?? 0;
                                final online = user['isOnline'] == true && !isSelf;

                                return ListTile(
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                  leading: Stack(
                                    clipBehavior: Clip.none,
                                    children: [
                                      _Avatar(
                                        url: user['profileImageUrl']?.toString(),
                                        name: isSelf
                                            ? 'You'
                                            : (user['username'] ?? user['name'] ?? 'U').toString(),
                                        isSelf: isSelf,
                                      ),
                                      if (online)
                                        Positioned(
                                          right: 0,
                                          bottom: 0,
                                          child: Container(
                                            width: 13,
                                            height: 13,
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF16A34A),
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: isDark ? Colors.black : Colors.white,
                                                width: 2,
                                              ),
                                            ),
                                          ),
                                        ),
                                      if (isSelf)
                                        Positioned(
                                          right: -2,
                                          bottom: -2,
                                          child: Container(
                                            padding: const EdgeInsets.all(3),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF6366F1),
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: isDark ? Colors.black : Colors.white,
                                                width: 1.5,
                                              ),
                                            ),
                                            child: const Icon(
                                              Icons.push_pin_rounded,
                                              size: 11,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  title: Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          isSelf
                                              ? 'You'
                                              : (user['username'] ?? user['name'] ?? 'User').toString(),
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 15,
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (isSelf) ...[
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF6366F1).withValues(alpha: 0.15),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: const Text(
                                            'Notes & Reminders',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                              color: Color(0xFF6366F1),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  subtitle: Padding(
                                    padding: const EdgeInsets.only(top: 3),
                                    child: Text(
                                      cleanPreview.isNotEmpty
                                          ? cleanPreview
                                          : (isSelf
                                              ? 'Message yourself • Notes, posts & reminders'
                                              : 'Tap to start chatting'),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: unreadCount > 0 ? FontWeight.w700 : FontWeight.normal,
                                        color: unreadCount > 0
                                            ? (isDark ? Colors.white : Colors.black)
                                            : isSelf
                                                ? (isDark ? Colors.grey[400] : Colors.grey[700])
                                                : (isDark ? Colors.grey[400] : Colors.grey[600]),
                                      ),
                                    ),
                                  ),
                                  trailing: unreadCount > 0
                                      ? Container(
                                          // No alignment: the badge sizes to its label
                                          // instead of stretching across the row.
                                          constraints: const BoxConstraints(minWidth: 22),
                                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFD94D6A),
                                            borderRadius: BorderRadius.circular(11),
                                          ),
                                          child: Text(
                                            unreadCount > 99 ? '99+' : '$unreadCount',
                                            textAlign: TextAlign.center,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        )
                                      : const Icon(
                                          Icons.chevron_right_rounded,
                                          color: Colors.grey,
                                          size: 20,
                                        ),
                                  onTap: () => openConversation(user, isSelf: isSelf),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

// ======================================================
// CHAT CONVERSATION PAGE
// ======================================================

class ChatPage extends StatefulWidget {
  final int userId;
  final String username;
  final String? profileImageUrl;
  final Map<String, dynamic>? sharedPost;

  const ChatPage({
    super.key,
    required this.userId,
    required this.username,
    this.profileImageUrl,
    this.sharedPost,
  });

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final TextEditingController controller = TextEditingController();
  final ScrollController scrollController = ScrollController();
  final FocusNode inputFocusNode = FocusNode();

  List<Map<String, dynamic>> messages = [];
  Map<String, dynamic>? attachedPost;
  Map<String, dynamic>? pinnedMessage;
  int? currentUserId;
  bool isSelfChat = false;
  bool loading = true;
  bool sending = false;
  String? error;
  /// Presence + whether you may reply (GET /messages/info/:id).
  Map<String, dynamic>? chatInfo;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    attachedPost = widget.sharedPost;
    load();
    _loadPinnedMessage();
    _loadChatInfo();
    // Keep the thread fresh (new messages, "seen" ticks, presence).
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => _refreshSilently());
  }

  Future<void> _loadChatInfo() async {
    try {
      final token = await _token();
      if (token == null) return;
      final res = await http.get(
        Uri.parse('$apiBaseUrl/messages/info/${widget.userId}'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200 && mounted) {
        setState(() => chatInfo = Map<String, dynamic>.from(jsonDecode(res.body) as Map));
      }
    } catch (_) {}
  }

  int _pollTick = 0;

  Future<void> _refreshSilently() async {
    if (!mounted || loading || sending) return;
    try {
      final token = await _token();
      if (token == null) return;
      final res = await http.get(
        Uri.parse('$apiBaseUrl/messages/${widget.userId}'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode != 200 || !mounted) return;
      final data = jsonDecode(res.body);
      if (data is! List) return;
      final fresh = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      final grew = fresh.length > messages.length;
      final changed = grew ||
          fresh.length != messages.length ||
          (fresh.isNotEmpty &&
              messages.isNotEmpty &&
              (fresh.last['id'] != messages.last['id'] ||
                  fresh.last['readAt'] != messages.last['readAt'] ||
                  fresh.last['content'] != messages.last['content']));
      if (changed) {
        setState(() => messages = fresh);
        if (grew) _scrollToBottom();
      }
      if (++_pollTick % 6 == 0) _loadChatInfo();
    } catch (_) {}
  }

  String _presenceText() {
    final info = chatInfo;
    if (info == null) return 'Tap for profile';
    if (info['isOnline'] == true) return 'Active now';
    final last = DateTime.tryParse(info['lastActiveAt']?.toString() ?? '')?.toLocal();
    if (last == null) return 'Tap for profile';
    final diff = DateTime.now().difference(last);
    if (diff.inMinutes < 60) return 'Active ${diff.inMinutes.clamp(1, 59)}m ago';
    if (diff.inHours < 24) return 'Active ${diff.inHours}h ago';
    if (diff.inDays <= 7) return 'Active ${diff.inDays}d ago';
    return 'Tap for profile';
  }

  String _bubbleTime(dynamic createdAt) {
    final d = DateTime.tryParse(createdAt?.toString() ?? '')?.toLocal();
    if (d == null) return '';
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final m = d.minute.toString().padLeft(2, '0');
    return '$h:$m ${d.hour < 12 ? 'AM' : 'PM'}';
  }

  @override
  void dispose() {
    _poll?.cancel();
    controller.dispose();
    scrollController.dispose();
    inputFocusNode.dispose();
    super.dispose();
  }

  Future<String?> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  Future<void> _loadPinnedMessage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('pinned_msg_${widget.userId}');
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          setState(() {
            pinnedMessage = Map<String, dynamic>.from(decoded);
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _togglePinMessage(Map<String, dynamic> msg) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (pinnedMessage != null && pinnedMessage!['id'] == msg['id']) {
        await prefs.remove('pinned_msg_${widget.userId}');
        setState(() => pinnedMessage = null);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Message unpinned')),
          );
        }
      } else {
        await prefs.setString('pinned_msg_${widget.userId}', jsonEncode(msg));
        setState(() => pinnedMessage = msg);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Message pinned to top 📌')),
          );
        }
      }
    } catch (_) {}
  }

  Future<void> load() async {
    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('Please log in again.');

      final responses = await Future.wait([
        http.get(
          Uri.parse('$apiBaseUrl/messages/${widget.userId}'),
          headers: {'Authorization': 'Bearer $token'},
        ),
        http.get(
          Uri.parse('$apiBaseUrl/users/me'),
          headers: {'Authorization': 'Bearer $token'},
        ),
      ]);

      if (responses[0].statusCode != 200 || responses[1].statusCode != 200) {
        throw Exception('Failed to load conversation.');
      }

      final messageData = jsonDecode(responses[0].body);
      final meData = jsonDecode(responses[1].body);

      if (!mounted) return;
      final meId = int.tryParse(meData['id'].toString());
      final isSelf = meId != null && meId == widget.userId;

      setState(() {
        messages = messageData is List
            ? messageData.map((e) => Map<String, dynamic>.from(e as Map)).toList()
            : [];
        currentUserId = meId;
        isSelfChat = isSelf;
        error = null;
      });
      _scrollToBottom();
    } catch (e) {
      if (mounted) setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scrollController.hasClients) {
        scrollController.animateTo(
          scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _scrollToPinnedMessage() {
    if (pinnedMessage == null) return;
    final pinId = pinnedMessage!['id'];
    final idx = messages.indexWhere((m) => m['id'] == pinId);
    if (idx != -1 && scrollController.hasClients) {
      final target = (idx / messages.length) * scrollController.position.maxScrollExtent;
      scrollController.animateTo(
        target,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> sendMessage() async {
    final text = controller.text.trim();
    if ((text.isEmpty && attachedPost == null) || sending) return;
    setState(() => sending = true);

    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('Please log in again.');

      // Match Web standard format: [POST_SHARE:{...}] userComment
      String finalContent = text;
      if (attachedPost != null) {
        final shareTag = '[POST_SHARE:${jsonEncode(attachedPost)}]';
        finalContent = text.isNotEmpty ? '$shareTag $text' : shareTag;
      }

      final response = await http.post(
        Uri.parse('$apiBaseUrl/messages/${widget.userId}'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'content': finalContent,
        }),
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        String msg = 'Failed to send message.';
        try {
          final data = jsonDecode(response.body);
          if (data['message'] != null) msg = data['message'].toString();
        } catch (_) {}
        throw Exception(msg);
      }

      controller.clear();
      if (mounted) setState(() => attachedPost = null);
      await load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  void _showMessageOptions(Map<String, dynamic> message, String displayText) {
    final isMine = currentUserId != null &&
        message['senderId'].toString() == currentUserId.toString();
    final isPinned = pinnedMessage != null && pinnedMessage!['id'] == message['id'];

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
              ListTile(
                leading: Icon(isPinned ? Icons.push_pin_outlined : Icons.push_pin_rounded),
                title: Text(isPinned ? 'Unpin message' : 'Pin message'),
                onTap: () {
                  Navigator.pop(ctx);
                  _togglePinMessage(message);
                },
              ),
              ListTile(
                leading: const Icon(Icons.copy_rounded),
                title: const Text('Copy text'),
                onTap: () {
                  Navigator.pop(ctx);
                  Clipboard.setData(ClipboardData(text: displayText));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Message copied to clipboard')),
                  );
                },
              ),
              if (isMine)
                ListTile(
                  leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                  title: const Text('Delete message', style: TextStyle(color: Colors.redAccent)),
                  onTap: () async {
                    Navigator.pop(ctx);
                    try {
                      final token = await _token();
                      if (token == null) return;
                      final res = await http.delete(
                        Uri.parse('$apiBaseUrl/messages/message/${message['id']}'),
                        headers: {'Authorization': 'Bearer $token'},
                      );
                      if (res.statusCode == 200) {
                        setState(() {
                          messages.removeWhere((m) => m['id'] == message['id']);
                          if (pinnedMessage?['id'] == message['id']) {
                            pinnedMessage = null;
                          }
                        });
                      }
                    } catch (_) {}
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: InkWell(
          onTap: () {
            if (!isSelfChat) {
              MessageNavigationCallbacks.onOpenProfile?.call(
                context,
                widget.userId,
                widget.username,
              );
            }
          },
          child: Row(
            children: [
              _Avatar(
                url: widget.profileImageUrl,
                name: widget.username,
                isSelf: isSelfChat,
                radius: 19,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.username,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Row(children: [
                      if (!isSelfChat && chatInfo?['isOnline'] == true) ...[
                        Container(
                          width: 7,
                          height: 7,
                          decoration: const BoxDecoration(color: Color(0xFF16A34A), shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 5),
                      ],
                      Flexible(
                        child: Text(
                          isSelfChat ? 'Notes to self' : _presenceText(),
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11.5,
                            color: !isSelfChat && chatInfo?['isOnline'] == true
                                ? const Color(0xFF16A34A)
                                : (isDark ? Colors.grey[400] : Colors.grey[600]),
                          ),
                        ),
                      ),
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          // ── Pinned Message Banner (Telegram/WhatsApp style) ──
          if (pinnedMessage != null)
            GestureDetector(
              onTap: _scrollToPinnedMessage,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E1E2E) : const Color(0xFFEEF2FF),
                  border: Border(
                    bottom: BorderSide(
                      color: const Color(0xFF6366F1).withValues(alpha: 0.3),
                      width: 1,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6366F1).withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.push_pin_rounded,
                        size: 15,
                        color: Color(0xFF6366F1),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Pinned Message',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF6366F1),
                            ),
                          ),
                          Text(
                            cleanPinnedSnippet(pinnedMessage!['content']?.toString()),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12.5,
                              color: isDark ? Colors.grey[300] : Colors.grey[800],
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      color: Colors.grey,
                      onPressed: () => _togglePinMessage(pinnedMessage!),
                      tooltip: 'Unpin',
                    ),
                  ],
                ),
              ),
            ),

          // ── Messages Area ──
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Padding(
                              padding: const EdgeInsets.all(20),
                              child: Text(error!, textAlign: TextAlign.center),
                            ),
                            ElevatedButton(
                              onPressed: () {
                                setState(() => loading = true);
                                load();
                              },
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : messages.isEmpty
                        ? _buildEmptyChatState(isDark)
                        : ListView.builder(
                            controller: scrollController,
                            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                            itemCount: messages.length + 1, // +1 for E2EE header
                            itemBuilder: (context, index) {
                              if (index == 0) {
                                return _buildE2EEBanner(isDark);
                              }

                              final msgIndex = index - 1;
                              final message = messages[msgIndex];
                              final prevMessage = msgIndex > 0 ? messages[msgIndex - 1] : null;

                              // Date divider
                              final currentCreatedAt = message['createdAt']?.toString() ?? '';
                              final prevCreatedAt = prevMessage?['createdAt']?.toString() ?? '';
                              final currentDateStr = formatDateDivider(currentCreatedAt);
                              final prevDateStr = formatDateDivider(prevCreatedAt);
                              final showDateDivider = msgIndex == 0 || currentDateStr != prevDateStr;

                              final isMine = currentUserId != null &&
                                  message['senderId'].toString() == currentUserId.toString();
                              final rawContent = message['content']?.toString() ?? '';

                              // Parse shared post & display text
                              Map<String, dynamic>? sharedPost;
                              String displayText = rawContent;

                              // 1. Web format: [POST_SHARE:{...}] userComment
                              final shareMatch = RegExp(r'^\[POST_SHARE:(.+?)\]\s*(.*)$', dotAll: true)
                                  .firstMatch(rawContent);
                              if (shareMatch != null) {
                                try {
                                  final decoded = jsonDecode(shareMatch.group(1)!);
                                  if (decoded is Map) {
                                    sharedPost = Map<String, dynamic>.from(decoded);
                                    displayText = shareMatch.group(2)?.trim() ?? '';
                                  }
                                } catch (_) {}
                              } else {
                                // 2. Legacy mobile format: {"__sharedPost__": true, ...}
                                try {
                                  final decoded = jsonDecode(rawContent);
                                  if (decoded is Map && decoded['__sharedPost__'] == true) {
                                    if (decoded['post'] is Map) {
                                      sharedPost = Map<String, dynamic>.from(decoded['post'] as Map);
                                    }
                                    displayText = decoded['text']?.toString() ?? '';
                                  }
                                } catch (_) {}
                              }

                              final isThisPinned = pinnedMessage != null && pinnedMessage!['id'] == message['id'];

                              return Column(
                                children: [
                                  if (showDateDivider && currentDateStr.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: isDark ? const Color(0xFF262626) : const Color(0xFFE5E7EB),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          currentDateStr,
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: isDark ? Colors.grey[400] : Colors.grey[700],
                                          ),
                                        ),
                                      ),
                                    ),
                                  Align(
                                    alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
                                    child: GestureDetector(
                                      onLongPress: () => _showMessageOptions(message, displayText),
                                      child: Container(
                                        constraints: BoxConstraints(
                                          maxWidth: MediaQuery.of(context).size.width * 0.82,
                                        ),
                                        margin: const EdgeInsets.only(bottom: 8),
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: isMine
                                              ? (isDark ? const Color(0xFF4F46E5) : const Color(0xFF6366F1))
                                              : (isDark ? const Color(0xFF1F2937) : const Color(0xFFF3F4F6)),
                                          borderRadius: BorderRadius.only(
                                            topLeft: const Radius.circular(18),
                                            topRight: const Radius.circular(18),
                                            bottomLeft: Radius.circular(isMine ? 18 : 4),
                                            bottomRight: Radius.circular(isMine ? 4 : 18),
                                          ),
                                          border: isThisPinned
                                              ? Border.all(color: const Color(0xFFFBBF24), width: 1.5)
                                              : null,
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black.withValues(alpha: 0.04),
                                              blurRadius: 4,
                                              offset: const Offset(0, 2),
                                            ),
                                          ],
                                        ),
                                        child: Column(
                                          crossAxisAlignment: isMine
                                              ? CrossAxisAlignment.end
                                              : CrossAxisAlignment.start,
                                          children: [
                                            if (sharedPost != null) ...[
                                              _SharedPostPreview(
                                                post: sharedPost,
                                                isMine: isMine,
                                              ),
                                              if (displayText.isNotEmpty) const SizedBox(height: 8),
                                            ],
                                            if (displayText.isNotEmpty)
                                              Padding(
                                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                                child: Text(
                                                  displayText,
                                                  style: TextStyle(
                                                    fontSize: 14.5,
                                                    height: 1.35,
                                                    color: isMine
                                                        ? Colors.white
                                                        : (isDark ? Colors.white : Colors.black87),
                                                  ),
                                                ),
                                              ),
                                            Padding(
                                              padding: const EdgeInsets.only(top: 2, left: 4, right: 2),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Text(
                                                    _bubbleTime(message['createdAt']),
                                                    style: TextStyle(
                                                      fontSize: 10,
                                                      color: isMine ? Colors.white70 : Colors.grey,
                                                    ),
                                                  ),
                                                  if (isMine && !isSelfChat) ...[
                                                    const SizedBox(width: 4),
                                                    Icon(
                                                      message['readAt'] != null
                                                          ? Icons.done_all_rounded
                                                          : Icons.done_rounded,
                                                      size: 13,
                                                      color: message['readAt'] != null
                                                          ? const Color(0xFF9BE7FF)
                                                          : Colors.white70,
                                                    ),
                                                  ],
                                                ],
                                              ),
                                            ),
                                            if (isThisPinned)
                                              Padding(
                                                padding: const EdgeInsets.only(top: 4),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Icon(
                                                      Icons.push_pin_rounded,
                                                      size: 11,
                                                      color: isMine ? Colors.white70 : Colors.amber[700],
                                                    ),
                                                    const SizedBox(width: 3),
                                                    Text(
                                                      'Pinned',
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        color: isMine ? Colors.white70 : Colors.amber[700],
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
          ),

          // ── Attached Post Banner above Input Bar ──
          if (attachedPost != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1F2937) : const Color(0xFFF1F5F9),
                border: Border(
                  top: BorderSide(
                    color: isDark ? const Color(0xFF374151) : const Color(0xFFE2E8F0),
                  ),
                ),
              ),
              child: Row(
                children: [
                  // Post thumbnail
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: attachedPost!['imageUrl'] != null &&
                            attachedPost!['imageUrl'].toString().isNotEmpty
                        ? Image.network(
                            attachedPost!['imageUrl'].toString(),
                            width: 44,
                            height: 44,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => Container(
                              width: 44,
                              height: 44,
                              color: Colors.grey,
                              child: const Icon(Icons.broken_image, size: 20),
                            ),
                          )
                        : Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                              ),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Center(
                              child: Icon(Icons.article_rounded, color: Colors.white, size: 22),
                            ),
                          ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text(
                              'Replying to post',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF6366F1)),
                            ),
                            const Text(' • ', style: TextStyle(color: Colors.grey)),
                            Expanded(
                              child: Text(
                                '@${(attachedPost!['author']?['username'] ?? 'user')}',
                                style: const TextStyle(fontSize: 11, color: Colors.grey),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          attachedPost!['title']?.toString().isNotEmpty == true
                              ? attachedPost!['title'].toString()
                              : (attachedPost!['content']?.toString() ?? 'Post preview'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    tooltip: 'Cancel post attachment',
                    onPressed: () => setState(() => attachedPost = null),
                  ),
                ],
              ),
            ),

          // ── Message Input Bar (or why you can't reply) ──
          if (!isSelfChat && chatInfo?['canMessage'] == false)
            SafeArea(
              top: false,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.lock_outline, size: 16, color: Colors.grey),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      chatInfo?['reason']?.toString() ?? "You can't reply to this conversation",
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.grey),
                    ),
                  ),
                ]),
              ),
            )
          else
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor,
                border: Border(
                  top: BorderSide(
                    color: isDark ? const Color(0xFF262626) : const Color(0xFFE5E7EB),
                    width: 0.8,
                  ),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: TextField(
                        controller: controller,
                        focusNode: inputFocusNode,
                        minLines: 1,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: attachedPost != null
                              ? 'Add a message about this post...'
                              : (isSelfChat ? 'Note to yourself...' : 'Message ${widget.username}...'),
                          hintStyle: TextStyle(
                            fontSize: 14,
                            color: isDark ? Colors.grey[500] : Colors.grey[600],
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        onSubmitted: (_) => sendMessage(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    margin: const EdgeInsets.only(bottom: 2),
                    child: IconButton.filled(
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFF6366F1),
                        foregroundColor: Colors.white,
                      ),
                      onPressed: sending ? null : sendMessage,
                      icon: sending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.send_rounded, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildE2EEBanner(bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withValues(alpha: 0.6) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.lock_outline_rounded, size: 13, color: Color(0xFF10B981)),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              'Messages are end-to-end encrypted.',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyChatState(bool isDark) {
    if (isSelfChat) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF6366F1).withValues(alpha: 0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: const Center(
                  child: Text('📝', style: TextStyle(fontSize: 32)),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Message yourself 📌',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Keep personal notes, to-dos, links, and shared posts handy across all your devices.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: [
                  ActionChip(
                    avatar: const Text('📌'),
                    label: const Text('Note / To-do'),
                    onPressed: () {
                      controller.text = '📌 To-do: ';
                      controller.selection = TextSelection.fromPosition(
                        TextPosition(offset: controller.text.length),
                      );
                      inputFocusNode.requestFocus();
                    },
                  ),
                  ActionChip(
                    avatar: const Text('🔗'),
                    label: const Text('Save Link'),
                    onPressed: () {
                      controller.text = '🔗 Saved link: ';
                      controller.selection = TextSelection.fromPosition(
                        TextPosition(offset: controller.text.length),
                      );
                      inputFocusNode.requestFocus();
                    },
                  ),
                  ActionChip(
                    avatar: const Text('💡'),
                    label: const Text('Idea'),
                    onPressed: () {
                      controller.text = '💡 Idea: ';
                      controller.selection = TextSelection.fromPosition(
                        TextPosition(offset: controller.text.length),
                      );
                      inputFocusNode.requestFocus();
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Avatar(url: widget.profileImageUrl, name: widget.username, radius: 36),
          const SizedBox(height: 14),
          Text(
            widget.username,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            'Say hi to start the conversation 👋',
            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () {
              controller.text = '👋 Hey!';
              sendMessage();
            },
            icon: const Text('👋'),
            label: const Text('Wave Hello'),
          ),
        ],
      ),
    );
  }
}

// ======================================================
// SHARED POST PREVIEW CARD (INSIDE CHAT BUBBLE)
// ======================================================

class _SharedPostPreview extends StatelessWidget {
  final Map<String, dynamic> post;
  final bool isMine;

  const _SharedPostPreview({
    required this.post,
    required this.isMine,
  });

  Color _parsePostColor(dynamic colorValue) {
    if (colorValue == null) return const Color(0xFF6366F1);
    if (colorValue is int) return Color(colorValue);
    final str = colorValue.toString().trim();
    if (str.startsWith('#')) {
      final hex = str.replaceFirst('#', '');
      if (hex.length == 6) {
        return Color(int.parse('FF$hex', radix: 16));
      }
    }
    return const Color(0xFF6366F1);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final imageUrl = post['imageUrl']?.toString();
    final title = post['title']?.toString() ?? '';
    final body = post['content']?.toString() ?? '';
    final author = post['author'] as Map?;
    final authorUsername = (author?['username'] ?? author?['name'] ?? 'user').toString();
    final authorPic = author?['profileImageUrl']?.toString();
    final bgColor = post['backgroundColor'];

    return InkWell(
      onTap: () {
        MessageNavigationCallbacks.onOpenPost?.call(context, post);
      },
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF111827) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.08),
            width: 0.8,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top author header
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundImage: authorPic != null && authorPic.isNotEmpty
                        ? NetworkImage(authorPic)
                        : null,
                    backgroundColor: const Color(0xFF6366F1).withValues(alpha: 0.2),
                    child: authorPic == null || authorPic.isEmpty
                        ? Text(
                            authorUsername.isNotEmpty ? authorUsername[0].toUpperCase() : 'U',
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                          )
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '@$authorUsername',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6366F1).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'Post',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF6366F1),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Post image or color background
            if (imageUrl != null && imageUrl.isNotEmpty)
              Image.network(
                imageUrl,
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  height: 90,
                  color: isDark ? Colors.grey[800] : Colors.grey[200],
                  child: const Center(
                    child: Icon(Icons.broken_image_outlined, size: 30, color: Colors.grey),
                  ),
                ),
              )
            else if (bgColor != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 22),
                decoration: BoxDecoration(color: _parsePostColor(bgColor)),
                child: Center(
                  child: Text(
                    body.isNotEmpty ? body : title,
                    textAlign: TextAlign.center,
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ),
              ),

            // Post title, content snippet & View Post link
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title.isNotEmpty && (imageUrl != null || bgColor == null))
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13.5,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  if (body.isNotEmpty && body != title && imageUrl != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    children: const [
                      Text(
                        'View post',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF6366F1),
                        ),
                      ),
                      SizedBox(width: 4),
                      Icon(
                        Icons.open_in_new_rounded,
                        size: 13,
                        color: Color(0xFF6366F1),
                      ),
                    ],
                  ),
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
// REUSABLE AVATAR WIDGET
// ======================================================

class _Avatar extends StatelessWidget {
  final String? url;
  final String name;
  final bool isSelf;
  final double radius;

  const _Avatar({
    this.url,
    required this.name,
    this.isSelf = false,
    this.radius = 24,
  });

  @override
  Widget build(BuildContext context) {
    final first = name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'U';

    if (isSelf) {
      return Container(
        padding: const EdgeInsets.all(2),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF6366F1), Color(0xFF8B5CF6), Color(0xFFEC4899)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          shape: BoxShape.circle,
        ),
        child: CircleAvatar(
          radius: radius,
          backgroundColor: const Color(0xFF4F46E5),
          backgroundImage: url != null && url!.isNotEmpty ? NetworkImage(url!) : null,
          child: url == null || url!.isEmpty
              ? const Icon(Icons.bookmark_rounded, color: Colors.white, size: 22)
              : null,
        ),
      );
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFF6366F1).withValues(alpha: 0.15),
      backgroundImage: url != null && url!.isNotEmpty ? NetworkImage(url!) : null,
      child: url == null || url!.isEmpty
          ? Text(
              first,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: radius * 0.75,
                color: const Color(0xFF6366F1),
              ),
            )
          : null,
    );
  }
}
