// API smoke tests (auth, users, posts, comments, notifications).
// Needs the backend running (API env var, default http://localhost:3000)
// and the database up. Creates throwaway users and deletes them at the end.
// Run: npm run test:api
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
  else { fail++; console.log('  FAIL ', name, extra); }
}

const a = { email: `smoke_a_${stamp}@example.com`, username: `smoke_a_${stamp}`, password: 'secret123', name: 'Smoke A' };
const b = { email: `smoke_b_${stamp}@example.com`, username: `smoke_b_${stamp}`, password: 'secret123', name: 'Smoke B' };
let ta, tb, ida, idb;

try {
  console.log('auth');
  let r = await call('POST', '/auth/register', { body: { ...a, email: 'not-an-email' } });
  check('register rejects bad email (400)', r.status === 400, JSON.stringify(r));
  r = await call('POST', '/auth/register', { body: { ...a, password: '123' } });
  check('register rejects short password (400)', r.status === 400);
  r = await call('POST', '/auth/register', { body: a });
  check('register returns accessToken', r.status === 201 && !!r.data?.accessToken, JSON.stringify(r));
  ta = r.data?.accessToken; ida = r.data?.user?.id;
  r = await call('POST', '/auth/register', { body: { ...a, email: `other_${stamp}@example.com`, username: a.username.toUpperCase() } });
  check('register rejects duplicate username, case-insensitive (409)', r.status === 409, JSON.stringify(r));
  r = await call('POST', '/auth/register', { body: b });
  tb = r.data?.accessToken; idb = r.data?.user?.id;
  check('second user registered', !!tb);

  r = await call('POST', '/auth/login', { body: { email: a.email, password: 'wrong' } });
  check('login wrong password -> 401', r.status === 401);
  r = await call('POST', '/auth/login', { body: { email: a.email.toUpperCase(), password: a.password } });
  check('login is case-insensitive on email', r.status === 201 && !!r.data?.accessToken, JSON.stringify(r));

  r = await call('POST', '/auth/change-password', { token: ta, body: { currentPassword: 'nope', newPassword: 'another1' } });
  check('change-password wrong current -> 400 (not 401)', r.status === 400);

  console.log('users');
  r = await call('GET', '/users/99999999', { token: ta });
  check('unknown user -> 404', r.status === 404);
  r = await call('GET', '/users/suggestions', { token: ta });
  check('suggestions returns list', r.status === 200 && Array.isArray(r.data), JSON.stringify(r).slice(0, 200));
  check('suggestions excludes self', Array.isArray(r.data) && !r.data.some((u) => u.id === ida));
  r = await call('PATCH', '/users/me', { token: ta, body: { username: 'x' } });
  check('profile rejects invalid username (400)', r.status === 400);
  r = await call('GET', `/users/search?q=${encodeURIComponent(b.username)}`, { token: ta });
  check('search finds user B first', r.status === 200 && r.data?.[0]?.id === idb);

  console.log('follows + notifications');
  r = await call('POST', `/follows/${idb}`, { token: ta });
  check('A follows B', r.status === 201, JSON.stringify(r));
  r = await call('GET', '/notifications/unread-count', { token: tb });
  check('B got a follow notification', r.data?.count >= 1 && r.data?.byType?.follow >= 1, JSON.stringify(r.data));
  r = await call('GET', `/follows/followers/${idb}`, { token: tb });
  check('followers list includes A with isFollowing=false', r.data?.some((u) => u.id === ida && u.isFollowing === false), JSON.stringify(r.data));
  r = await call('GET', '/users/suggestions', { token: tb });
  check('B suggestions rank A first (follows you)', r.data?.[0]?.id === ida && r.data?.[0]?.followsYou === true);

  console.log('posts');
  r = await call('POST', '/posts', { token: ta, body: { title: '   ' } });
  check('empty post rejected (400)', r.status === 400);
  r = await call('POST', '/posts', { token: ta, body: { title: 'Hello smoke', content: 'body', fontSize: '24' } });
  check('create post with string fontSize', r.status === 201 && r.data?.post?.fontSize === 24, JSON.stringify(r));
  const postId = r.data?.post?.id;
  r = await call('GET', `/posts/${postId}`, { token: tb });
  check('GET /posts/:id works', r.status === 200 && r.data?.id === postId && r.data?.author?.id === ida, JSON.stringify(r).slice(0, 200));
  r = await call('GET', '/posts/99999999', { token: tb });
  check('GET unknown post -> 404', r.status === 404);
  r = await call('POST', `/likes/${postId}`, { token: tb });
  r = await call('GET', `/posts/user/${ida}`, { token: tb });
  check('user posts report isLiked for viewer', r.data?.[0]?.isLiked === true && r.data?.[0]?.likesCount === 1, JSON.stringify(r.data?.[0]).slice(0, 200));
  r = await call('GET', '/posts?scope=following&limit=5', { token: tb });
  check('following feed only has followed authors/self', r.status === 200 && r.data.posts.every((p) => [ida, idb].includes(p.repostedBy?.id ?? p.authorId)), JSON.stringify(r.data?.pagination));
  r = await call('GET', '/posts?scope=following', { token: ta });
  check('A following feed contains own post', r.data?.posts?.some((p) => p.id === postId));
  r = await call('GET', '/posts?limit=2', { token: ta });
  check('pagination totalCount is a number', typeof r.data?.pagination?.totalCount === 'number' && r.data.pagination.totalCount >= 1, JSON.stringify(r.data?.pagination));

  console.log('comments');
  r = await call('POST', `/comments/${postId}`, { token: tb, body: { content: '   ' } });
  check('empty comment rejected (400)', r.status === 400);
  r = await call('POST', `/comments/${postId}`, { token: tb, body: { content: 'first' } });
  const c1 = r.data?.comment?.id;
  await call('POST', `/comments/${postId}`, { token: tb, body: { content: 'second' } });
  r = await call('GET', `/comments/${postId}`, { token: ta });
  check('comments oldest first', r.data?.comments?.[0]?.content === 'first');
  r = await call('DELETE', `/comments/${c1}`, { token: ta });
  check('post owner can delete a comment on their post', r.status === 200, JSON.stringify(r));

  console.log('notifications admin');
  r = await call('PATCH', '/notifications/read-all?type=comment', { token: ta });
  r = await call('GET', '/notifications/unread-count', { token: ta });
  check('read-all?type=comment clears only comments', !r.data?.byType?.comment && r.data?.byType?.like >= 1, JSON.stringify(r.data));
  r = await call('DELETE', '/notifications', { token: ta });
  r = await call('GET', '/notifications', { token: ta });
  check('clear all notifications', Array.isArray(r.data) && r.data.length === 0);
} catch (e) {
  fail++;
  console.error('ERROR', e);
} finally {
  console.log('cleanup');
  if (ta) console.log('  delete A', (await call('DELETE', '/users/me', { token: ta })).status);
  if (tb) console.log('  delete B', (await call('DELETE', '/users/me', { token: tb })).status);
  if (ta) {
    const r = await call('GET', '/users/me', { token: ta });
    check('deleted account token -> 401 on /users/me', r.status === 401);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
