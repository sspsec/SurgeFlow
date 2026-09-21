// Surge 面板脚本：本机网络、国内出口与 DNS/DoH 健康状态。
;(async () => {
  const v4 = $network.v4 || {}
  const interfaceName = v4.primaryInterface || "N/A"
  const address = v4.primaryAddress || "无网络"
  const router = v4.primaryRouter || "无路由"
  const dnsServers = ($network.dns || [])
    .map(item => typeof item === "string" ? item : (item.address || item.server || ""))
    .filter(Boolean)
    .slice(0, 2)
    .join(", ") || "未获取"

  const apiGet = (path, body = {}) => new Promise(resolve => {
    $httpAPI("GET", path, body, result => resolve(result || {}))
  })

  const probe = options => new Promise(resolve => {
    const started = Date.now()
    $httpClient.get(options, (error, response) => {
      const status = response && (response.status || response.statusCode)
      resolve({
        ok: !error && (status === 200 || status === 204),
        ms: Date.now() - started,
        status: status || 0,
      })
    })
  })

  const [domestic, direct, doh] = await Promise.all([
    apiGet("/v1/policy_groups/select", { group_name: "国内直连" }),
    probe({ url: "http://connectivitycheck.platform.hicloud.com/generate_204", timeout: 5 }),
    probe({
      url: "https://doh.pub/dns-query?name=example.com&type=A",
      headers: { Accept: "application/dns-json" },
      timeout: 5,
    }),
  ])

  const formatProbe = (name, result) => result.ok
    ? `${name} ✓ ${result.ms}ms`
    : `${name} ✗ ${result.status || "超时"}`
  const healthy = direct.ok && doh.ok
  const degraded = direct.ok || doh.ok

  $done({
    title: healthy ? "网络健康 · 正常" : degraded ? "网络健康 · 降级" : "网络健康 · 异常",
    content: [
      `接口: ${interfaceName} · ${address}`,
      `路由: ${router} · 国内出口: ${domestic.policy || "未知"}`,
      `DNS: ${dnsServers}`,
      `${formatProbe("直连", direct)} · ${formatProbe("DoH", doh)}`,
    ].join("\n"),
    style: healthy ? "good" : degraded ? "alert" : "error",
    icon: healthy ? "checkmark.circle.fill" : "exclamationmark.triangle.fill",
    "icon-color": healthy ? "#34C759" : degraded ? "#FF9500" : "#FF3B30",
  })
})()
