// Stub file for non-web platforms.
// On mobile, GoogleWebSignInButton is never displayed —
// the native handleGoogleSignIn() is used instead.
import 'package:flutter/material.dart';

class GoogleWebSignInButton extends StatelessWidget {
  const GoogleWebSignInButton({
    super.key,
    required this.onSuccess,
    required this.onError,
  });

  final void Function(String idToken) onSuccess;
  final void Function(String error) onError;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
