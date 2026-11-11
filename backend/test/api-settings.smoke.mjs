// API tests for settings, privacy, safety, 2FA and sessions.
// Needs the backend running (API env var, default http://localhost:3000)
// and the database up. Creates throwaway users and deletes them at the end.
// Run: npm run test:api
import { createHmac } from 'node:crypto';

const BASE = process.env.API || 'http://localhost:3000';
const stamp = Date.now().toString(36);
let pass = 0, fail = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // GET/HEAD requests must not carry a body.
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ok   ', name); }
  else { fail++; console.log('  FAIL ', name, typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 300)); }
}

// TOTP (independent implementation for the test)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32decode(s) { let bits = 0, val = 0; const out = []; for (const c of s.replace(/=+$/, '')) { val = (val << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
function totp(secret, t = Date.now()) {
  const counter = Math.floor(t / 30000); const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', b32decode(secret)).update(msg).digest(); const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1e6).padStart(6, '0');
}

const mk = (n) => ({ email: `t2_${n}_${stamp}@example.com`, username: `t2_${n}_${stamp}`, password: 'secret123', name: `T2 ${n}` });
const U = { a: mk('a'), b: mk('b'), c: mk('c') };
const T = {}; const ID = {};

try {
  for (const k of Object.keys(U)) {
    const r = await call('POST', '/auth/register', { body: U[k] });
    T[k] = r.data.accessToken; ID[k] = r.data.user.id;
  }
  check('registered 3 users', T.a && T.b && T.c);

  console.log('settings');
  let r = await call('GET', '/users/me/settings', { token: T.a });
  check('default settings', r.status === 200 && r.data.isPrivate === false && r.data.messagePrivacy === 'everyone' && r.data.notifyLikes === true, r.data);
  r = await call('PATCH', '/users/me/settings', { token: T.a, body: { messagePrivacy: 'bogus' } });
  check('invalid setting rejected (400)', r.status === 400);
  r = await call('PATCH', '/users/me/settings', { token: T.a, body: { isPrivate: 'yes' } });
  check('non-boolean rejected (400)', r.status === 400);

  console.log('private account + follow requests');
  r = await call('PATCH', '/users/me/settings', { token: T.b, body: { isPrivate: true } });
  check('B goes private', r.data?.isPrivate === true);
  const bp1 = (await call('POST', '/posts', { token: T.b, body: { title: 'B private post' } })).data.post;
  r = await call('POST', `/follows/${ID.b}`, { token: T.a });
  check('follow private → requested', r.data?.requested === true && r.data?.isFollowing === false, r.data);
  r = await call('GET', `/users/${ID.b}`, { token: T.a });
  check('profile: canViewContent false, isRequested true', r.data?.canViewContent === false && r.data?.isRequested === true && r.data?.isPrivate === true, r.data);
  r = await call('GET', `/posts/user/${ID.b}`, { token: T.a });
  check('private posts hidden from non-follower', Array.isArray(r.data) && r.data.length === 0);
  r = await call('GET', `/posts/${bp1.id}`, { token: T.a });
  check('private single post → 404', r.status === 404);
  r = await call('GET', `/follows/followers/${ID.b}`, { token: T.a });
  check('private follower list → 403', r.status === 403);
  r = await call('GET', '/posts?limit=50', { token: T.a });
  check('private post not in A feed', !r.data.posts.some((p) => p.id === bp1.id));
  r = await call('GET', '/follows/requests', { token: T.b });
  check('B sees incoming request', r.data?.some((x) => x.user.id === ID.a), r.data);
  r = await call('GET', '/notifications', { token: T.b });
  check('B got follow_request notification with actor', r.data?.some((n) => n.type === 'follow_request' && n.actor?.id === ID.a), r.data);
  r = await call('POST', `/follows/requests/${ID.a}/approve`, { token: T.b });
  check('B approves', r.status === 201, r);
  r = await call('GET', `/posts/user/${ID.b}`, { token: T.a });
  check('A now sees B posts', r.data?.some((p) => p.id === bp1.id));
  r = await call('GET', '/notifications', { token: T.b });
  check('request notification removed after approve', !r.data?.some((n) => n.type === 'follow_request'));
  r = await call('GET', '/notifications', { token: T.a });
  check('A got follow_accept', r.data?.some((n) => n.type === 'follow_accept'));
  // pending request auto-approved when going public
  r = await call('POST', `/follows/${ID.b}`, { token: T.c });
  check('C requested B', r.data?.requested === true);
  r = await call('PATCH', '/users/me/settings', { token: T.b, body: { isPrivate: false } });
  check('B public → auto-approves 1', r.data?.approvedRequests === 1, r.data);
  r = await call('GET', `/follows/check/${ID.b}`, { token: T.c });
  check('C now follows B', r.data?.isFollowing === true);
  // cancel request
  await call('PATCH', '/users/me/settings', { token: T.a, body: { isPrivate: true } });
  await call('POST', `/follows/${ID.a}`, { token: T.c });
  r = await call('DELETE', `/follows/${ID.a}`, { token: T.c });
  check('cancel pending request via unfollow', r.data?.message === 'Follow request cancelled', r.data);
  await call('PATCH', '/users/me/settings', { token: T.a, body: { isPrivate: false } });

  console.log('mentions + notification prefs');
  const ap1 = (await call('POST', '/posts', { token: T.a, body: { title: `Hello @${U.b.username} and @nobody_${stamp}` } })).data.post;
  await new Promise((res) => setTimeout(res, 300));
  r = await call('GET', '/notifications', { token: T.b });
  check('B mentioned (with postId)', r.data?.some((n) => n.type === 'mention' && n.postId === ap1.id && n.actorId === ID.a), r.data?.map((n) => n.type));
  await call('PATCH', '/users/me/settings', { token: T.a, body: { notifyLikes: false } });
  await call('POST', `/likes/${ap1.id}`, { token: T.b });
  r = await call('GET', '/notifications', { token: T.a });
  check('notifyLikes=false → no like notification', !r.data?.some((n) => n.type === 'like'), r.data?.map((n) => n.type));

  console.log('hide like counts');
  await call('PATCH', '/users/me/settings', { token: T.a, body: { hideLikeCounts: true } });
  r = await call('GET', `/posts/${ap1.id}`, { token: T.b });
  check('others see likesCount null', r.data?.likesCount === null && r.data?.likesHidden === true, r.data);
  r = await call('GET', `/posts/${ap1.id}`, { token: T.a });
  check('author still sees count', r.data?.likesCount === 1);
  r = await call('GET', `/likes/${ap1.id}`, { token: T.b });
  check('likers list hidden for others', r.data?.hidden === true && r.data?.likes.length === 0);

  console.log('comment privacy');
  await call('PATCH', '/users/me/settings', { token: T.a, body: { commentPrivacy: 'off' } });
  r = await call('POST', `/comments/${ap1.id}`, { token: T.b, body: { content: 'hi' } });
  check('comments off → 403', r.status === 403, r);
  r = await call('GET', `/comments/${ap1.id}`, { token: T.b });
  check('GET comments reports canComment=false', r.data?.canComment === false && r.data?.commentPolicy === 'off');
  r = await call('POST', `/comments/${ap1.id}`, { token: T.a, body: { content: 'author can still comment' } });
  check('author can comment when off', r.status === 201);
  await call('PATCH', '/users/me/settings', { token: T.a, body: { commentPrivacy: 'followers' } });
  r = await call('POST', `/comments/${ap1.id}`, { token: T.b, body: { content: 'hi' } });
  check('followers-only: non-follower blocked', r.status === 403);
  await call('POST', `/follows/${ID.a}`, { token: T.b });
  r = await call('POST', `/comments/${ap1.id}`, { token: T.b, body: { content: `nice @${U.c.username}` } });
  check('followers-only: follower allowed', r.status === 201, r);
  await new Promise((res) => setTimeout(res, 300));
  r = await call('GET', '/notifications', { token: T.c });
  check('C mentioned in comment', r.data?.some((n) => n.type === 'mention' && n.message.includes('comment')));
  await call('PATCH', '/users/me/settings', { token: T.a, body: { commentPrivacy: 'everyone', hideLikeCounts: false, notifyLikes: true } });

  console.log('saved posts');
  r = await call('POST', `/posts/${ap1.id}/save`, { token: T.b });
  check('save post', r.data?.isSaved === true);
  r = await call('GET', `/posts/${ap1.id}`, { token: T.b });
  check('isSaved in payload', r.data?.isSaved === true);
  r = await call('GET', '/posts/saved', { token: T.b });
  check('GET /posts/saved', r.data?.[0]?.id === ap1.id, r.data);
  r = await call('POST', '/posts/saved/import', { token: T.c, body: { postIds: [ap1.id, 99999999] } });
  check('import saved skips missing', r.data?.imported === 1, r.data);
  r = await call('DELETE', `/posts/${ap1.id}/save`, { token: T.b });
  r = await call('GET', '/posts/saved', { token: T.b });
  check('unsave', Array.isArray(r.data) && r.data.length === 0);
  r = await call('GET', `/posts/${ap1.id}`, { token: T.b });
  check('no author email in post payload', r.data && !('email' in (r.data.author || {})));

  console.log('post search');
  r = await call('GET', `/posts/search?q=${encodeURIComponent('private post')}`, { token: T.a });
  check('search finds visible post', r.data?.some((p) => p.id === bp1.id), r.data);

  console.log('mute');
  r = await call('POST', `/users/${ID.b}/mute`, { token: T.a });
  check('A mutes B', r.data?.isMuted === true);
  r = await call('GET', '/posts?limit=50', { token: T.a });
  check('muted posts hidden from feed', !r.data.posts.some((p) => p.authorId === ID.b));
  r = await call('GET', `/users/${ID.b}`, { token: T.a });
  check('muted profile still visible, isMuted', r.status === 200 && r.data.isMuted === true);
  r = await call('GET', '/users/me/muted', { token: T.a });
  check('muted list', r.data?.some((u) => u.id === ID.b));
  await call('DELETE', `/users/${ID.b}/mute`, { token: T.a });

  console.log('messages: privacy, read receipts');
  r = await call('PATCH', '/users/me/settings', { token: T.c, body: { messagePrivacy: 'nobody' } });
  r = await call('POST', `/messages/${ID.c}`, { token: T.a, body: { content: 'hi C' } });
  check('nobody → 403', r.status === 403, r);
  r = await call('GET', `/messages/can-message/${ID.c}`, { token: T.a });
  check('can-message reports reason', r.data?.canMessage === false && !!r.data?.reason);
  r = await call('POST', `/messages/${ID.a}`, { token: T.c, body: { content: 'hi A from C' } });
  check('C can still message A', r.status === 201);
  r = await call('POST', `/messages/${ID.c}`, { token: T.a, body: { content: 'reply to C' } });
  check('A may reply inside conversation C started', r.status === 201, r);
  r = await call('GET', '/messages/unread-count', { token: T.c });
  check('C unread = 1', r.data?.count === 1, r.data);
  r = await call('GET', '/messages/conversations', { token: T.c });
  check('conversation unreadCount', r.data?.find((cv) => cv.user.id === ID.a)?.unreadCount === 1);
  r = await call('GET', `/messages/${ID.a}`, { token: T.c });
  r = await call('GET', '/messages/unread-count', { token: T.c });
  check('opening chat marks read', r.data?.count === 0);
  r = await call('GET', `/messages/${ID.c}`, { token: T.a });
  check('sender sees readAt (Seen)', r.data?.some((m) => m.content === 'reply to C' && m.readAt), r.data);
  r = await call('GET', `/messages/info/${ID.a}`, { token: T.c });
  check('chat info presence + canMessage', r.data?.canMessage === true && r.data?.isOnline === true, r.data);
  await call('PATCH', '/users/me/settings', { token: T.a, body: { showActivityStatus: false } });
  r = await call('GET', `/messages/info/${ID.a}`, { token: T.c });
  check('activity status hidden when off', r.data?.isOnline === false && r.data?.lastActiveAt === null, r.data);
  await call('PATCH', '/users/me/settings', { token: T.a, body: { showActivityStatus: true } });

  console.log('block');
  r = await call('POST', `/users/${ID.c}/block`, { token: T.a });
  check('A blocks C', r.data?.isBlocked === true);
  r = await call('GET', `/users/${ID.a}`, { token: T.c });
  check('blocked user sees 404 profile', r.status === 404);
  r = await call('GET', `/users/${ID.c}`, { token: T.a });
  check('blocker sees isBlocked & no content', r.data?.isBlocked === true && r.data?.canViewContent === false);
  r = await call('POST', `/messages/${ID.a}`, { token: T.c, body: { content: 'x' } });
  check('blocked user cannot message', r.status === 403);
  r = await call('POST', `/follows/${ID.a}`, { token: T.c });
  check('blocked user cannot follow', r.status === 403);
  r = await call('GET', `/users/search?q=${U.a.username}`, { token: T.c });
  check('blocker hidden from search', Array.isArray(r.data) && !r.data.some((u) => u.id === ID.a));
  r = await call('POST', `/likes/${ap1.id}`, { token: T.c });
  check('blocked user cannot like', r.status === 404);
  r = await call('GET', '/users/me/blocked', { token: T.a });
  check('blocked list', r.data?.some((u) => u.id === ID.c));
  r = await call('DELETE', `/users/${ID.c}/block`, { token: T.a });
  check('unblock', r.data?.isBlocked === false);
  r = await call('POST', '/users/me/relations/import', { token: T.a, body: { blocked: [ID.c, 'x'], muted: [ID.b] } });
  check('import local block/mute lists', r.data?.blocked === 1 && r.data?.muted === 1, r.data);
  await call('DELETE', `/users/${ID.c}/block`, { token: T.a });
  await call('DELETE', `/users/${ID.b}/mute`, { token: T.a });

  console.log('remove follower');
  r = await call('DELETE', `/follows/followers/${ID.b}`, { token: T.a });
  r = await call('GET', `/follows/check/${ID.a}`, { token: T.b });
  check('B no longer follows A', r.data?.isFollowing === false);

  console.log('sessions');
  const oldA = T.a;
  r = await call('POST', '/auth/logout-all', { token: T.a });
  check('logout-all returns new token', r.status === 200 && r.data?.accessToken && r.data.accessToken !== oldA);
  T.a = r.data.accessToken;
  r = await call('GET', '/users/me', { token: oldA });
  check('old token rejected after logout-all', r.status === 401);
  r = await call('GET', '/users/me', { token: T.a });
  check('new token works', r.status === 200);
  r = await call('POST', '/auth/change-password', { token: T.a, body: { currentPassword: 'secret123', newPassword: 'secret456' } });
  check('change password returns token', r.status === 200 && !!r.data?.accessToken, r);
  const beforePw = T.a; T.a = r.data.accessToken;
  r = await call('GET', '/users/me', { token: beforePw });
  check('pre-change token rejected', r.status === 401);
  U.a.password = 'secret456';

  console.log('email change');
  r = await call('PATCH', '/auth/email', { token: T.a, body: { email: U.b.email, password: 'secret456' } });
  check('email taken → 409', r.status === 409);
  r = await call('PATCH', '/auth/email', { token: T.a, body: { email: `t2_new_${stamp}@example.com`, password: 'wrong' } });
  check('wrong password → 400', r.status === 400);
  r = await call('PATCH', '/auth/email', { token: T.a, body: { email: `T2_New_${stamp}@Example.com`, password: 'secret456' } });
  check('email changed (lowercased)', r.data?.email === `t2_new_${stamp}@example.com`, r.data);
  U.a.email = `t2_new_${stamp}@example.com`;

  console.log('2FA');
  r = await call('POST', '/auth/2fa/setup', { token: T.a });
  check('setup returns secret + otpauth', r.data?.secret && r.data?.otpauthUrl?.startsWith('otpauth://totp/'), r.data);
  const secret = r.data.secret;
  r = await call('POST', '/auth/2fa/enable', { token: T.a, body: { code: '000000' } });
  check('wrong code rejected', r.status === 400);
  r = await call('POST', '/auth/2fa/enable', { token: T.a, body: { code: totp(secret) } });
  check('enable with valid code → 8 recovery codes', r.status === 200 && r.data?.recoveryCodes?.length === 8, r);
  const recovery = r.data.recoveryCodes;
  r = await call('GET', '/auth/2fa', { token: T.a });
  check('status enabled', r.data?.enabled === true && r.data?.recoveryCodesRemaining === 8);
  r = await call('POST', '/auth/login', { body: { email: U.a.email, password: U.a.password } });
  check('login now requires 2FA', r.data?.twoFactorRequired === true && !r.data?.accessToken && !!r.data?.challengeToken, r.data);
  const challenge = r.data.challengeToken;
  r = await call('GET', '/users/me', { token: challenge });
  check('challenge token is not a session', r.status === 401);
  r = await call('POST', '/auth/2fa/verify', { body: { challengeToken: challenge, code: '123456' } });
  check('verify wrong code → 401', r.status === 401);
  r = await call('POST', '/auth/2fa/verify', { body: { challengeToken: challenge, code: totp(secret) } });
  check('verify TOTP → session', r.status === 200 && !!r.data?.accessToken, r);
  r = await call('POST', '/auth/login', { body: { email: U.a.email, password: U.a.password } });
  r = await call('POST', '/auth/2fa/verify', { body: { challengeToken: r.data.challengeToken, code: recovery[0] } });
  check('recovery code works', r.status === 200 && !!r.data?.accessToken, r);
  T.a = r.data.accessToken;
  r = await call('POST', '/auth/login', { body: { email: U.a.email, password: U.a.password } });
  r = await call('POST', '/auth/2fa/verify', { body: { challengeToken: r.data.challengeToken, code: recovery[0] } });
  check('recovery code is single-use', r.status === 401);
  r = await call('POST', '/auth/2fa/disable', { token: T.a, body: { password: U.a.password, code: totp(secret) } });
  check('disable 2FA', r.status === 200, r);
  r = await call('POST', '/auth/login', { body: { email: U.a.email, password: U.a.password } });
  check('login without 2FA again', !!r.data?.accessToken);
  T.a = r.data.accessToken;

  console.log('export');
  r = await call('GET', '/users/me/export', { token: T.a });
  check('export has profile/posts', r.data?.profile?.id === ID.a && Array.isArray(r.data?.posts) && r.data.posts.length >= 1, r.data);
} catch (e) {
  fail++;
  console.error('ERROR', e);
} finally {
  console.log('cleanup');
  for (const k of Object.keys(T)) {
    if (T[k]) console.log('  delete', k, (await call('DELETE', '/users/me', { token: T[k] })).status);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
