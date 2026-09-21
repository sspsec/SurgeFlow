# SurgeFlow

> macOS Surge 5 双网卡分流配置：办公/隐私双出口隔离、在线规则自动更新、钓鱼拦截、网络健康面板。

## 简介

SurgeFlow 是一套面向 macOS Surge 5 的分流配置。它不把国内流量笼统丢给 DIRECT，而是将两条物理网卡定义为独立通道——办公有线与无线热点各走各路，办公类应用（微信、钉钉、腾讯会议）固定走有线，娱乐类应用（B站、网易云、淘宝）走热点，实现网络层面的隔离；配合全量在线规则集自动分流、假节点正则过滤、钓鱼域名拦截与网络健康面板，导入即用。

主要特点：

1. 国内流量区分办公与娱乐两类用途，分别经由独立物理出口（有线网卡 / 无线热点）转发，实现通道隔离；
2. 全部规则采用在线规则集，自动更新，本地仅保留少量自定义条目；
3. 内置钓鱼域名拦截层，直接拒绝，不设置豁免出口；
4. 内置「网络健康」面板脚本，实时显示本机接口、国内出口与 DNS/DoH 状态；
5. 隐私防护：启用 DoH 加密域名解析，关闭 MITM 解密功能，HTTP API 限定本机回环访问。

## 一、通道架构

本配置不使用笼统的 DIRECT 策略承载国内直连流量，而是定义两条绑定了具体网卡的物理通道：

| 通道名称 | 绑定接口 | 用途 | 说明 |
|---|---|---|---|
| 办公有线 | en9（USB 有线网卡） | 微信、钉钉、腾讯会议等办公应用 | 保障办公流量稳定性 |
| 隐私直连 | en0（无线网卡/热点） | 网易云音乐、B站、淘宝等娱乐应用 | 娱乐流量与办公网络隔离 |

`国内直连` 为 fallback 组，切换顺序为：办公有线 → 移动热点 → DIRECT。有线网络中断时自动降级，无需人工干预。`interval=10`、`timeout=2` 收紧了检测窗口，接口拔线后能更快切走，避免国内流量被派给已断开的接口。

## 二、策略组结构

全部策略组共 36 个，统一使用在线图标（Koolson Qure / fmz200 图库），组名不含 emoji：

```
基础设施    机场节点（订阅） · 广告拦截 · 隐私直连(en0) · 国内直连(en9→en0 fallback)
核心出口    节点选择 · 自动选择(url-test，排除假节点)
地区分组    香港节点 · 新加坡节点 · 日本节点 · 美国节点 · 台湾节点 · 韩国节点
            全部节点（展开订阅全量，任意国家/地区可直接挑选）
国内办公    微信 · 钉钉 · 腾讯QQ · 腾讯会议 · 文档/飞书        （默认国内直连）
国内娱乐    网易云音乐 · 国内视频 · 抖音/快手 · 淘宝/京东
            Steam/游戏 · 知乎/微博                              （默认隐私直连）
国外应用    AI 服务 · Netflix · YouTube · TikTok · Spotify · Telegram
            Microsoft · GitHub · Apple · Porn                   （默认节点选择）
工具兜底    网络测速 · 漏网之鱼
```

各类应用默认出口不同，可在面板中随时切换。

<img width="1182" height="862" alt="image" src="https://github.com/user-attachments/assets/44629c69-b56f-4504-8abb-83d8b59a8cdd" />


## 三、主要功能说明

### 3.1 钓鱼域名拦截

引入 phishing.army extended 规则库（含 12 万余条钓鱼域名，每日更新），命中即 REJECT。该规则直接拒绝连接，不经过可手动切换的"广告拦截"策略组，确保钓鱼域名不存在豁免出口。

### 3.2 假节点过滤

机场订阅中普遍存在"直连测试""官网""剩余流量"以及公告、群组、V6 说明等假节点，此类节点对测速地址响应延迟极低但不实际代理，会干扰 url-test 的测速结果。为此，`机场节点`（订阅源）、`自动选择` 与 `节点选择` 三处均配置如下正则过滤，从源头过滤后下游策略组全部继承：

```ini
policy-regex-filter=(?i)^(?!.*(?:直连|官网|到期|剩余|流量|重置|群组|公告|订阅|v6|4g|5g)).*$
```

同时配合 `tolerance=50`，避免在延迟接近的节点间频繁切换。

### 3.3 校园网与 VPN 兼容

内网网段已从 TUN 接管范围中排除，避免与 EasyConnect 全隧道 VPN 冲突导致断网；EasyConnect、mihomo 等代理客户端进程在规则最前部强制直连。DNS 配置以 `system` 优先，接入内网时自动使用内网 DNS 解析内网业务域名，离开内网后回退公网 DNS，配置中不硬编码任何内网地址。

相关关键参数：

```ini
tun-excluded-routes = 172.16.0.0/12, 10.0.0.0/8, 192.168.0.0/16
dns-server = system, 223.5.5.5, 119.29.29.29
```

### 3.4 隐私防护

| 措施 | 说明 |
|---|---|
| DoH 加密 DNS | 出网域名查询经 https://dns.alidns.com 加密传输，内网域名走 [Host] 不受影响 |
| hijack-dns | 接管硬编码公共 DNS（8.8.8.8 / 1.1.1.1 等）的应用请求，防止绕过 |
| MITM 关闭 | 无解密需求，不留存证书数据 |
| always-real-ip | STUN/NAT 检测请求直通，保障游戏联机与视频通话 P2P 质量 |
| HTTP API 仅回环 | 仅 127.0.0.1 可访问，供脚本查询实时连接 |

### 3.5 网络健康面板

`[Script]` 与 `[Panel]` 定义了一个每 60 秒刷新的面板，内容包括：当前网络接口与 IP、`国内直连` 组实际选中的出口、直连与 DoH 探测延迟，并按状态显示「正常 / 降级 / 异常」。脚本为仓库中的 `network_health.js`。

### 3.6 规则去重

AI 分流原采用 skk-moe ai.conf，后引入 666OS 的 AI / OpenAI / Gemini / Claude 规则。删除重复规则集前已逐项比对，针对 666OS 未收录的站点（Poe、Perplexity、x.ai、Grok、Groq、OpenRouter、Cursor、meta.ai、Sora）保留手动规则共 9 条，覆盖无损失。

## 四、规则来源

规则按匹配优先级排列，均为在线规则，自动更新：

| 优先级 | 来源 | 内容 |
|---|---|---|
| 0 | 本地自定义 | 内网域名直连、代理客户端进程直连 |
| 1 | [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) | 微信、钉钉、B站、爱奇艺、抖音、Steam、Epic、微博、知乎等分类规则 |
| 2 | [skk-moe RuleSets](https://ruleset.skk.moe) | 网易云音乐、流媒体、Telegram、Apple/Microsoft CDN、通用兜底 |
| 3 | [phishing.army](https://phishing.army) | 钓鱼域名拦截（REJECT） |
| 4 | [666OS/rules](https://github.com/666OS/rules) | 广告/追踪、AI 四件套、流媒体、Telegram、Apple、Games 等 35 条 |
| 5 | 本地补充 | 666OS 未收录的小众 AI 站点 |
| 6 | GEOIP | LAN 直连、GEOIP CN |
| 7 | 兜底 | 漏网之鱼 |

## 五、使用方法

1. 将 `机场节点` 策略组中的 `policy-path`（`<你的订阅转换链接>` 占位处）替换为本人订阅链接，保留 `emoji=false` 参数；
2. 将规则中的内网业务域名（`campus.example.com`，[Rule] 与 [Host] 共 3 处）替换为实际内网域名；无相关需求可整体删除；
3. 执行 `ifconfig` 确认网卡接口名称，替换配置中的 `en0` / `en9`；
4. `http-api` 的密钥使用 `openssl rand -hex 16` 生成替换 `<YOUR_API_KEY>`；如无此需求，删除该两行及 [Script]、[Panel] 段；
5. 将 `network_health.js` 与本配置一并置于 Surge Profiles 目录；
6. 导入 Surge 即可使用。

iOS 平台可参考使用，其中 TUN 与网络接口相关参数需自行调整。

## 六、注意事项

1. `GEOIP,CN` 依赖 Surge 内置 GeoIP 库，首次使用自动下载；
2. 机场节点命名需包含地区关键词（HK/香港、SG/新加坡、JP/日本、US/美国、TW/台湾、KR/韩国等），否则地区组为空，请按实际命名调整正则；
3. 规则源均为第三方仓库，偶发失效属正常现象；Surge 加载报错时，优先检查最近变更的 RULE-SET 链接；
4. 请勿将个人订阅链接、API 密钥、内网域名等信息提交至公开仓库。

## 七、致谢

本配置使用的规则与图标来自以下开源项目：

- [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)
- [666OS/rules](https://github.com/666OS/rules)
- [skk-moe RuleSets](https://ruleset.skk.moe)
- [phishing.army](https://phishing.army)
- [Koolson/Qure](https://github.com/Koolson/Qure) · [fmz200/wool_scripts](https://github.com/fmz200/wool_scripts)

本配置可自由使用与修改，引用的规则与图标版权归原项目所有。
