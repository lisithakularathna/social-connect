import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'main.dart' show PostCard, PostDetailPage;
import 'messages_page.dart' show ChatPage;
import 'social_widgets.dart';

// ======================================================
// OTHER USER'S PROFILE
// ======================================================

class UserProfilePage extends StatefulWidget {
  final int userId;
  final String userName;

  const UserProfilePage({super.key, required this.userId, required this.userName});

  @override
  State<UserProfilePage> createState() => _UserProfilePageState();
}

class _UserProfilePageState extends State<UserProfilePage> {
  Map<String, dynamic>? profile;
  List<dynamic> posts = [];
  bool loading = true;
  String? error;
  bool showReposts = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([
      Api.get('/users/${widget.userId}'),
      Api.get('/posts/user/${widget.userId}'),
    ]);
    if (!mounted) return;
    final p = results[0];
    final list = results[1];
    setState(() {
      loading = false;
      if (p.ok && p.data is Map) {
        profile = Map<String, dynamic>.from(p.data as Map);
        error = null;
      } else {
        profile = null;
        error = p.status == 404 ? 'This account isn\'t available.' : p.message('Failed to load profile');
      }
      posts = list.ok && list.data is List ? list.data as List : [];
    });
  }

  bool get _blocked => profile?['isBlocked'] == true;
  bool get _canView => profile?['canViewContent'] != false;

  Future<void> _toggleMute() async {
    final muted = profile?['isMuted'] == true;
    final res = muted
        ? await Api.delete('/users/${widget.userId}/mute')
        : await Api.post('/users/${widget.userId}/mute');
    if (!mounted) return;
    if (res.ok) {
      setState(() => profile?['isMuted'] = !muted);
      showSnack(context, muted ? 'Unmuted' : 'Muted — their posts are hidden from your feed');
    } else {
      showSnack(context, res.message("Couldn't update mute"), error: true);
    }
  }

  Future<void> _toggleBlock() async {
    if (!_blocked) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Block @${profile?['username'] ?? widget.userName}?'),
          content: const Text(
              "They won't be able to find your profile, see your posts or message you. They won't be notified."),
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
    final res = _blocked
        ? await Api.delete('/users/${widget.userId}/block')
        : await Api.post('/users/${widget.userId}/block');
    if (!mounted) return;
    if (res.ok) {
      showSnack(context, _blocked ? 'Unblocked' : 'Blocked');
      _load();
    } else {
      showSnack(context, res.message("Couldn't update block"), error: true);
    }
  }

  void _menu() {
    final username = profile?['username'] ?? widget.userName;
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.link_rounded),
            title: const Text('Copy profile link'),
            onTap: () {
              Navigator.pop(ctx);
              Clipboard.setData(ClipboardData(text: '$webAppUrl/u/$username'));
              showSnack(context, 'Profile link copied');
            },
          ),
          if (!_blocked)
            ListTile(
              leading: Icon(profile?['isMuted'] == true ? Icons.volume_up_outlined : Icons.volume_off_outlined),
              title: Text(profile?['isMuted'] == true ? 'Unmute @$username' : 'Mute @$username'),
              onTap: () {
                Navigator.pop(ctx);
                _toggleMute();
              },
            ),
          ListTile(
            leading: Icon(_blocked ? Icons.check_circle_outline : Icons.block, color: Colors.redAccent),
            title: Text(_blocked ? 'Unblock @$username' : 'Block @$username',
                style: const TextStyle(color: Colors.redAccent)),
            onTap: () {
              Navigator.pop(ctx);
              _toggleBlock();
            },
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final p = profile;
    final username = (p?['username'] ?? widget.userName).toString();
    final name = (p?['name'] ?? '').toString();
    final presence = presenceLabel(p);
    final ownPosts = posts.where((x) => x is Map && x['isRepost'] != true).toList();
    final reposts = posts.where((x) => x is Map && x['isRepost'] == true).toList();
    final shown = showReposts ? reposts : ownPosts;
    final cardColor = isDark ? const Color(0xFF161616) : const Color(0xFFF7F7F5);
    final borderColor = isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE7E7E2);

    return Scaffold(
      appBar: AppBar(
        title: Text(username, style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [if (p != null) IconButton(onPressed: _menu, icon: const Icon(Icons.more_horiz))],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : p == null
              ? _Empty(icon: Icons.person_off_outlined, title: error ?? 'User not found')
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      Row(children: [
                        UserAvatar(url: p['profileImageUrl']?.toString(), name: username, size: 84),
                        const SizedBox(width: 18),
                        Expanded(
                          child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                            _Stat(
                                value: _canView ? ownPosts.length : (p['postsCount'] ?? 0),
                                label: 'Posts'),
                            _Stat(
                              value: p['followersCount'] ?? 0,
                              label: 'Followers',
                              onTap: _canView
                                  ? () => Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                          builder: (_) => UserListPage(
                                              userId: widget.userId, title: 'Followers', endpoint: 'followers')))
                                  : null,
                            ),
                            _Stat(
                              value: p['followingCount'] ?? 0,
                              label: 'Following',
                              onTap: _canView
                                  ? () => Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                          builder: (_) => UserListPage(
                                              userId: widget.userId, title: 'Following', endpoint: 'following')))
                                  : null,
                            ),
                          ]),
                        ),
                      ]),
                      const SizedBox(height: 14),
                      Row(children: [
                        Flexible(
                          child: Text(name.isEmpty ? username : name,
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        ),
                        if (p['isPrivate'] == true) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.lock_outline, size: 16, color: Colors.grey),
                        ],
                      ]),
                      if ((p['bio'] ?? '').toString().isNotEmpty) ...[
                        const SizedBox(height: 4),
                        RichTextView(p['bio'].toString(), style: theme.textTheme.bodyMedium),
                      ],
                      const SizedBox(height: 8),
                      Wrap(spacing: 8, runSpacing: 6, children: [
                        if (presence != null)
                          _Pill(
                            icon: Icons.circle,
                            iconColor: p['isOnline'] == true ? const Color(0xFF16A34A) : Colors.grey,
                            label: presence,
                          ),
                        if (p['followsYou'] == true) const _Pill(label: 'Follows you'),
                      ]),
                      const SizedBox(height: 14),
                      if (!_blocked)
                        Row(children: [
                          Expanded(
                            child: FollowButton(
                              key: ValueKey('follow-${p['isFollowing']}-${p['isRequested']}'),
                              userId: widget.userId,
                              initialFollowing: p['isFollowing'] == true,
                              initialRequested: p['isRequested'] == true,
                              followsYou: p['followsYou'] == true,
                              compact: false,
                              onChanged: (_) => _load(),
                            ),
                          ),
                          if (p['canMessage'] != false) ...[
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onPressed: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => ChatPage(
                                      userId: widget.userId,
                                      username: username,
                                      profileImageUrl: p['profileImageUrl']?.toString(),
                                    ),
                                  ),
                                ),
                                icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
                                label: const Text('Message', style: TextStyle(fontWeight: FontWeight.w700)),
                              ),
                            ),
                          ],
                        ]),
                      const SizedBox(height: 18),
                      if (_blocked)
                        _Notice(
                          color: cardColor,
                          border: borderColor,
                          icon: Icons.block,
                          title: 'You blocked this account',
                          body: 'Unblock @$username from the ⋯ menu to see their posts.',
                        )
                      else if (!_canView)
                        _Notice(
                          color: cardColor,
                          border: borderColor,
                          icon: Icons.lock_outline,
                          title: 'This account is private',
                          body: p['isRequested'] == true
                              ? "Your follow request is pending. You'll see their posts once they accept."
                              : 'Follow @$username to see their photos and posts.',
                        )
                      else ...[
                        SegmentedButton<bool>(
                          segments: [
                            ButtonSegment(
                                value: false,
                                icon: const Icon(Icons.grid_on_rounded, size: 18),
                                label: Text('Posts ${ownPosts.length}')),
                            ButtonSegment(
                                value: true,
                                icon: const Icon(Icons.repeat_rounded, size: 18),
                                label: Text('Reposts ${reposts.length}')),
                          ],
                          selected: {showReposts},
                          showSelectedIcon: false,
                          onSelectionChanged: (s) => setState(() => showReposts = s.first),
                        ),
                        const SizedBox(height: 12),
                        if (shown.isEmpty)
                          _Empty(
                            icon: showReposts ? Icons.repeat_rounded : Icons.photo_library_outlined,
                            title: showReposts ? 'No reposts yet' : 'No posts yet',
                            compact: true,
                          )
                        else
                          GridView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: shown.length,
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3, crossAxisSpacing: 3, mainAxisSpacing: 3),
                            itemBuilder: (context, i) {
                              final post = Map<String, dynamic>.from(shown[i] as Map);
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: PostGridTile(
                                  post: post,
                                  onTap: () async {
                                    await Navigator.push(context,
                                        MaterialPageRoute(builder: (_) => PostDetailPage(post: post)));
                                    _load();
                                  },
                                ),
                              );
                            },
                          ),
                      ],
                    ],
                  ),
                ),
    );
  }
}

class _Stat extends StatelessWidget {
  final dynamic value;
  final String label;
  final VoidCallback? onTap;

  const _Stat({required this.value, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        child: Column(children: [
          Text('$value', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 12.5, color: Colors.grey)),
        ]),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final IconData? icon;
  final Color? iconColor;
  final String label;

  const _Pill({this.icon, this.iconColor, required this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1F1F1F) : const Color(0xFFF1F1EE),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 9, color: iconColor), const SizedBox(width: 6)],
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

class _Notice extends StatelessWidget {
  final Color color;
  final Color border;
  final IconData icon;
  final String title;
  final String body;

  const _Notice({required this.color, required this.border, required this.icon, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
      decoration: BoxDecoration(
        color: color,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(children: [
        Icon(icon, size: 40, color: Colors.grey),
        const SizedBox(height: 10),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 6),
        Text(body, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
      ]),
    );
  }
}

class _Empty extends StatelessWidget {
  final IconData icon;
  final String title;
  final bool compact;

  const _Empty({required this.icon, required this.title, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: compact ? 36 : 120, horizontal: 24),
      child: Column(children: [
        Icon(icon, size: 54, color: Colors.grey.withValues(alpha: 0.6)),
        const SizedBox(height: 10),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey, fontSize: 15)),
      ]),
    );
  }
}

// ======================================================
// FOLLOWERS / FOLLOWING
// ======================================================

class UserListPage extends StatefulWidget {
  final int userId;
  final String title;
  final String endpoint; // 'followers' or 'following'

  const UserListPage({super.key, required this.userId, required this.title, required this.endpoint});

  @override
  State<UserListPage> createState() => _UserListPageState();
}

class _UserListPageState extends State<UserListPage> {
  List<dynamic> users = [];
  bool loading = true;
  String? error;
  int? myId;
  String query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    myId ??= await Api.currentUserId();
    final res = await Api.get('/follows/${widget.endpoint}/${widget.userId}');
    if (!mounted) return;
    setState(() {
      loading = false;
      if (res.ok && res.data is List) {
        users = res.data as List;
        error = null;
      } else {
        users = [];
        error = res.status == 403
            ? 'This account is private. Follow them to see their connections.'
            : res.message('Failed to load');
      }
    });
  }

  Future<void> _removeFollower(Map user) async {
    final res = await Api.delete('/follows/followers/${user['id']}');
    if (!mounted) return;
    if (res.ok) {
      setState(() => users.remove(user));
      showSnack(context, 'Removed @${user['username']} from your followers');
    } else {
      showSnack(context, res.message("Couldn't remove follower"), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMine = myId != null && myId == widget.userId;
    final q = query.trim().toLowerCase();
    final visible = q.isEmpty
        ? users
        : users.where((u) {
            final m = u as Map;
            return (m['username'] ?? '').toString().toLowerCase().contains(q) ||
                (m['name'] ?? '').toString().toLowerCase().contains(q);
          }).toList();

    return Scaffold(
      appBar: AppBar(title: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w800))),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? _Empty(icon: Icons.lock_outline, title: error!)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 24),
                    children: [
                      if (users.length > 6)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                          child: TextField(
                            decoration: InputDecoration(
                              prefixIcon: const Icon(Icons.search),
                              hintText: 'Search ${widget.title.toLowerCase()}',
                              isDense: true,
                            ),
                            onChanged: (v) => setState(() => query = v),
                          ),
                        ),
                      if (visible.isEmpty)
                        _Empty(
                          icon: Icons.people_outline,
                          title: q.isNotEmpty
                              ? 'No matches'
                              : widget.endpoint == 'followers'
                                  ? 'No followers yet'
                                  : 'Not following anyone yet',
                        ),
                      ...visible.map((raw) {
                        final u = raw as Map;
                        final id = u['id'] as int;
                        final username = (u['username'] ?? 'user').toString();
                        return ListTile(
                          onTap: () {
                            if (id == myId) return;
                            Navigator.push(context,
                                MaterialPageRoute(builder: (_) => UserProfilePage(userId: id, userName: username)));
                          },
                          leading: UserAvatar(url: u['profileImageUrl']?.toString(), name: username, size: 46),
                          title: Row(children: [
                            Flexible(
                                child: Text(username,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.w700))),
                            if (u['isPrivate'] == true) ...[
                              const SizedBox(width: 4),
                              const Icon(Icons.lock_outline, size: 14, color: Colors.grey),
                            ],
                          ]),
                          subtitle: (u['name'] ?? '').toString().isEmpty
                              ? null
                              : Text(u['name'].toString(), overflow: TextOverflow.ellipsis),
                          trailing: id == myId
                              ? null
                              : Row(mainAxisSize: MainAxisSize.min, children: [
                                  if (isMine && widget.endpoint == 'followers')
                                    IconButton(
                                      tooltip: 'Remove follower',
                                      icon: const Icon(Icons.person_remove_outlined),
                                      onPressed: () => _removeFollower(u),
                                    ),
                                  FollowButton(
                                    userId: id,
                                    initialFollowing: u['isFollowing'] == true,
                                    initialRequested: u['isRequested'] == true,
                                  ),
                                ]),
                        );
                      }),
                    ],
                  ),
                ),
    );
  }
}

// ======================================================
// POST SEARCH (#hashtags and text)
// ======================================================

class PostSearchPage extends StatefulWidget {
  final String initialQuery;

  const PostSearchPage({super.key, this.initialQuery = ''});

  @override
  State<PostSearchPage> createState() => _PostSearchPageState();
}

class _PostSearchPageState extends State<PostSearchPage> {
  late final TextEditingController controller = TextEditingController(text: widget.initialQuery);
  List<dynamic> results = [];
  bool loading = false;
  bool searched = false;
  Timer? _debounce;
  int _seq = 0;

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery.trim().isNotEmpty) _search(widget.initialQuery);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    controller.dispose();
    super.dispose();
  }

  Future<void> _search(String value) async {
    final q = value.trim();
    final seq = ++_seq;
    if (q.length < 2) {
      setState(() {
        results = [];
        searched = false;
        loading = false;
      });
      return;
    }
    setState(() => loading = true);
    final res = await Api.get('/posts/search?q=${Uri.encodeQueryComponent(q)}');
    if (!mounted || seq != _seq) return;
    setState(() {
      loading = false;
      searched = true;
      results = res.ok && res.data is List ? res.data as List : [];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: controller,
          autofocus: widget.initialQuery.isEmpty,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(hintText: 'Search posts, #hashtags…', isDense: true),
          onChanged: (v) {
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 300), () => _search(v));
          },
          onSubmitted: _search,
        ),
        actions: const [SizedBox(width: 12)],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : results.isEmpty
              ? _Empty(
                  icon: Icons.search,
                  title: searched ? 'No posts match "${controller.text.trim()}"' : 'Search for posts or #hashtags',
                )
              : ListView.builder(
                  itemCount: results.length,
                  itemBuilder: (context, i) => PostCard(post: results[i]),
                ),
    );
  }
}
