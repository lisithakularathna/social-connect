import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'main.dart' show LoginPage, themeNotifier, setThemePreference;
import 'messages_page.dart' show apiBaseUrl;
import 'people_pages.dart';
import 'social_widgets.dart';

// ======================================================
// SHARED HELPERS
// ======================================================

Future<void> logoutUser(BuildContext context) async {
  UnreadCounter.stop();
  await Api.clearToken();
  if (!context.mounted) return;
  Navigator.pushAndRemoveUntil(
    context,
    MaterialPageRoute(builder: (_) => const LoginPage()),
    (route) => false,
  );
}

Future<void> deleteAccount(BuildContext context) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Delete account?'),
      content: const Text(
          'This permanently deletes your account, posts, likes, comments, messages and follows. This can\'t be undone.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
  if (ok != true) return;
  final res = await Api.delete('/users/me');
  if (!context.mounted) return;
  if (res.ok) {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    UnreadCounter.stop();
    if (!context.mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (route) => false,
    );
  } else {
    showSnack(context, res.message('Failed to delete account'), error: true);
  }
}

void openThemeSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    builder: (sheet) => ValueListenableBuilder<ThemeMode>(
      valueListenable: themeNotifier,
      builder: (c, mode, _) => SafeArea(
        child: RadioGroup<ThemeMode>(
          groupValue: mode,
          onChanged: (v) async {
            if (v == null) return;
            await setThemePreference(v);
            if (sheet.mounted) Navigator.pop(sheet);
          },
          child: const Column(mainAxisSize: MainAxisSize.min, children: [
            ListTile(
              title: Text('Appearance', style: TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text('Choose Light, Dark or match your phone'),
            ),
            RadioListTile<ThemeMode>(
                value: ThemeMode.light, title: Text('Light'), secondary: Icon(Icons.light_mode_outlined)),
            RadioListTile<ThemeMode>(
                value: ThemeMode.dark, title: Text('Dark'), secondary: Icon(Icons.dark_mode_outlined)),
            RadioListTile<ThemeMode>(
                value: ThemeMode.system, title: Text('System'), secondary: Icon(Icons.brightness_auto_outlined)),
          ]),
        ),
      ),
    ),
  );
}

/// Older app versions kept saved posts and block/mute lists only on the phone.
/// Upload them once so they sync with the web app, then drop local copies.
Future<void> migrateLocalDataOnce() async {
  final prefs = await SharedPreferences.getInstance();
  final me = await Api.currentUserId();
  if (me == null) return;
  final flag = 'sync_migrated_v1_$me';
  if (prefs.getBool(flag) == true) return;

  List<int> idsFrom(String key) {
    final raw = prefs.getStringList(key) ?? [];
    final ids = <int>[];
    for (final item in raw) {
      try {
        final decoded = jsonDecode(item);
        final id = decoded is Map ? decoded['id'] : decoded;
        final parsed = id is int ? id : int.tryParse(id.toString());
        if (parsed != null && parsed > 0) ids.add(parsed);
      } catch (_) {}
    }
    return ids;
  }

  final saved = idsFrom('savedPosts');
  final blocked = idsFrom('blockedUsers');
  final muted = idsFrom('mutedUsers');

  if (saved.isNotEmpty) {
    final r = await Api.post('/posts/saved/import', {'postIds': saved});
    if (!r.ok) return;
  }
  if (blocked.isNotEmpty || muted.isNotEmpty) {
    final r = await Api.post('/users/me/relations/import', {'blocked': blocked, 'muted': muted});
    if (!r.ok) return;
  }
  await prefs.remove('savedPosts');
  await prefs.remove('blockedUsers');
  await prefs.remove('mutedUsers');
  await prefs.setBool(flag, true);
}

Future<List<String>> loadHiddenWords() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getStringList('hiddenWords') ?? [];
}

bool containsHiddenWord(String? text, List<String> words) {
  if (text == null || words.isEmpty) return false;
  final lower = text.toLowerCase();
  return words.any((w) => lower.contains(w));
}

// ======================================================
// SETTINGS HUB
// ======================================================

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  Map<String, dynamic>? s;
  bool loading = true;
  String? error;
  int requestCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([Api.get('/users/me/settings'), Api.get('/follows/requests')]);
    if (!mounted) return;
    setState(() {
      loading = false;
      if (results[0].ok && results[0].data is Map) {
        s = Map<String, dynamic>.from(results[0].data as Map);
        error = null;
      } else {
        error = results[0].message('Could not load settings');
      }
      requestCount = results[1].ok && results[1].data is List ? (results[1].data as List).length : 0;
    });
  }

  Future<void> _update(String key, dynamic value) async {
    if (s == null) return;
    final previous = s![key];
    setState(() => s![key] = value);
    final res = await Api.patch('/users/me/settings', {key: value});
    if (!mounted) return;
    if (res.ok && res.data is Map) {
      setState(() => s = Map<String, dynamic>.from(res.data as Map));
      final approved = (res.data as Map)['approvedRequests'];
      if (approved is int && approved > 0) {
        setState(() => requestCount = 0);
        showSnack(context, '$approved pending follow request(s) approved');
      }
    } else {
      setState(() => s![key] = previous);
      showSnack(context, res.message("Couldn't save"), error: true);
    }
  }

  Future<void> _choose(String key, String title, List<(String, String, String)> options) async {
    final current = s?[key]?.toString();
    final picked = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: RadioGroup<String>(
          groupValue: current,
          onChanged: (v) => Navigator.pop(sheet, v),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            ListTile(title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800))),
            for (final o in options) RadioListTile<String>(value: o.$1, title: Text(o.$2), subtitle: Text(o.$3)),
          ]),
        ),
      ),
    );
    if (picked != null && picked != current) _update(key, picked);
  }

  Future<void> _logoutAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log out of other devices?'),
        content: const Text('Every other phone and browser signed in to your account will be signed out.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Log out others')),
        ],
      ),
    );
    if (ok != true) return;
    final res = await Api.post('/auth/logout-all');
    if (!mounted) return;
    if (res.ok && res.data is Map && res.data['accessToken'] != null) {
      await Api.saveToken(res.data['accessToken'].toString());
      if (mounted) showSnack(context, 'Signed out of all other devices');
    } else {
      showSnack(context, res.message("Couldn't sign out other devices"), error: true);
    }
  }

  Future<void> _exportData() async {
    showSnack(context, 'Preparing your data…');
    final res = await Api.get('/users/me/export');
    if (!mounted) return;
    if (!res.ok || res.data is! Map) {
      showSnack(context, res.message("Couldn't export your data"), error: true);
      return;
    }
    final data = res.data as Map;
    final json = const JsonEncoder.withIndent('  ').convert(data);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Your data'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Posts: ${(data['posts'] as List?)?.length ?? 0}'),
          Text('Comments: ${(data['comments'] as List?)?.length ?? 0}'),
          Text('Liked posts: ${(data['likedPostIds'] as List?)?.length ?? 0}'),
          Text('Saved posts: ${(data['savedPostIds'] as List?)?.length ?? 0}'),
          Text('Following: ${(data['following'] as List?)?.length ?? 0} · Followers: ${(data['followers'] as List?)?.length ?? 0}'),
          const SizedBox(height: 10),
          const Text('Copy the full export (JSON) to keep or paste somewhere safe.',
              style: TextStyle(color: Colors.grey, fontSize: 13)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
          FilledButton.icon(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: json));
              Navigator.pop(ctx);
              showSnack(context, 'Your data was copied to the clipboard');
            },
            icon: const Icon(Icons.copy_rounded, size: 18),
            label: const Text('Copy JSON'),
          ),
        ],
      ),
    );
  }

  Widget _header(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 6),
        child: Text(text.toUpperCase(),
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: Colors.grey)),
      );

  Widget _card(List<Widget> children) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151515) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: isDark ? const Color(0xFF262626) : const Color(0xFFEDEDE8)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        for (var i = 0; i < children.length; i++) ...[
          children[i],
          if (i < children.length - 1) const Divider(height: 1, indent: 56),
        ]
      ]),
    );
  }

  Widget _nav(IconData icon, String title, {String? subtitle, VoidCallback? onTap, Widget? trailing, Color? color}) =>
      ListTile(
        leading: Icon(icon, color: color),
        title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
        subtitle: subtitle == null ? null : Text(subtitle),
        trailing: trailing ?? (onTap == null ? null : const Icon(Icons.chevron_right_rounded)),
        onTap: onTap,
      );

  Widget _switch(IconData icon, String title, String subtitle, String key) => SwitchListTile(
        secondary: Icon(icon),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        value: s?[key] == true,
        onChanged: (v) => _update(key, v),
      );

  String _label(String? v, Map<String, String> labels) => labels[v] ?? labels.values.first;

  @override
  Widget build(BuildContext context) {
    final mode = themeNotifier.value;
    final themeName = mode == ThemeMode.dark ? 'Dark' : mode == ThemeMode.system ? 'System' : 'Light';

    return Scaffold(
      appBar: AppBar(title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.w800))),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : s == null
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(error ?? 'Could not load settings', style: const TextStyle(color: Colors.grey)),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _load, child: const Text('Retry')),
                  ]),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.only(bottom: 40), children: [
                    _header('Account'),
                    _card([
                      _nav(Icons.alternate_email_rounded, 'Email', subtitle: s!['email']?.toString(), onTap: () async {
                        final changed = await Navigator.push<String>(
                            context, MaterialPageRoute(builder: (_) => const ChangeEmailPage()));
                        if (changed != null) setState(() => s!['email'] = changed);
                      }),
                      _nav(Icons.link_rounded, 'Copy profile link', onTap: () async {
                        final me = await Api.get('/users/me');
                        if (!context.mounted) return;
                        Clipboard.setData(ClipboardData(text: '$webAppUrl/u/${me.data?['username'] ?? ''}'));
                        showSnack(context, 'Profile link copied');
                      }),
                    ]),
                    _header('Privacy'),
                    _card([
                      _switch(Icons.lock_outline, 'Private account',
                          s!['isPrivate'] == true ? 'Only approved followers see your posts' : 'Anyone can see your posts',
                          'isPrivate'),
                      if (s!['isPrivate'] == true)
                        _nav(Icons.person_add_alt_1_outlined, 'Follow requests',
                            subtitle: requestCount == 0 ? 'No pending requests' : '$requestCount waiting',
                            onTap: () async {
                          await Navigator.push(context, MaterialPageRoute(builder: (_) => const FollowRequestsPage()));
                          _load();
                        }),
                      _nav(Icons.chat_bubble_outline_rounded, 'Who can message you',
                          subtitle: _label(s!['messagePrivacy']?.toString(),
                              {'everyone': 'Everyone', 'followers': 'People who follow you', 'nobody': 'No one'}),
                          onTap: () => _choose('messagePrivacy', 'Who can message you', [
                                ('everyone', 'Everyone', 'Anyone can start a chat'),
                                ('followers', 'People who follow you', 'Only your followers'),
                                ('nobody', 'No one', 'Nobody can start a new chat'),
                              ])),
                      _nav(Icons.mode_comment_outlined, 'Who can comment',
                          subtitle: _label(s!['commentPrivacy']?.toString(),
                              {'everyone': 'Everyone', 'followers': 'Followers only', 'off': 'No one (comments off)'}),
                          onTap: () => _choose('commentPrivacy', 'Who can comment on your posts', [
                                ('everyone', 'Everyone', 'Anyone who can see the post'),
                                ('followers', 'Followers only', 'People who follow you'),
                                ('off', 'No one', 'Turn comments off'),
                              ])),
                      _switch(Icons.circle_outlined, 'Show activity status',
                          'Show when you were last active (and see others\')', 'showActivityStatus'),
                      _switch(Icons.favorite_border_rounded, 'Hide like counts',
                          'Others won\'t see how many likes your posts get', 'hideLikeCounts'),
                    ]),
                    _header('Safety'),
                    _card([
                      _nav(Icons.block, 'Blocked accounts',
                          onTap: () => Navigator.push(
                              context, MaterialPageRoute(builder: (_) => const RelationListPage(blocked: true)))),
                      _nav(Icons.volume_off_outlined, 'Muted accounts',
                          onTap: () => Navigator.push(
                              context, MaterialPageRoute(builder: (_) => const RelationListPage(blocked: false)))),
                      _nav(Icons.visibility_off_outlined, 'Hidden words',
                          subtitle: 'Hide posts & comments with these words',
                          onTap: () =>
                              Navigator.push(context, MaterialPageRoute(builder: (_) => const HiddenWordsPage()))),
                    ]),
                    _header('Notifications'),
                    _card([
                      _switch(Icons.favorite_outline, 'Likes & reposts', 'When someone likes or reposts your post',
                          'notifyLikes'),
                      _switch(Icons.mode_comment_outlined, 'Comments', 'When someone comments on your post',
                          'notifyComments'),
                      _switch(Icons.alternate_email_rounded, 'Mentions', 'When someone @mentions you', 'notifyMentions'),
                      _switch(Icons.person_add_alt_outlined, 'Followers', 'New followers and follow requests',
                          'notifyFollows'),
                      _switch(Icons.chat_bubble_outline_rounded, 'Messages', 'New direct messages', 'notifyMessages'),
                    ]),
                    _header('Appearance'),
                    _card([
                      _nav(Icons.brightness_6_outlined, 'Theme', subtitle: themeName, onTap: () {
                        openThemeSheet(context);
                        themeNotifier.addListener(_onTheme);
                      }),
                    ]),
                    _header('Security'),
                    _card([
                      _nav(Icons.password_rounded, 'Change password',
                          onTap: () =>
                              Navigator.push(context, MaterialPageRoute(builder: (_) => const ChangePasswordPage()))),
                      _nav(Icons.security_rounded, 'Two-factor authentication',
                          subtitle: s!['twoFactorEnabled'] == true ? 'On' : 'Off',
                          onTap: () async {
                        await Navigator.push(context, MaterialPageRoute(builder: (_) => const TwoFactorSettingsPage()));
                        _load();
                      }),
                      _nav(Icons.devices_other_rounded, 'Log out of other devices', onTap: _logoutAll),
                    ]),
                    _header('Your data'),
                    _card([
                      _nav(Icons.download_rounded, 'Download your data',
                          subtitle: 'Posts, comments, likes, saved and connections', onTap: _exportData),
                    ]),
                    _header('About'),
                    _card([
                      _nav(Icons.dns_outlined, 'Server', subtitle: apiBaseUrl),
                      _nav(Icons.info_outline, 'Social Connect', subtitle: 'Version 1.1.0'),
                    ]),
                    const SizedBox(height: 18),
                    _card([
                      _nav(Icons.logout_rounded, 'Log out', onTap: () => logoutUser(context)),
                      _nav(Icons.delete_forever_outlined, 'Delete account',
                          color: Colors.redAccent, onTap: () => deleteAccount(context)),
                    ]),
                  ]),
                ),
    );
  }

  void _onTheme() {
    themeNotifier.removeListener(_onTheme);
    if (mounted) setState(() {});
  }
}

// ======================================================
// FOLLOW REQUESTS
// ======================================================

class FollowRequestsPage extends StatefulWidget {
  const FollowRequestsPage({super.key});

  @override
  State<FollowRequestsPage> createState() => _FollowRequestsPageState();
}

class _FollowRequestsPageState extends State<FollowRequestsPage> {
  List<dynamic> requests = [];
  bool loading = true;
  final Set<int> busy = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await Api.get('/follows/requests');
    if (!mounted) return;
    setState(() {
      loading = false;
      requests = res.ok && res.data is List ? res.data as List : [];
    });
  }

  Future<void> _respond(Map request, bool approve) async {
    final id = request['user']['id'] as int;
    setState(() => busy.add(id));
    final res = await Api.post('/follows/requests/$id/${approve ? 'approve' : 'decline'}');
    if (!mounted) return;
    setState(() => busy.remove(id));
    if (res.ok) {
      setState(() => requests.remove(request));
      showSnack(context, approve ? '@${request['user']['username']} can now see your posts' : 'Request removed');
      UnreadCounter.refresh();
    } else {
      showSnack(context, res.message("Couldn't update the request"), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Follow requests', style: TextStyle(fontWeight: FontWeight.w800))),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : requests.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text('No pending requests.\nWhen someone asks to follow your private account, it shows up here.',
                        textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    itemCount: requests.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final r = requests[i] as Map;
                      final u = r['user'] as Map;
                      final id = u['id'] as int;
                      return ListTile(
                        onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    UserProfilePage(userId: id, userName: (u['username'] ?? 'user').toString()))),
                        leading: UserAvatar(url: u['profileImageUrl']?.toString(), name: u['username']?.toString()),
                        title: Text((u['username'] ?? 'user').toString(),
                            style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text((u['name'] ?? '').toString()),
                        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                          FilledButton(
                            onPressed: busy.contains(id) ? null : () => _respond(r, true),
                            child: const Text('Confirm'),
                          ),
                          const SizedBox(width: 6),
                          OutlinedButton(
                            onPressed: busy.contains(id) ? null : () => _respond(r, false),
                            child: const Text('Delete'),
                          ),
                        ]),
                      );
                    },
                  ),
                ),
    );
  }
}

// ======================================================
// BLOCKED / MUTED
// ======================================================

class RelationListPage extends StatefulWidget {
  final bool blocked;

  const RelationListPage({super.key, required this.blocked});

  @override
  State<RelationListPage> createState() => _RelationListPageState();
}

class _RelationListPageState extends State<RelationListPage> {
  List<dynamic> users = [];
  bool loading = true;
  final searchController = TextEditingController();
  List<dynamic> results = [];

  String get _noun => widget.blocked ? 'block' : 'mute';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final res = await Api.get(widget.blocked ? '/users/me/blocked' : '/users/me/muted');
    if (!mounted) return;
    setState(() {
      loading = false;
      users = res.ok && res.data is List ? res.data as List : [];
    });
  }

  Future<void> _search(String q) async {
    if (q.trim().isEmpty) {
      setState(() => results = []);
      return;
    }
    final res = await Api.get('/users/search?q=${Uri.encodeQueryComponent(q.trim())}');
    if (!mounted) return;
    setState(() => results = res.ok && res.data is List ? (res.data as List).take(6).toList() : []);
  }

  Future<void> _add(Map user) async {
    final res = await Api.post('/users/${user['id']}/$_noun');
    if (!mounted) return;
    if (res.ok) {
      searchController.clear();
      setState(() => results = []);
      showSnack(context, '${widget.blocked ? 'Blocked' : 'Muted'} @${user['username']}');
      _load();
    } else {
      showSnack(context, res.message("Couldn't $_noun"), error: true);
    }
  }

  Future<void> _remove(Map user) async {
    final res = await Api.delete('/users/${user['id']}/$_noun');
    if (!mounted) return;
    if (res.ok) {
      setState(() => users.remove(user));
      showSnack(context, '${widget.blocked ? 'Unblocked' : 'Unmuted'} @${user['username']}');
    } else {
      showSnack(context, res.message("Couldn't update"), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.blocked ? 'Blocked accounts' : 'Muted accounts',
            style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.only(bottom: 24), children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                child: Text(
                  widget.blocked
                      ? "Blocked people can't find your profile, see your posts or message you."
                      : "Posts from muted accounts don't appear in your feed. They aren't told.",
                  style: const TextStyle(color: Colors.grey),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
                child: TextField(
                  controller: searchController,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search),
                    hintText: 'Search someone to $_noun…',
                    isDense: true,
                  ),
                  onChanged: _search,
                ),
              ),
              ...results.map((raw) {
                final u = raw as Map;
                return ListTile(
                  leading: UserAvatar(url: u['profileImageUrl']?.toString(), name: u['username']?.toString(), size: 40),
                  title: Text((u['username'] ?? '').toString(), style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text((u['name'] ?? '').toString()),
                  trailing: OutlinedButton(
                    style: OutlinedButton.styleFrom(foregroundColor: widget.blocked ? Colors.redAccent : null),
                    onPressed: () => _add(u),
                    child: Text(widget.blocked ? 'Block' : 'Mute'),
                  ),
                );
              }),
              if (results.isNotEmpty) const Divider(),
              if (users.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(40),
                  child: Text(
                    widget.blocked ? "You haven't blocked anyone." : "You haven't muted anyone.",
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.grey),
                  ),
                ),
              ...users.map((raw) {
                final u = raw as Map;
                return ListTile(
                  leading: UserAvatar(url: u['profileImageUrl']?.toString(), name: u['username']?.toString(), size: 44),
                  title: Text((u['username'] ?? '').toString(), style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text((u['name'] ?? '').toString()),
                  trailing: OutlinedButton(
                    onPressed: () => _remove(u),
                    child: Text(widget.blocked ? 'Unblock' : 'Unmute'),
                  ),
                );
              }),
            ]),
    );
  }
}

// ======================================================
// HIDDEN WORDS (device)
// ======================================================

class HiddenWordsPage extends StatefulWidget {
  const HiddenWordsPage({super.key});

  @override
  State<HiddenWordsPage> createState() => _HiddenWordsPageState();
}

class _HiddenWordsPageState extends State<HiddenWordsPage> {
  List<String> words = [];
  final controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    loadHiddenWords().then((w) {
      if (mounted) setState(() => words = w);
    });
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> _save(List<String> next) async {
    final clean = next.map((w) => w.trim().toLowerCase()).where((w) => w.isNotEmpty).toSet().toList();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('hiddenWords', clean);
    if (mounted) setState(() => words = clean);
  }

  void _add() {
    final w = controller.text.trim();
    if (w.isEmpty) return;
    controller.clear();
    _save([...words, w]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hidden words', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('Posts and comments containing these words are hidden from you on this phone.',
            style: TextStyle(color: Colors.grey)),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: TextField(
              controller: controller,
              maxLength: 40,
              decoration: const InputDecoration(hintText: 'Add a word or phrase', counterText: '', isDense: true),
              onSubmitted: (_) => _add(),
            ),
          ),
          const SizedBox(width: 10),
          FilledButton(onPressed: _add, child: const Text('Add')),
        ]),
        const SizedBox(height: 16),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final w in words)
            InputChip(label: Text(w), onDeleted: () => _save(words.where((x) => x != w).toList())),
        ]),
      ]),
    );
  }
}

// ======================================================
// CHANGE EMAIL / PASSWORD
// ======================================================

class ChangeEmailPage extends StatefulWidget {
  const ChangeEmailPage({super.key});

  @override
  State<ChangeEmailPage> createState() => _ChangeEmailPageState();
}

class _ChangeEmailPageState extends State<ChangeEmailPage> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      busy = true;
      error = null;
    });
    final res = await Api.patch('/auth/email', {'email': email.text.trim(), 'password': password.text});
    if (!mounted) return;
    setState(() => busy = false);
    if (res.ok) {
      showSnack(context, 'Email updated');
      Navigator.pop(context, res.data is Map ? res.data['email']?.toString() : email.text.trim());
    } else {
      setState(() => error = res.message("Couldn't change email"));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Change email', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        TextField(
          controller: email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'New email address'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: password,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Current password'),
        ),
        if (error != null) ...[
          const SizedBox(height: 12),
          Text(error!, style: const TextStyle(color: Colors.redAccent)),
        ],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: busy ? null : _submit,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          child: Text(busy ? 'Saving…' : 'Update email'),
        ),
      ]),
    );
  }
}

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final current = TextEditingController();
  final next = TextEditingController();
  final confirm = TextEditingController();
  bool busy = false;
  bool show = false;
  String? error;

  @override
  void dispose() {
    current.dispose();
    next.dispose();
    confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (next.text.length < 6) return setState(() => error = 'New password must be at least 6 characters');
    if (next.text != confirm.text) return setState(() => error = 'Passwords do not match');
    setState(() {
      busy = true;
      error = null;
    });
    final res = await Api.post('/auth/change-password', {'currentPassword': current.text, 'newPassword': next.text});
    if (!mounted) return;
    setState(() => busy = false);
    if (res.ok) {
      // Other devices are signed out; keep this one signed in.
      final token = res.data is Map ? res.data['accessToken']?.toString() : null;
      if (token != null) await Api.saveToken(token);
      if (!mounted) return;
      showSnack(context, 'Password changed. Other devices were signed out.');
      Navigator.pop(context);
    } else {
      setState(() => error = res.message('Failed to change password'));
    }
  }

  @override
  Widget build(BuildContext context) {
    InputDecoration deco(String label) => InputDecoration(
          labelText: label,
          suffixIcon: IconButton(
            icon: Icon(show ? Icons.visibility_off_outlined : Icons.visibility_outlined),
            onPressed: () => setState(() => show = !show),
          ),
        );
    return Scaffold(
      appBar: AppBar(title: const Text('Change password', style: TextStyle(fontWeight: FontWeight.w800))),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        TextField(controller: current, obscureText: !show, decoration: deco('Current password')),
        const SizedBox(height: 12),
        TextField(controller: next, obscureText: !show, decoration: deco('New password')),
        const SizedBox(height: 12),
        TextField(controller: confirm, obscureText: !show, decoration: deco('Confirm new password')),
        if (error != null) ...[
          const SizedBox(height: 12),
          Text(error!, style: const TextStyle(color: Colors.redAccent)),
        ],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: busy ? null : _submit,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          child: Text(busy ? 'Updating…' : 'Change password'),
        ),
      ]),
    );
  }
}

// ======================================================
// TWO-FACTOR AUTHENTICATION
// ======================================================

class TwoFactorSettingsPage extends StatefulWidget {
  const TwoFactorSettingsPage({super.key});

  @override
  State<TwoFactorSettingsPage> createState() => _TwoFactorSettingsPageState();
}

class _TwoFactorSettingsPageState extends State<TwoFactorSettingsPage> {
  bool loading = true;
  bool enabled = false;
  int remaining = 0;
  String? secret;
  String? otpauth;
  List<String> recoveryCodes = [];
  final code = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    code.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final res = await Api.get('/auth/2fa');
    if (!mounted) return;
    setState(() {
      loading = false;
      enabled = res.ok && res.data is Map && res.data['enabled'] == true;
      remaining = res.ok && res.data is Map ? (res.data['recoveryCodesRemaining'] as num? ?? 0).toInt() : 0;
    });
  }

  Future<void> _start() async {
    setState(() {
      busy = true;
      error = null;
    });
    final res = await Api.post('/auth/2fa/setup');
    if (!mounted) return;
    setState(() {
      busy = false;
      if (res.ok && res.data is Map) {
        secret = res.data['secret']?.toString();
        otpauth = res.data['otpauthUrl']?.toString();
        code.clear();
      } else {
        error = res.message("Couldn't start setup");
      }
    });
  }

  Future<void> _enable() async {
    setState(() {
      busy = true;
      error = null;
    });
    final res = await Api.post('/auth/2fa/enable', {'code': code.text.trim()});
    if (!mounted) return;
    setState(() {
      busy = false;
      if (res.ok && res.data is Map) {
        recoveryCodes = ((res.data['recoveryCodes'] as List?) ?? []).map((e) => e.toString()).toList();
        enabled = true;
        remaining = recoveryCodes.length;
        secret = null;
        otpauth = null;
      } else {
        error = res.message("That code didn't match");
      }
    });
  }

  Future<void> _disable() async {
    setState(() {
      busy = true;
      error = null;
    });
    final res = await Api.post('/auth/2fa/disable', {'password': password.text, 'code': code.text.trim()});
    if (!mounted) return;
    setState(() => busy = false);
    if (res.ok) {
      showSnack(context, 'Two-factor authentication is off');
      setState(() {
        enabled = false;
        password.clear();
        code.clear();
      });
    } else {
      setState(() => error = res.message("Couldn't turn off 2FA"));
    }
  }

  Widget _errorText() => error == null
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Text(error!, style: const TextStyle(color: Colors.redAccent)),
        );

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    Widget body;

    if (loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (recoveryCodes.isNotEmpty) {
      body = ListView(padding: const EdgeInsets.all(20), children: [
        const Icon(Icons.verified_user_rounded, size: 54, color: Color(0xFF16A34A)),
        const SizedBox(height: 12),
        const Text('2FA is on — save your recovery codes',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        const Text("If you lose your phone, each code lets you sign in once. They won't be shown again.",
            textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
        const SizedBox(height: 18),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 3.4,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          children: [
            for (final c in recoveryCodes)
              Container(
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1C1C1C) : const Color(0xFFF4F4F1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(c, style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w800)),
              ),
          ],
        ),
        const SizedBox(height: 18),
        OutlinedButton.icon(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: recoveryCodes.join('\n')));
            showSnack(context, 'Recovery codes copied');
          },
          icon: const Icon(Icons.copy_rounded),
          label: const Text('Copy codes'),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: () => setState(() => recoveryCodes = []),
          child: const Text('I saved them'),
        ),
      ]);
    } else if (enabled) {
      body = ListView(padding: const EdgeInsets.all(20), children: [
        const Icon(Icons.verified_user_rounded, size: 54, color: Color(0xFF16A34A)),
        const SizedBox(height: 12),
        const Text('Two-factor authentication is on',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text('$remaining recovery codes left', textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
        const SizedBox(height: 24),
        const Text('Turn off', style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')),
        const SizedBox(height: 10),
        TextField(
          controller: code,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(labelText: '6-digit code or recovery code'),
        ),
        _errorText(),
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
          onPressed: busy ? null : _disable,
          child: Text(busy ? 'Turning off…' : 'Turn off 2FA'),
        ),
      ]);
    } else if (secret != null) {
      body = ListView(padding: const EdgeInsets.all(20), children: [
        const Text('1. Add Social Connect to your authenticator app',
            style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        if (otpauth != null) ...[
          FilledButton.icon(
            onPressed: () async {
              final ok = await launchUrl(Uri.parse(otpauth!), mode: LaunchMode.externalApplication);
              if (!ok && context.mounted) {
                showSnack(context, 'No authenticator app found — scan the code or copy the key', error: true);
              }
            },
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('Open authenticator app'),
          ),
          const SizedBox(height: 14),
          Center(
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: QrImageView(data: otpauth!, size: 190, backgroundColor: Colors.white),
            ),
          ),
        ],
        const SizedBox(height: 12),
        SelectableText(
          secret!.replaceAllMapped(RegExp(r'.{4}'), (m) => '${m.group(0)} ').trim(),
          textAlign: TextAlign.center,
          style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700),
        ),
        TextButton.icon(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: secret!));
            showSnack(context, 'Key copied');
          },
          icon: const Icon(Icons.copy_rounded, size: 18),
          label: const Text('Copy key'),
        ),
        const SizedBox(height: 10),
        const Text('2. Enter the 6-digit code it shows', style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        TextField(
          controller: code,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 10),
          decoration: const InputDecoration(counterText: '', hintText: '000000'),
          onChanged: (_) => setState(() {}),
        ),
        _errorText(),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: busy || !RegExp(r'^\d{6}$').hasMatch(code.text.trim()) ? null : _enable,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          child: Text(busy ? 'Checking…' : 'Turn on'),
        ),
      ]);
    } else {
      body = ListView(padding: const EdgeInsets.all(24), children: [
        const Icon(Icons.security_rounded, size: 60, color: Colors.grey),
        const SizedBox(height: 16),
        const Text('Protect your account',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        const Text(
          'When 2FA is on, signing in needs your password and a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password…).',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey, height: 1.4),
        ),
        _errorText(),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: busy ? null : _start,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
          child: Text(busy ? 'Starting…' : 'Set up 2FA'),
        ),
      ]);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Two-factor authentication', style: TextStyle(fontWeight: FontWeight.w800))),
      body: body,
    );
  }
}
