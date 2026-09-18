import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter/foundation.dart';

const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000',
);

class MessagesPage extends StatefulWidget {
  const MessagesPage({super.key});
  @override
  State<MessagesPage> createState() => _MessagesPageState();
}

class _MessagesPageState extends State<MessagesPage> {
  List<Map<String, dynamic>> conversations = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    loadConversations();
  }

  Future<String?> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  Future<void> loadConversations() async {
    setState(() { loading = true; error = null; });
    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('Please log in again.');
      final response = await http.get(
        Uri.parse('$apiBaseUrl/messages/conversations'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode != 200) {
        throw Exception('Failed to load messages (${response.statusCode})');
      }
      final data = jsonDecode(response.body);
      setState(() {
        conversations = data is List
            ? data.map((e) => Map<String, dynamic>.from(e as Map)).toList()
            : [];
      });
    } catch (e) {
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> openConversation(Map<String, dynamic> user) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ChatPage(
          userId: user['id'] as int,
          username: (user['username'] ?? user['name'] ?? 'User').toString(),
          profileImageUrl: user['profileImageUrl']?.toString(),
        ),
      ),
    );
    loadConversations();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          IconButton(onPressed: loadConversations, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: loadConversations,
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : error != null
                ? ListView(children: [
                    const SizedBox(height: 180),
                    Center(child: Text(error!)),
                    const SizedBox(height: 12),
                    Center(child: ElevatedButton(onPressed: loadConversations, child: const Text('Retry'))),
                  ])
                : conversations.isEmpty
                    ? ListView(children: const [
                        SizedBox(height: 180),
                        Icon(Icons.chat_bubble_outline_rounded, size: 64),
                        SizedBox(height: 16),
                        Center(child: Text('No conversations yet', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600))),
                        SizedBox(height: 6),
                        Center(child: Text('Follow someone and start a conversation.')),
                      ])
                    : ListView.separated(
                        itemCount: conversations.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final item = conversations[index];
                          final user = Map<String, dynamic>.from(item['user'] as Map);
                          final last = Map<String, dynamic>.from(item['lastMessage'] as Map);
                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            leading: _Avatar(
                              url: user['profileImageUrl']?.toString(),
                              name: (user['username'] ?? user['name'] ?? 'U').toString(),
                            ),
                            title: Text(
                              (user['username'] ?? user['name'] ?? 'User').toString(),
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            subtitle: Text(last['content']?.toString() ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                            trailing: const Icon(Icons.chevron_right_rounded, color: Colors.grey),
                            onTap: () => openConversation(user),
                          );
                        },
                      ),
      ),
    );
  }
}

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
  List<Map<String, dynamic>> messages = [];
  int? currentUserId;
  bool loading = true;
  bool sending = false;
  bool _sharedPostPending = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _sharedPostPending = widget.sharedPost != null;
    load();
  }

  @override
  void dispose() {
    controller.dispose();
    scrollController.dispose();
    super.dispose();
  }

  Future<String?> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  Future<void> load() async {
    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('Please log in again.');

      final responses = await Future.wait([
        http.get(Uri.parse('$apiBaseUrl/messages/${widget.userId}'), headers: {'Authorization': 'Bearer $token'}),
        http.get(Uri.parse('$apiBaseUrl/users/me'), headers: {'Authorization': 'Bearer $token'}),
      ]);

      if (responses[0].statusCode != 200 || responses[1].statusCode != 200) {
        throw Exception('Failed to load conversation.');
      }

      final messageData = jsonDecode(responses[0].body);
      final meData = jsonDecode(responses[1].body);

      if (!mounted) return;
      setState(() {
        messages = messageData is List
            ? messageData.map((e) => Map<String, dynamic>.from(e as Map)).toList()
            : [];
        currentUserId = int.tryParse(meData['id'].toString());
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

  Future<void> sendMessage() async {
    final content = controller.text.trim();
    if (content.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      final token = await _token();
      if (token == null || token.isEmpty) throw Exception('Please log in again.');

      final response = await http.post(
        Uri.parse('$apiBaseUrl/messages/${widget.userId}'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({
          'content': !_sharedPostPending
              ? content
              : jsonEncode({
                  '__sharedPost__': true,
                  'text': content,
                  'post': widget.sharedPost,
                }),
        }),
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        String message = 'Failed to send message.';
        try {
          final data = jsonDecode(response.body);
          if (data['message'] != null) message = data['message'].toString();
        } catch (_) {}
        throw Exception(message);
      }

      controller.clear();
      if (mounted) setState(() => _sharedPostPending = false);
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(children: [
          _Avatar(url: widget.profileImageUrl, name: widget.username),
          const SizedBox(width: 10),
          Text(widget.username),
        ]),
      ),
      body: Column(
        children: [
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                    ? Center(child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Padding(padding: const EdgeInsets.all(20), child: Text(error!, textAlign: TextAlign.center)),
                          ElevatedButton(onPressed: () { setState(() => loading = true); load(); }, child: const Text('Retry')),
                        ],
                      ))
                    : messages.isEmpty
                        ? const Center(child: Text('Say hi 👋'))
                        : ListView.builder(
                            controller: scrollController,
                            padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
                            itemCount: messages.length,
                            itemBuilder: (context, index) {
                              final message = messages[index];
                              final isMine = currentUserId != null &&
                                  message['senderId'].toString() == currentUserId.toString();
                              final rawContent = message['content']?.toString() ?? '';
                              Map<String, dynamic>? sharedPost;
                              String displayText = rawContent;

                              try {
                                final decoded = jsonDecode(rawContent);
                                if (decoded is Map && decoded['__sharedPost__'] == true) {
                                  sharedPost = Map<String, dynamic>.from(decoded['post'] as Map);
                                  displayText = decoded['text']?.toString() ?? '';
                                }
                              } catch (_) {}

                              return Align(
                                alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
                                child: Container(
                                  constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: isMine
                                        ? Theme.of(context).colorScheme.primary
                                        : Theme.of(context).colorScheme.surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(18),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (sharedPost != null) ...[
                                        _SharedPostPreview(post: sharedPost),
                                        if (displayText.isNotEmpty) const SizedBox(height: 8),
                                      ],
                                      if (displayText.isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          child: Text(
                                            displayText,
                                            style: TextStyle(
                                              color: isMine
                                                  ? Theme.of(context).colorScheme.onPrimary
                                                  : Theme.of(context).colorScheme.onSurface,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 4,
                    decoration: const InputDecoration(hintText: 'Message...'),
                    onSubmitted: (_) => sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: sending ? null : sendMessage,
                  icon: sending
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.send_rounded),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _SharedPostPreview extends StatelessWidget {
  final Map<String, dynamic> post;

  const _SharedPostPreview({required this.post});

  @override
  Widget build(BuildContext context) {
    final imageUrl = post['imageUrl']?.toString();
    final title = post['title']?.toString() ?? '';
    final body = post['content']?.toString() ?? '';
    final author = post['author'] as Map?;
    final authorName = author?['username']?.toString() ??
        author?['name']?.toString() ??
        'Post';

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (imageUrl != null && imageUrl.isNotEmpty)
            Image.network(
              imageUrl,
              height: 170,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                height: 100,
                color: Colors.grey.shade300,
                child: const Center(child: Icon(Icons.broken_image_outlined)),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(authorName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                const SizedBox(height: 4),
                Text(
                  title.isNotEmpty ? title : body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                if (title.isNotEmpty && body.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(body, maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String? url;
  final String name;
  const _Avatar({this.url, required this.name});

  @override
  Widget build(BuildContext context) {
    final first = name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'U';
    return CircleAvatar(
      radius: 23,
      backgroundImage: url != null && url!.isNotEmpty ? NetworkImage(url!) : null,
      child: url == null || url!.isEmpty
          ? Text(first, style: const TextStyle(fontWeight: FontWeight.bold))
          : null,
    );
  }
}
