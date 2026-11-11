import 'package:flutter/material.dart';

import 'api.dart';
import 'main.dart' show PostDetailPage, formatTimeAgo;
import 'messages_page.dart' show ChatPage;
import 'people_pages.dart';
import 'social_widgets.dart';

const _filters = <(String, String)>[
  ('all', 'All'),
  ('unread', 'Unread'),
  ('requests', 'Requests'),
  ('like', 'Likes'),
  ('comment', 'Comments'),
  ('mention', 'Mentions'),
  ('follow', 'Follows'),
  ('message', 'Messages'),
];

const _filterOf = {
  'like': 'like',
  'repost': 'like',
  'comment': 'comment',
  'mention': 'mention',
  'follow': 'follow',
  'follow_request': 'follow',
  'follow_accept': 'follow',
  'message': 'message',
};

(IconData, Color) _typeIcon(String type) => switch (type) {
      'like' => (Icons.favorite_rounded, const Color(0xFFEF4444)),
      'repost' => (Icons.repeat_rounded, const Color(0xFF10B981)),
      'comment' => (Icons.mode_comment_rounded, const Color(0xFF3B82F6)),
      'mention' => (Icons.alternate_email_rounded, const Color(0xFFF59E0B)),
      'follow' || 'follow_request' || 'follow_accept' => (Icons.person_rounded, const Color(0xFF8B5CF6)),
      'message' => (Icons.chat_bubble_rounded, const Color(0xFF10B981)),
      _ => (Icons.notifications_rounded, Colors.grey),
    };

String _group(String? createdAt) {
  final d = DateTime.tryParse(createdAt ?? '')?.toLocal();
  if (d == null) return 'Earlier';
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  if (!d.isBefore(today)) return 'Today';
  if (!d.isBefore(today.subtract(const Duration(days: 1)))) return 'Yesterday';
  if (!d.isBefore(today.subtract(const Duration(days: 6)))) return 'This week';
  return 'Earlier';
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<Map<String, dynamic>> items = [];
  List<Map<String, dynamic>> requests = [];
  bool loading = true;
  String? error;
  String filter = 'all';
  final Set<int> busy = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([Api.get('/notifications'), Api.get('/follows/requests')]);
    if (!mounted) return;
    final res = results[0];
    setState(() {
      loading = false;
      if (res.ok && res.data is List) {
        items = (res.data as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        error = null;
      } else {
        error = res.message("Couldn't load your activity");
      }
      requests = results[1].ok && results[1].data is List
          ? (results[1].data as List).map((e) => Map<String, dynamic>.from(e as Map)).toList()
          : [];
    });
    // Opening Activity marks activity (not messages) as seen.
    final unreadTypes = items.where((n) => n['isRead'] != true && n['type'] != 'message').map((n) => n['type']).toSet();
    if (unreadTypes.isNotEmpty) {
      UnreadCounter.clearActivity();
      await Future.wait(unreadTypes.map((t) => Api.patch('/notifications/read-all?type=$t')));
      UnreadCounter.refresh();
    }
  }

  Future<void> _open(Map<String, dynamic> n) async {
    if (n['isRead'] != true) {
      setState(() => n['isRead'] = true);
      Api.patch('/notifications/${n['id']}/read');
    }
    final type = n['type']?.toString() ?? '';
    final actor = n['actor'] is Map ? Map<String, dynamic>.from(n['actor']) : null;
    final actorId = n['actorId'] as int?;
    final postId = n['postId'] as int?;

    if (type == 'message' && actorId != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ChatPage(
            userId: actorId,
            username: (actor?['username'] ?? 'user').toString(),
            profileImageUrl: actor?['profileImageUrl']?.toString(),
          ),
        ),
      );
    } else if (postId != null && ['like', 'comment', 'mention', 'repost'].contains(type)) {
      final res = await Api.get('/posts/$postId');
      if (!mounted) return;
      if (res.ok && res.data is Map) {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => PostDetailPage(post: Map<String, dynamic>.from(res.data as Map))),
        );
      } else {
        showSnack(context, 'This post is no longer available', error: true);
      }
    } else if (type == 'follow_request') {
      setState(() => filter = 'requests');
    } else if (actorId != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => UserProfilePage(userId: actorId, userName: (actor?['username'] ?? 'user').toString()),
        ),
      );
    }
  }

  Future<void> _respond(Map<String, dynamic> request, bool approve) async {
    final user = Map<String, dynamic>.from(request['user'] as Map);
    final id = user['id'] as int;
    setState(() => busy.add(id));
    final res = await Api.post('/follows/requests/$id/${approve ? 'approve' : 'decline'}');
    if (!mounted) return;
    setState(() => busy.remove(id));
    if (res.ok) {
      setState(() {
        requests.remove(request);
        items.removeWhere((n) => n['type'] == 'follow_request' && n['actorId'] == id);
      });
      showSnack(context, approve ? '@${user['username']} can now see your posts' : 'Request removed');
    } else {
      showSnack(context, res.message("Couldn't update the request"), error: true);
    }
  }

  Future<void> _markAll() async {
    setState(() {
      for (final n in items) {
        n['isRead'] = true;
      }
    });
    await Api.patch('/notifications/read-all');
    UnreadCounter.clearActivity();
  }

  Future<void> _clearAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear all notifications?'),
        content: const Text("This permanently removes every notification."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Clear all')),
        ],
      ),
    );
    if (ok != true) return;
    final res = await Api.delete('/notifications');
    if (!mounted) return;
    if (res.ok) {
      setState(() => items.clear());
      UnreadCounter.clearActivity();
    } else {
      showSnack(context, res.message("Couldn't clear notifications"), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final listed = items.where((n) => n['type'] != 'follow_request').toList();
    final filtered = listed.where((n) {
      if (filter == 'all') return true;
      if (filter == 'unread') return n['isRead'] != true;
      if (filter == 'requests') return false;
      return _filterOf[n['type']] == filter;
    }).toList();
    final showRequests = (filter == 'all' || filter == 'requests') && requests.isNotEmpty;
    final unread = listed.where((n) => n['isRead'] != true).length;

    int countFor(String key) => switch (key) {
          'all' => listed.length,
          'unread' => unread,
          'requests' => requests.length,
          _ => listed.where((n) => _filterOf[n['type']] == key).length,
        };

    final children = <Widget>[
      SizedBox(
        height: 52,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          children: [
            for (final f in _filters)
              if (f.$1 != 'requests' || requests.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(countFor(f.$1) > 0 ? '${f.$2} ${countFor(f.$1)}' : f.$2),
                    selected: filter == f.$1,
                    onSelected: (_) => setState(() => filter = f.$1),
                    showCheckmark: false,
                    selectedColor: isDark ? Colors.white : Colors.black,
                    labelStyle: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: filter == f.$1
                          ? (isDark ? Colors.black : Colors.white)
                          : (isDark ? Colors.white : Colors.black),
                    ),
                    shape: const StadiumBorder(),
                  ),
                ),
          ],
        ),
      ),
    ];

    if (showRequests) {
      children.add(_sectionTitle('Follow requests · ${requests.length}'));
      for (final r in requests) {
        final u = Map<String, dynamic>.from(r['user'] as Map);
        final id = u['id'] as int;
        const compact = ButtonStyle(
          visualDensity: VisualDensity.compact,
          padding: WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 12)),
          minimumSize: WidgetStatePropertyAll(Size(0, 34)),
        );
        children.add(InkWell(
          onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                  builder: (_) => UserProfilePage(userId: id, userName: (u['username'] ?? 'user').toString()))),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(children: [
              UserAvatar(url: u['profileImageUrl']?.toString(), name: u['username']?.toString()),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text((u['username'] ?? 'user').toString(),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text('Requested ${formatTimeAgo(r['requestedAt'])}',
                      maxLines: 1, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ]),
              ),
              FilledButton(
                  style: compact, onPressed: busy.contains(id) ? null : () => _respond(r, true), child: const Text('Confirm')),
              const SizedBox(width: 6),
              OutlinedButton(
                  style: compact, onPressed: busy.contains(id) ? null : () => _respond(r, false), child: const Text('Delete')),
            ]),
          ),
        ));
      }
    }

    if (filter == 'requests' && requests.isEmpty) {
      children.add(_empty(Icons.check_circle_outline, 'No pending requests'));
    } else if (filter != 'requests') {
      if (filtered.isEmpty && !showRequests) {
        children.add(_empty(
          filter == 'unread' ? Icons.done_all_rounded : Icons.favorite_border_rounded,
          filter == 'unread'
              ? "You're all caught up"
              : 'When people like, comment on, mention or follow you, you\'ll see it here.',
        ));
      }
      String? lastGroup;
      for (final n in filtered) {
        final g = _group(n['createdAt']?.toString());
        if (g != lastGroup) {
          children.add(_sectionTitle(g));
          lastGroup = g;
        }
        children.add(_tile(n, isDark));
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Activity', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          if (unread > 0) IconButton(tooltip: 'Mark all read', onPressed: _markAll, icon: const Icon(Icons.done_all_rounded)),
          if (items.isNotEmpty)
            IconButton(tooltip: 'Clear all', onPressed: _clearAll, icon: const Icon(Icons.delete_sweep_outlined)),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null && items.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(error!, style: const TextStyle(color: Colors.grey)),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _load, child: const Text('Retry')),
                  ]),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(physics: const AlwaysScrollableScrollPhysics(), children: children),
                ),
    );
  }

  Widget _sectionTitle(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
        child: Text(text.toUpperCase(),
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: Colors.grey)),
      );

  Widget _empty(IconData icon, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 90, horizontal: 32),
        child: Column(children: [
          Icon(icon, size: 56, color: Colors.grey.withValues(alpha: 0.6)),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey, fontSize: 15)),
        ]),
      );

  Widget _tile(Map<String, dynamic> n, bool isDark) {
    final type = n['type']?.toString() ?? '';
    final (icon, color) = _typeIcon(type);
    final actor = n['actor'] is Map ? Map<String, dynamic>.from(n['actor']) : null;
    final unread = n['isRead'] != true;
    final message = n['message']?.toString() ?? '';
    final match = RegExp(r'^(.+?) (liked|commented|started following|sent you|requested|accepted|mentioned|reposted)(.*)$')
        .firstMatch(message);

    return Dismissible(
      key: ValueKey('n-${n['id']}'),
      direction: DismissDirection.endToStart,
      background: Container(
        color: Colors.redAccent,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 22),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      onDismissed: (_) async {
        setState(() => items.remove(n));
        final res = await Api.delete('/notifications/${n['id']}');
        if (!res.ok && mounted) {
          setState(() => items.add(n));
          showSnack(context, res.message("Couldn't remove notification"), error: true);
        }
      },
      child: Container(
        color: unread ? (isDark ? const Color(0xFF1E1418) : const Color(0xFFFFF4F6)) : null,
        child: ListTile(
          onTap: () => _open(n),
          leading: SizedBox(
            width: 48,
            height: 48,
            child: Stack(clipBehavior: Clip.none, children: [
              actor != null
                  ? UserAvatar(url: actor['profileImageUrl']?.toString(), name: actor['username']?.toString(), size: 46)
                  : CircleAvatar(
                      radius: 23,
                      backgroundColor: color.withValues(alpha: 0.14),
                      child: Icon(icon, color: color, size: 22),
                    ),
              if (actor != null)
                Positioned(
                  right: -3,
                  bottom: -3,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                      border: Border.all(color: Theme.of(context).scaffoldBackgroundColor, width: 2),
                    ),
                    child: Icon(icon, size: 11, color: Colors.white),
                  ),
                ),
            ]),
          ),
          title: match == null
              ? Text(message)
              : Text.rich(TextSpan(children: [
                  TextSpan(text: match.group(1), style: const TextStyle(fontWeight: FontWeight.w700)),
                  TextSpan(text: ' ${match.group(2)}${match.group(3)}'),
                ])),
          subtitle: Text(formatTimeAgo(n['createdAt']), style: const TextStyle(fontSize: 12)),
          trailing: unread
              ? Container(width: 9, height: 9, decoration: const BoxDecoration(color: Color(0xFFD94D6A), shape: BoxShape.circle))
              : null,
        ),
      ),
    );
  }
}
