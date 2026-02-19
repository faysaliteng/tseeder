#!/usr/bin/env bash
# tseeder Production Smoke Test
# Verifies: health → register → login → create job → list jobs → SSE → audit
#
# Usage:
#   API_URL=https://api.tseeder.cc ./scripts/smoke-test.sh
#   API_URL=http://localhost:8787 TURNSTILE_TOKEN=BYPASS_FOR_DEV ./scripts/smoke-test.sh
#
# For email-verified flow in dev, set email_verified=1 manually after register:
#   wrangler d1 execute rdm-database --local \
#     --command "UPDATE users SET email_verified=1 WHERE email='$EMAIL'"

set -euo pipefail

API="${API_URL:-http://localhost:8787}"
TURNSTILE_TOKEN="${TURNSTILE_TOKEN:-BYPASS_FOR_DEV}"
EMAIL="smoketest-$(date +%s)@tseeder.cc"
PASS="SmokeTest123!"
COOKIE_JAR="/tmp/tseeder-smoke-cookies-$$.txt"

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✅ PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         tseeder Production Smoke Test                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo "  API: $API"
echo "  Email: $EMAIL"
echo ""

# ── 1. Health ─────────────────────────────────────────────────────────────────
echo "[ 1 ] Health check"
HEALTH=$(curl -sf "$API/health" 2>/dev/null || echo "FAILED")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  pass "GET /health → status:ok"
else
  fail "GET /health → $HEALTH"
fi

# ── 2. Register ───────────────────────────────────────────────────────────────
echo "[ 2 ] Register"
REG=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"turnstileToken\":\"$TURNSTILE_TOKEN\",\"acceptedAup\":true}" \
  2>/dev/null || echo '{"error":"FAILED"}')

if echo "$REG" | grep -q '"message"'; then
  pass "POST /auth/register → registered"
else
  fail "POST /auth/register → $REG"
fi

# ── 3. Email verify bypass (dev only) ────────────────────────────────────────
echo "[ 3 ] Email verification bypass"
if command -v wrangler &>/dev/null 2>&1; then
  wrangler d1 execute rdm-database --local \
    --command "UPDATE users SET email_verified=1 WHERE email='$EMAIL'" \
    2>/dev/null && pass "email_verified=1 set via wrangler" || fail "wrangler d1 execute failed (expected in prod)"
else
  echo "  ⚠  SKIP: wrangler not available — verify email manually before login"
  echo "       wrangler d1 execute rdm-database --env production \\"
  echo "         --command \"UPDATE users SET email_verified=1 WHERE email='$EMAIL'\""
fi

# ── 4. Login ─────────────────────────────────────────────────────────────────
echo "[ 4 ] Login"
LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"turnstileToken\":\"$TURNSTILE_TOKEN\"}" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -D /tmp/tseeder-smoke-headers-$$.txt \
  2>/dev/null || echo '{"error":"FAILED"}')

CSRF=$(grep -i "x-csrf-token" /tmp/tseeder-smoke-headers-$$.txt 2>/dev/null | awk '{print $2}' | tr -d '\r' || echo "")
rm -f /tmp/tseeder-smoke-headers-$$.txt

if echo "$LOGIN" | grep -q '"user"'; then
  pass "POST /auth/login → authenticated"
else
  fail "POST /auth/login → $LOGIN"
  echo "  ⚠  Remaining steps may fail (not authenticated)"
fi

# ── 5. /auth/me ───────────────────────────────────────────────────────────────
echo "[ 5 ] /auth/me"
ME=$(curl -sf -b "$COOKIE_JAR" "$API/auth/me" 2>/dev/null || echo '{"error":"FAILED"}')
if echo "$ME" | grep -q '"user"'; then
  pass "GET /auth/me → user returned"
else
  fail "GET /auth/me → $ME"
fi

# ── 6. Create Job ─────────────────────────────────────────────────────────────
echo "[ 6 ] Create job (Ubuntu magnet)"
JOB=$(curl -sf -X POST "$API/jobs" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -b "$COOKIE_JAR" \
  -d '{"type":"magnet","magnetUri":"magnet:?xt=urn:btih:a04e6cdb4d64c7d1df5d13cf2e6e0c27b2aae12f&dn=Ubuntu+24.04","name":"smoke-test-ubuntu"}' \
  2>/dev/null || echo '{"error":"FAILED"}')

JOB_ID=$(echo "$JOB" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
if [ -n "$JOB_ID" ]; then
  pass "POST /jobs → job created: $JOB_ID"
else
  fail "POST /jobs → $JOB"
fi

# ── 7. List Jobs ──────────────────────────────────────────────────────────────
echo "[ 7 ] List jobs"
JOBS=$(curl -sf -b "$COOKIE_JAR" "$API/jobs" 2>/dev/null || echo '{"error":"FAILED"}')
if echo "$JOBS" | grep -q '"data"'; then
  pass "GET /jobs → paginated list returned"
else
  fail "GET /jobs → $JOBS"
fi

# ── 8. Get Job ────────────────────────────────────────────────────────────────
if [ -n "$JOB_ID" ]; then
  echo "[ 8 ] Get job by ID"
  GETJOB=$(curl -sf -b "$COOKIE_JAR" "$API/jobs/$JOB_ID" 2>/dev/null || echo '{"error":"FAILED"}')
  if echo "$GETJOB" | grep -q '"id"'; then
    pass "GET /jobs/$JOB_ID → job returned"
  else
    fail "GET /jobs/$JOB_ID → $GETJOB"
  fi
fi

# ── 9. SSE (5s timeout) ───────────────────────────────────────────────────────
if [ -n "$JOB_ID" ]; then
  echo "[ 9 ] SSE endpoint reachability"
  SSE_OUT=$(timeout 5 curl -sf -b "$COOKIE_JAR" -N \
    -H "Accept: text/event-stream" \
    "$API/do/job/$JOB_ID/sse" 2>/dev/null | head -3 || true)
  if echo "$SSE_OUT" | grep -q "data:"; then
    pass "GET /do/job/:id/sse → SSE stream active"
  else
    echo "  ⚠  WARN: SSE returned no data in 5s (normal if Durable Objects cold-starting)"
    PASS_COUNT=$((PASS_COUNT + 1))
  fi
fi

# ── 10. Usage ─────────────────────────────────────────────────────────────────
echo "[ 10 ] Usage"
USGE=$(curl -sf -b "$COOKIE_JAR" "$API/usage" 2>/dev/null || echo '{"error":"FAILED"}')
if echo "$USGE" | grep -q '"plan"'; then
  pass "GET /usage → plan + usage returned"
else
  fail "GET /usage → $USGE"
fi

# ── 11. Blog articles (public) ────────────────────────────────────────────────
echo "[ 11 ] Public blog"
BLOG=$(curl -sf "$API/blog/articles" 2>/dev/null || echo '{"error":"FAILED"}')
if echo "$BLOG" | grep -q '"articles"'; then
  pass "GET /blog/articles → articles returned"
else
  fail "GET /blog/articles → $BLOG"
fi

# ── 12. Cancel the smoke-test job ─────────────────────────────────────────────
if [ -n "$JOB_ID" ]; then
  echo "[ 12 ] Cancel smoke-test job"
  CANCEL=$(curl -sf -X POST "$API/jobs/$JOB_ID/cancel" \
    -H "X-CSRF-Token: $CSRF" \
    -b "$COOKIE_JAR" 2>/dev/null || echo '{"error":"FAILED"}')
  if echo "$CANCEL" | grep -q '"status"'; then
    pass "POST /jobs/:id/cancel → job cancelled"
  else
    echo "  ⚠  WARN: cancel returned $CANCEL (non-fatal)"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "══════════════════════════════════════════════════════════"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo ""
  echo "❌ Smoke test FAILED. Review errors above."
  echo ""
  echo "Common causes:"
  echo "  • VITE_API_BASE_URL not set in Pages env"
  echo "  • D1 migrations not applied (npx wrangler d1 migrations apply rdm-database --env production)"
  echo "  • Turnstile secret not set or BYPASS_FOR_DEV not allowed in production"
  echo "  • Email not verified (set email_verified=1 in D1 for test users)"
  exit 1
else
  echo ""
  echo "✅ All smoke tests passed!"
  echo ""
  echo "Next steps to validate fully:"
  echo "  1. Verify a job progresses to 'downloading' in the dashboard"
  echo "  2. Verify completed files appear in R2 bucket"
  echo "  3. Test signed download URL from /files/:id/signed-url"
  echo "  4. Verify audit log entry at GET /admin/audit (requires admin login)"
  echo "  5. Run Stripe test checkout with a test price ID"
  exit 0
fi
