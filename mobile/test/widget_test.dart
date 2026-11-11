import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile/api.dart';
import 'package:mobile/main.dart';
import 'package:mobile/settings_pages.dart';
import 'package:mobile/social_widgets.dart';

void main() {
  group('presenceLabel', () {
    test('online wins', () {
      expect(presenceLabel({'isOnline': true, 'lastActiveAt': null}), 'Active now');
    });

    test('recent activity is relative', () {
      final tenMinutesAgo = DateTime.now().subtract(const Duration(minutes: 10)).toUtc().toIso8601String();
      expect(presenceLabel({'isOnline': false, 'lastActiveAt': tenMinutesAgo}), 'Active 10m ago');
    });

    test('hidden or stale activity shows nothing', () {
      expect(presenceLabel({'isOnline': false, 'lastActiveAt': null}), isNull);
      final old = DateTime.now().subtract(const Duration(days: 30)).toUtc().toIso8601String();
      expect(presenceLabel({'isOnline': false, 'lastActiveAt': old}), isNull);
    });
  });

  group('text-post colours', () {
    test('parses hex with or without #', () {
      expect(colorFromHex('#111827'), const Color(0xFF111827));
      expect(colorFromHex('FDE68A'), const Color(0xFFFDE68A));
    });

    test('falls back on junk', () {
      expect(colorFromHex('nope'), const Color(0xFFF3F4F6));
      expect(colorFromHex(null), const Color(0xFFF3F4F6));
    });

    test('picks readable text colour', () {
      expect(readableOn(const Color(0xFF111827)), Colors.white);
      expect(readableOn(const Color(0xFFFDE68A)), const Color(0xFF111827));
    });
  });

  test('hidden words match case-insensitively', () {
    expect(containsHiddenWord('Big SPOILER ahead', ['spoiler']), isTrue);
    expect(containsHiddenWord('nothing here', ['spoiler']), isFalse);
    expect(containsHiddenWord(null, ['spoiler']), isFalse);
  });

  test('ApiResult.message reads Nest errors', () {
    expect(const ApiResult(400, {'message': 'Bad input'}).message(), 'Bad input');
    expect(const ApiResult(400, {'message': ['a', 'b']}).message(), 'a, b');
    expect(const ApiResult(0, null).message(), contains("Can't reach the server"));
    expect(const ApiResult(500, null).message('Oops'), 'Oops');
  });

  testWidgets('RichTextView renders mentions and hashtags', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: RichTextView('Hi @maya_dev check #travel')),
    ));
    expect(find.textContaining('@maya_dev', findRichText: true), findsOneWidget);
    expect(find.textContaining('#travel', findRichText: true), findsOneWidget);
  });

  testWidgets('without a saved session the app opens the login screen', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const SocialConnectApp());
    // AuthGate splash, then the fade to LoginPage.
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Sign in to continue'), findsOneWidget);
    expect(find.text('Log in'), findsOneWidget);
  });
}
