import 'package:flutter/material.dart';

import 'api.dart';
import 'main.dart' show HomePage, LoginPage;

/// First screen: resumes a saved session instead of always asking to log in.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  void initState() {
    super.initState();
    _route();
  }

  Future<void> _route() async {
    final token = await Api.token();
    Widget next = const LoginPage();
    if (token != null && token.isNotEmpty) {
      final res = await Api.get('/users/me');
      if (res.ok) {
        next = const HomePage();
      } else if (res.status == 0) {
        // Offline: keep the session, the home screen shows a retry state.
        next = const HomePage();
      } else {
        await Api.clearToken();
      }
    }
    if (!mounted) return;
    Navigator.of(context).pushReplacement(PageRouteBuilder(
      pageBuilder: (_, _, _) => next,
      transitionsBuilder: (_, anim, _, child) => FadeTransition(opacity: anim, child: child),
      transitionDuration: const Duration(milliseconds: 250),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _BrandMark(size: 68),
          SizedBox(height: 18),
          Text('Social Connect', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.6)),
          SizedBox(height: 22),
          SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4)),
        ]),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  final double size;
  const _BrandMark({this.size = 56});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.3),
        gradient: const LinearGradient(
          colors: [Color(0xFFD94D6A), Color(0xFF9B5DE5)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(color: const Color(0xFFD94D6A).withValues(alpha: 0.3), blurRadius: 18, offset: const Offset(0, 8)),
        ],
      ),
      child: Icon(Icons.share_rounded, color: Colors.white, size: size * 0.5),
    );
  }
}

/// Finishes any sign-in response: either saves the session and opens the
/// app, or (when 2FA is on) asks for the authentication code first.
Future<void> completeLogin(BuildContext context, dynamic data) async {
  if (data is Map && data['twoFactorRequired'] == true) {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => TwoFactorLoginPage(challengeToken: data['challengeToken'].toString()),
    ));
    return;
  }
  final token = data is Map ? data['accessToken']?.toString() : null;
  if (token == null || token.isEmpty) {
    showSnack(context, 'Sign-in failed. Please try again.', error: true);
    return;
  }
  await Api.saveToken(token);
  if (!context.mounted) return;
  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => const HomePage()),
    (route) => false,
  );
}

class TwoFactorLoginPage extends StatefulWidget {
  final String challengeToken;

  const TwoFactorLoginPage({super.key, required this.challengeToken});

  @override
  State<TwoFactorLoginPage> createState() => _TwoFactorLoginPageState();
}

class _TwoFactorLoginPageState extends State<TwoFactorLoginPage> {
  final controller = TextEditingController();
  bool useRecovery = false;
  bool busy = false;
  String? error;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  bool get _valid {
    final v = controller.text.trim();
    return useRecovery ? v.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').length == 10 : RegExp(r'^\d{6}$').hasMatch(v);
  }

  Future<void> _verify() async {
    if (busy || !_valid) return;
    setState(() {
      busy = true;
      error = null;
    });
    final res = await Api.post('/auth/2fa/verify', {
      'challengeToken': widget.challengeToken,
      'code': controller.text.trim(),
    });
    if (!mounted) return;
    setState(() => busy = false);
    if (res.ok) {
      await completeLogin(context, res.data);
    } else {
      final message = res.message('Incorrect code. Try again.');
      setState(() => error = message);
      if (RegExp('expired|log in again', caseSensitive: false).hasMatch(message)) {
        await Future.delayed(const Duration(milliseconds: 900));
        if (mounted) Navigator.pop(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Two-factor authentication')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
          children: [
            const Center(child: _BrandMark(size: 60)),
            const SizedBox(height: 22),
            const Text('Enter your code',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(
              useRecovery
                  ? 'Type one of the recovery codes you saved when you turned on 2FA.'
                  : 'Open your authenticator app and enter the 6-digit code for Social Connect.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.grey, height: 1.4),
            ),
            const SizedBox(height: 26),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: useRecovery ? TextInputType.text : TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: useRecovery ? 11 : 6,
              textCapitalization: TextCapitalization.characters,
              autofillHints: const [AutofillHints.oneTimeCode],
              style: TextStyle(
                fontSize: useRecovery ? 20 : 28,
                fontWeight: FontWeight.w800,
                letterSpacing: useRecovery ? 2 : 10,
              ),
              decoration: InputDecoration(counterText: '', hintText: useRecovery ? 'XXXXX-XXXXX' : '000000'),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _verify(),
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.redAccent)),
            ],
            const SizedBox(height: 20),
            SizedBox(
              height: 50,
              child: FilledButton(
                onPressed: _valid && !busy ? _verify : null,
                style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Verify', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => setState(() {
                useRecovery = !useRecovery;
                controller.clear();
                error = null;
              }),
              child: Text(useRecovery ? 'Use an authenticator code instead' : 'Lost your phone? Use a recovery code'),
            ),
          ],
        ),
      ),
    );
  }
}
