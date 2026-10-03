// Web-only implementation.
// Uses dart:js_interop to call socialConnectGoogleSignIn() defined in
// index.html, which uses the Google Identity Services (GIS) One Tap API
// to get a proper idToken without the deprecated popup flow.
import 'dart:js_interop';

import 'package:flutter/material.dart';

// JS-side function signatures
@JS('socialConnectGoogleSignIn')
external void _socialConnectGoogleSignIn(
  JSFunction onSuccess,
  JSFunction onError,
);

class GoogleWebSignInButton extends StatelessWidget {
  const GoogleWebSignInButton({
    super.key,
    required this.onSuccess,
    required this.onError,
  });

  /// Called with the Google idToken string on successful sign-in.
  final void Function(String idToken) onSuccess;

  /// Called with an error message string if sign-in fails.
  final void Function(String error) onError;

  void _signIn() {
    final successCb = ((JSString credential) {
      onSuccess(credential.toDart);
    }).toJS;

    final errorCb = ((JSString error) {
      onError(error.toDart);
    }).toJS;

    _socialConnectGoogleSignIn(successCb, errorCb);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SizedBox(
      height: 52,
      child: OutlinedButton(
        onPressed: _signIn,
        style: OutlinedButton.styleFrom(
          side: BorderSide(
            color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
          ),
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
    );
  }
}
