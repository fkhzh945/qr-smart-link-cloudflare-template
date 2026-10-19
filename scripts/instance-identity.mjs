// Resolve a stable, verified identifier; never derive it from per-build UUIDs.
export function identityFromBuildMetadata(metadata) {
  const build = metadata?.result;
  const tag = build?.trigger?.external_script_id;
  if (typeof tag !== 'string' || !/^[a-f0-9]{32}$/i.test(tag))
    throw new Error('Cloudflare build metadata contains no verified Worker tag');
  return 'worker-tag:' + tag.toLowerCase();
}
export async function resolveInstanceIdentity(env, { preview = false, fetchFn = fetch } = {}) {
  const explicit = env.QR_TEMPLATE_INSTANCE_ID?.trim();
  if (explicit) return { key: explicit, source: 'explicit' };
  // Local config lint does not require Cloudflare identity.
  if (preview) return { key: '', source: 'preview' };
  if (!env.WORKERS_CI) return { key: '', source: 'legacy-local' };
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  const uuid = env.WORKERS_CI_BUILD_UUID;
  if (!/^[a-f0-9]{32}$/i.test(account ?? '') ||
      !/^[a-f0-9-]{36}$/i.test(uuid ?? '') || !token)
    throw new Error('Missing Cloudflare account, current build UUID or authorized metadata token. Refusing to share a D1 database.');
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/builds/builds/${uuid}`;
  const response = await fetchFn(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Cannot verify Worker identity from Cloudflare Builds API (HTTP ' + response.status + ')');
  const data = await response.json();
  if (!data.success) throw new Error('Cloudflare Builds metadata lookup failed');
  return { key: identityFromBuildMetadata(data), source: 'worker-tag' };
}
