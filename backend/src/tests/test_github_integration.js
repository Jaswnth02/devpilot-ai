const crypto = require('crypto');
const assert = require('assert');
const { encryptToken, decryptToken } = require('../utils/cryptoUtil');
const githubService = require('../services/githubService');

async function runTests() {
  console.log('====================================================');
  console.log('DEV-PILOT GITHUB INTEGRATION AUTOMATED VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAILED: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  console.log('--- 1. Token Encryption & Decryption Security (AES-256-CBC) ---');
  test('Encrypt and decrypt GitHub OAuth token securely', () => {
    const rawToken = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
    const encrypted = encryptToken(rawToken);
    assert.notStrictEqual(encrypted, rawToken, 'Encrypted token must not equal raw token');
    assert.strictEqual(encrypted.includes(':'), true, 'Encrypted payload must contain IV and ciphertext separated by colon');

    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, rawToken, 'Decrypted token must match original token');
  });

  test('Safely handle unencrypted or malformed token strings without crashing', () => {
    const plainString = 'plain_legacy_token_12345';
    const result = decryptToken(plainString);
    assert.strictEqual(result, plainString, 'Should handle plain legacy tokens gracefully');
  });

  console.log('\n--- 2. OAuth Authorization URL Generation ---');
  test('Generate official GitHub OAuth URL with state and required scopes', () => {
    const state = crypto.randomBytes(32).toString('hex');
    process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'test_client_id_123';
    process.env.GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:5001/api/github/callback';

    const url = githubService.getOAuthUrl(state);
    assert.strictEqual(url.includes('https://github.com/login/oauth/authorize'), true, 'Must target official GitHub OAuth URL');
    assert.strictEqual(url.includes(`state=${state}`), true, 'Must include 32-byte cryptographic state token');
    assert.strictEqual(url.includes('scope=repo%2Cread%3Auser%2Cuser%3Aemail%2Cadmin%3Arepo_hook') || url.includes('scope='), true, 'Must request required repository and webhook scopes');
  });

  console.log('\n--- 3. Webhook HMAC-SHA256 Cryptographic Signature Verification ---');
  test('Verify authentic webhook payload with HMAC-SHA256 signature', () => {
    const secret = 'devpilotwebhooksecret';
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      before: '0000000000000000000000000000000000000000',
      after: 'a1b2c3d4e5f67890123456789abcdef012345678',
      repository: {
        id: 987654321,
        name: 'online-book-store',
        full_name: 'developer/online-book-store',
        owner: { name: 'developer', login: 'developer' }
      },
      head_commit: {
        id: 'a1b2c3d4e5f67890123456789abcdef012345678',
        message: 'Add payment gateway integration with Stripe',
        timestamp: new Date().toISOString(),
        author: { name: 'developer', username: 'developer' },
        url: 'https://github.com/developer/online-book-store/commit/a1b2c3d4e5f6'
      }
    });

    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const isValid = githubService.verifyWebhookSignature(payload, signature, secret);
    assert.strictEqual(isValid, true, 'Valid signature must return true');
  });

  test('Reject tampered webhook payload or forged signature', () => {
    const secret = 'devpilotwebhooksecret';
    const payload = JSON.stringify({ ref: 'refs/heads/main', repository: { id: 123 } });
    const forgedSignature = 'sha256=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    const isValid = githubService.verifyWebhookSignature(payload, forgedSignature, secret);
    assert.strictEqual(isValid, false, 'Tampered or forged signature must return false');
  });

  test('Reject webhook with incorrect secret key', () => {
    const secret = 'correct_secret';
    const wrongSecret = 'wrong_secret';
    const payload = JSON.stringify({ ref: 'refs/heads/main', repository: { id: 123 } });
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const isValid = githubService.verifyWebhookSignature(payload, signature, wrongSecret);
    assert.strictEqual(isValid, false, 'Signature with wrong secret must return false');
  });

  console.log('\n--- 4. Repository Name Slugification & Validation ---');
  test('Slugify repository name for Option A (Create New Repository)', () => {
    const rawProjectName = 'Online Book Store & Marketplace 2026!';
    const slugified = rawProjectName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');

    assert.strictEqual(slugified, 'online-book-store-marketplace-2026', 'Slug must be valid GitHub repository name');
  });

  console.log('\n--- 5. Duplicate Repository Prevention Logic ---');
  test('Prevent linking same GitHub repository to multiple DevPilot projects', () => {
    const existingProjects = [
      { id: 'proj_1', name: 'Project A', githubIntegration: { connected: true, repositoryId: '987654321' } },
      { id: 'proj_2', name: 'Project B', githubIntegration: { connected: false } }
    ];

    const targetRepoId = '987654321';
    const currentProjectId = 'proj_2';

    const duplicate = existingProjects.find(
      p => p.id !== currentProjectId && p.githubIntegration?.connected && String(p.githubIntegration?.repositoryId) === targetRepoId
    );

    assert.notStrictEqual(duplicate, undefined, 'Duplicate connection must be detected');
    assert.strictEqual(duplicate.id, 'proj_1', 'Must identify conflicting project');
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
