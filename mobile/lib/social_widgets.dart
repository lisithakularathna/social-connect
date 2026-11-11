import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'people_pages.dart';

// ======================================================
// AVATAR
// ======================================================

class UserAvatar extends StatelessWidget {
  final String? url;
  final String? name;
  final double size;
  final VoidCallback? onTap;

  const UserAvatar({super.key, this.url, this.name, this.size = 44, this.onTap});

  @override
  Widget build(BuildContext context) {
    final initial = (name?.trim().isNotEmpty ?? false) ? name!.trim()[0].toUpperCase() : 'U';
    final hasImage = url != null && url!.isNotEmpty;
    final avatar = Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Color(0xFFF7B267), Color(0xFFD94D6A), Color(0xFF7C4D9E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: hasImage
          ? Image.network(
              url!,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => _initial(initial),
            )
          : _initial(initial),
    );
    if (onTap == null) return avatar;
    return GestureDetector(onTap: onTap, child: avatar);
  }

  Widget _initial(String initial) => Text(
        initial,
        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * 0.4),
      );
}

// ======================================================
// PRESENCE
// ======================================================

String? presenceLabel(Map<String, dynamic>? user) {
  if (user == null) return null;
  if (user['isOnline'] == true) return 'Active now';
  final last = user['lastActiveAt'];
  if (last == null) return null;
  final when = DateTime.tryParse(last.toString())?.toLocal();
  if (when == null) return null;
  final diff = DateTime.now().difference(when);
  if (diff.inMinutes < 60) return 'Active ${diff.inMinutes.clamp(1, 59)}m ago';
  if (diff.inHours < 24) return 'Active ${diff.inHours}h ago';
  if (diff.inDays <= 7) return 'Active ${diff.inDays}d ago';
  return null;
}

// ======================================================
// FOLLOW BUTTON
// ======================================================

enum FollowState { none, requested, following }

class FollowButton extends StatefulWidget {
  final int userId;
  final bool initialFollowing;
  final bool initialRequested;
  final bool followsYou;
  final bool compact;
  final void Function(FollowState state)? onChanged;

  const FollowButton({
    super.key,
    required this.userId,
    this.initialFollowing = false,
    this.initialRequested = false,
    this.followsYou = false,
    this.compact = true,
    this.onChanged,
  });

  @override
  State<FollowButton> createState() => _FollowButtonState();
}

class _FollowButtonState extends State<FollowButton> {
  late FollowState state;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    state = widget.initialFollowing
        ? FollowState.following
        : widget.initialRequested
            ? FollowState.requested
            : FollowState.none;
  }

  Future<void> _toggle() async {
    if (busy) return;
    final previous = state;
    setState(() => busy = true);
    if (previous == FollowState.none) {
      final res = await Api.post('/follows/${widget.userId}');
      if (!mounted) return;
      if (res.ok) {
        final next = res.data is Map && res.data['requested'] == true
            ? FollowState.requested
            : FollowState.following;
        setState(() => state = next);
        if (next == FollowState.requested) showSnack(context, 'Follow request sent');
        widget.onChanged?.call(next);
      } else {
        showSnack(context, res.message("Couldn't follow"), error: true);
      }
    } else {
      setState(() => state = FollowState.none);
      final res = await Api.delete('/follows/${widget.userId}');
      if (!mounted) return;
      if (res.ok) {
        widget.onChanged?.call(FollowState.none);
      } else {
        setState(() => state = previous);
        showSnack(context, res.message("Couldn't update follow"), error: true);
      }
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final label = switch (state) {
      FollowState.following => 'Following',
      FollowState.requested => 'Requested',
      FollowState.none => widget.followsYou ? 'Follow back' : 'Follow',
    };
    final filled = state == FollowState.none;
    final height = widget.compact ? 34.0 : 44.0;
    final style = ButtonStyle(
      minimumSize: WidgetStatePropertyAll(Size(widget.compact ? 96 : 140, height)),
      padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 14)),
      shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
      textStyle: WidgetStatePropertyAll(TextStyle(fontWeight: FontWeight.w700, fontSize: widget.compact ? 13 : 15)),
    );
    final child = busy
        ? SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: filled ? scheme.onPrimary : scheme.primary),
          )
        : Text(label);
    return filled
        ? FilledButton(onPressed: _toggle, style: style, child: child)
        : OutlinedButton(onPressed: _toggle, style: style, child: child);
  }
}

// ======================================================
// RICH TEXT (@mentions, #hashtags, links)
// ======================================================

final _tokenRe = RegExp(r'(@[a-zA-Z0-9_.]{3,30}|#[\p{L}\p{N}_]{2,40}|https?://[^\s]+)', unicode: true);

class RichTextView extends StatefulWidget {
  final String text;
  final TextStyle? style;
  final int? maxLines;
  final List<InlineSpan> leading;

  const RichTextView(this.text, {super.key, this.style, this.maxLines, this.leading = const []});

  @override
  State<RichTextView> createState() => _RichTextViewState();
}

class _RichTextViewState extends State<RichTextView> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  TapGestureRecognizer _tap(VoidCallback onTap) {
    final r = TapGestureRecognizer()..onTap = onTap;
    _recognizers.add(r);
    return r;
  }

  Future<void> _openMention(String username) async {
    final res = await Api.get('/users/by-username/${Uri.encodeComponent(username)}');
    if (!mounted) return;
    if (!res.ok || res.data is! Map) {
      showSnack(context, '@$username isn\'t available', error: true);
      return;
    }
    final me = await Api.currentUserId();
    if (!mounted) return;
    final id = res.data['id'] as int;
    if (id == me) {
      showSnack(context, "That's you!");
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => UserProfilePage(userId: id, userName: username)),
    );
  }

  @override
  Widget build(BuildContext context) {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();

    final accent = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFFFF7A93)
        : const Color(0xFFD94D6A);
    final base = widget.style ?? DefaultTextStyle.of(context).style;
    final spans = <InlineSpan>[...widget.leading];
    var last = 0;
    for (final m in _tokenRe.allMatches(widget.text)) {
      if (m.start > last) spans.add(TextSpan(text: widget.text.substring(last, m.start)));
      final token = m.group(0)!;
      if (token.startsWith('@')) {
        final name = token.substring(1).replaceAll(RegExp(r'\.+$'), '');
        spans.add(TextSpan(
          text: token,
          style: TextStyle(color: accent, fontWeight: FontWeight.w600),
          recognizer: _tap(() => _openMention(name)),
        ));
      } else if (token.startsWith('#')) {
        spans.add(TextSpan(
          text: token,
          style: TextStyle(color: accent, fontWeight: FontWeight.w600),
          recognizer: _tap(() => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => PostSearchPage(initialQuery: token)),
              )),
        ));
      } else {
        spans.add(TextSpan(
          text: token.replaceFirst(RegExp(r'^https?://'), ''),
          style: TextStyle(color: accent, decoration: TextDecoration.underline),
          recognizer: _tap(() => launchUrl(Uri.parse(token), mode: LaunchMode.externalApplication)),
        ));
      }
      last = m.end;
    }
    if (last < widget.text.length) spans.add(TextSpan(text: widget.text.substring(last)));

    return Text.rich(
      TextSpan(style: base, children: spans),
      maxLines: widget.maxLines,
      overflow: widget.maxLines == null ? null : TextOverflow.ellipsis,
    );
  }
}

// ======================================================
// TEXT-POST COLOURS
// ======================================================

Color colorFromHex(dynamic hex, {Color fallback = const Color(0xFFF3F4F6)}) {
  if (hex is String) {
    final v = hex.replaceAll('#', '').trim();
    final parsed = int.tryParse(v.length == 6 ? 'FF$v' : v, radix: 16);
    if (parsed != null && (v.length == 6 || v.length == 8)) return Color(parsed);
  }
  return fallback;
}

Color readableOn(Color background) =>
    background.computeLuminance() > 0.45 ? const Color(0xFF111827) : Colors.white;

/// Square grid tile used on profile pages (image or coloured text post).
class PostGridTile extends StatelessWidget {
  final Map<String, dynamic> post;
  final VoidCallback onTap;

  const PostGridTile({super.key, required this.post, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final imageUrl = post['imageUrl']?.toString();
    final isRepost = post['isRepost'] == true;
    final bg = colorFromHex(post['backgroundColor']);
    return InkWell(
      onTap: onTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (imageUrl != null && imageUrl.isNotEmpty)
            Image.network(
              imageUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(
                color: Colors.grey.withValues(alpha: 0.2),
                child: const Icon(Icons.broken_image_outlined, color: Colors.grey),
              ),
            )
          else
            Container(
              color: bg,
              padding: const EdgeInsets.all(10),
              alignment: Alignment.center,
              child: Text(
                (post['title'] ?? '').toString(),
                maxLines: 5,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(color: readableOn(bg), fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
          if (isRepost)
            const Positioned(
              top: 6,
              right: 6,
              child: Icon(Icons.repeat_rounded, size: 18, color: Colors.white, shadows: [Shadow(blurRadius: 6)]),
            ),
        ],
      ),
    );
  }
}

// ======================================================
// UNREAD BADGES (polled)
// ======================================================

class UnreadCounts {
  final int activity;
  final int messages;
  const UnreadCounts(this.activity, this.messages);
}

class UnreadCounter {
  static final ValueNotifier<UnreadCounts> notifier = ValueNotifier(const UnreadCounts(0, 0));
  static Timer? _timer;
  static bool _busy = false;

  static Future<void> refresh() async {
    if (_busy) return;
    _busy = true;
    try {
      final results = await Future.wait([
        Api.get('/notifications/unread-count'),
        Api.get('/messages/unread-count'),
      ]);
      final notif = results[0];
      final msgs = results[1];
      if (!notif.ok) return;
      var activity = 0;
      final byType = notif.data is Map ? notif.data['byType'] : null;
      if (byType is Map) {
        byType.forEach((type, n) {
          if (type != 'message' && n is num) activity += n.toInt();
        });
      } else if (notif.data is Map && notif.data['count'] is num) {
        activity = (notif.data['count'] as num).toInt();
      }
      final messages = msgs.ok && msgs.data is Map && msgs.data['count'] is num
          ? (msgs.data['count'] as num).toInt()
          : 0;
      notifier.value = UnreadCounts(activity, messages);
    } finally {
      _busy = false;
    }
  }

  static void start() {
    refresh();
    _timer ??= Timer.periodic(const Duration(seconds: 30), (_) => refresh());
  }

  static void stop() {
    _timer?.cancel();
    _timer = null;
  }

  static void clearActivity() =>
      notifier.value = UnreadCounts(0, notifier.value.messages);

  static void clearMessages() =>
      notifier.value = UnreadCounts(notifier.value.activity, 0);
}
