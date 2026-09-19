# 中国天气 Provider 支持设计

日期：2026-08-19

## 背景

`weather@mockturtl` 在 Cinnamon 6.6.9 上使用 `src/3_8` 的 TypeScript 实现。当前 applet 已通过 `WeatherProvider` 接口支持多个国际天气服务，但缺少主要面向中国用户的天气服务。

本次新增两个相互独立、可在设置中选择的 provider：

- 和风天气（QWeather）
- 彩云天气（ColorfulClouds）

两个 provider 都复用现有定位、展示、单位换算、刷新和错误处理流程。它们不会合并数据，也不会互相自动故障转移，以避免重复计费、来源不一致和错误状态含糊。

## 目标

- 在 Cinnamon 6.6.9 中把 QWeather 和彩云天气显示为独立的数据源选项。
- 使用 applet 已有的经纬度位置，无需新增城市 ID 搜索或行政区划查询。
- 提供当前天气、逐小时预报和逐日预报。
- 在用户启用对应功能且帐号有权限时，提供分钟降水和天气预警。
- 正确映射温度、风速、气压、湿度、露点、体感温度、日出日落、降水和天气图标。
- 避免在调试日志和诊断配置中泄漏 API 凭据。
- 保持其他 provider 的行为和已有用户配置不变。

## 非目标

- 不实现 QWeather JWT/Ed25519 鉴权。
- 不实现彩云 App Key/App Secret/HMAC 鉴权。
- 不实现多个 provider 自动切换、数据融合或准确率比较。
- 不新增空气质量、生活指数、台风路径等 applet 当前统一数据结构无法展示的字段。
- 不修改已停止维护的 `src/3_0` 实现。

## 方案选择

采用“独立 provider + 简单凭据”的方案：

- QWeather 使用用户的专属 API Host 和 API Key，通过 `X-QW-Api-Key` 请求头鉴权。
- 彩云天气使用 v2.6 Token，通过 v2.6 URL 路径鉴权。

没有选择安全签名方案，是因为 QWeather JWT 需要 Ed25519，彩云推荐方案需要 HMAC-SHA256、nonce 和时间戳；同时支持两套签名会显著扩大 GJS 运行时兼容面和设置复杂度。简单凭据是两家当前仍支持的正式鉴权方式，适合作为首版。

也不采用自动故障转移或数据融合。现有 applet 的配置、刷新循环、来源归因和剩余调用量都围绕单一选中 provider 设计，维持这一模型可以把改动隔离在既有扩展点中。

## 架构

### Provider 注册

在 `config.ts` 中新增两个 `Services` 枚举值及工厂映射：

- `QWeather`
- `CaiYun`

每个实现继续遵守 `WeatherProvider<Service, Options>`：

- `locationType = "coordinates"`
- `needsApiKey = true`
- QWeather 最大支持 7 天、24 小时
- 彩云最大支持 15 天、48 小时
- 两者均声明支持逐小时降水概率和降水量

设置变化继续触发现有刷新循环；切换 provider 时继续触发 UI rebuild。

### 文件边界

新增目录：

- `src/3_8/providers/qweather/`
- `src/3_8/providers/caiyun/`

每个目录包含：

- `provider.ts`：请求编排、鉴权、配置校验和错误处理。
- `payload/*.ts`：API 响应类型。
- 纯转换函数：把响应转换成 `WeatherData`、`ForecastData`、`HourlyForecastData` 和 `AlertData`。
- 天气代码/`skycon` 到现有 `BuiltinIcons` 与 `CustomIcons` 的集中映射。

转换逻辑与网络请求分离，便于使用固定 JSON fixture 测试，不依赖 Cinnamon 或真实 API。

## QWeather 数据流

### 配置

新增设置：

- `qweather_api_host`
- `qweather_apikey`

API Host 接受用户在 QWeather 控制台中看到的专属主机名。输入会去除协议、路径和末尾斜杠，只接受匹配 `*.qweatherapi.com` 的主机名；请求始终使用 HTTPS。旧的 `api.qweather.com`、`devapi.qweather.com` 和 `geoapi.qweather.com` 不作为默认值或回退值。

API Key 通过 `X-QW-Api-Key` 请求头发送，不进入 URL 或日志。

`ValidConfiguration` 在 API Host 或 API Key 缺失，或 API Host 格式错误时阻止请求。为避免扩展全局刷新状态，以上情况都沿用现有 `NO_KEY` 配置错误；设置说明会明确同时需要 Host 和 Key。非法 Host 不会发出网络请求。

### 请求

以四舍五入到小数点后两位的 `longitude,latitude` 作为 `location`：

- 必需：`GET /v7/weather/now`
- 逐小时：`GET /v7/weather/24h`
- 逐日：`GET /v7/weather/7d`
- 用户启用分钟降水时：`GET /v7/minutely/5m`
- 用户启用预警时：`GET /weatheralert/v1/current/{latitude}/{longitude}`

天气、逐小时和逐日请求并发执行。当前天气是成功返回的最低要求；逐小时、逐日、分钟降水或预警因套餐、覆盖范围或无数据失败时，保留已成功的核心天气数据并使用空数组/缺省字段。鉴权失败、限流或当前天气失败时，按现有 provider 错误流程返回失败。

请求语言由 `translateCondition` 和当前 locale 决定：启用时请求可支持的当前语言，关闭时请求英文。单位固定为公制，再转换为 applet 的统一内部单位。

### 转换

- 摄氏度转换为 Kelvin。
- km/h 转换为 m/s。
- 气压保持 hPa，湿度保持 0–100。
- `feelsLike` 映射为 `extra_field`。
- `daily[0]` 的日出日落映射到当前天气。
- 官方 ISO 8601 时间交给 Luxon 解析并保留时区。
- QWeather icon code 映射为 applet 的昼夜、云、雨、雪、雾、沙尘、雷暴和极端天气图标；未知代码使用安全的通用天气图标。
- 分钟降水数组转换为 applet 已有的开始/结束分钟摘要。
- 预警的 `severity` 直接映射到 applet 的 `minor`、`moderate`、`severe`、`extreme`、`unknown`。

QWeather 的 `prettyName` 和 `website` 使现有 UI 显示可点击的 “Powered by QWeather”。预警响应中的归因声明必须保留；如果现有 `AlertData` 无法单独展示全部声明，则附加到预警描述中，确保与预警共同显示。

## 彩云天气数据流

### 配置

新增设置：

- `caiyun_token`

首版固定使用官方稳定的 v2.6 综合接口：

`GET https://api.caiyunapp.com/v2.6/{token}/{longitude},{latitude}/weather`

请求参数：

- `unit=metric:v2`，使逐小时、逐日和分钟降水统一返回 mm/h
- `lang` 根据 `translateCondition` 和 locale 映射到 `zh_CN`、`zh_TW`、`en_US`、`en_GB` 或 `ja`
- `hourlysteps` 取用户设置与 48 的较小值
- `dailysteps` 取用户设置与 15 的较小值
- `alert=true` 仅在用户启用预警时传递

综合接口一次返回 `realtime`、`minutely`、`hourly` 和 `daily`；不为同一次刷新重复调用子接口。

### 凭据保护

彩云 v2.6 Token 位于 URL 路径中，而现有 `soupLib` 会记录完整请求 URL。因此为 HTTP 请求选项新增显式的安全日志 URL/敏感 URL 标志：实际请求仍使用完整 URL，但所有 Debug、错误和 Soup2/Soup3 日志只使用将 Token 替换为 `[REDACTED]` 的 URL。

诊断配置导出也必须把 `caiyun_token`、`qweather_apikey` 和其他已有 provider 的密钥统一替换为 `REDACTED`。这会顺便修复当前只隐藏旧通用 `apiKey`、却可能导出 provider 专属密钥的问题。

### 转换

- `realtime.temperature` 和 `apparent_temperature` 从摄氏度转 Kelvin；API 不提供露点时将 `dewPoint` 设为 `null`。
- `realtime.wind.speed` 从 km/h 转换为 m/s；方向保持角度。
- 彩云湿度为 0–1，转换为 0–100。
- `realtime.pressure` 从 Pa 转换为 hPa。
- `daily.temperature` 生成每日最低/最高温。
- `hourly.temperature`、`hourly.precipitation` 和 `hourly.skycon` 按时间索引合并。
- `daily.astro[0]` 与响应时区组合成日出日落 DateTime。
- `skycon` 映射为现有图标；未知值回退为安全通用图标。
- `minutely` 转换为 applet 的即时降水摘要。
- `alert.content` 在帐号有预警权限且响应存在时转换为 `AlertData[]`；无权限或无预警不影响其他天气数据。

响应必须至少包含有效的 `realtime` 才算刷新成功。缺少小时或逐日块时返回空数组；结构异常会记录不含凭据的解析错误并返回 applet 可理解的 provider 错误。

## 错误处理

两家 provider 都区分：

- 缺少凭据或 QWeather Host 非法：刷新前返回 `NO_KEY`。
- 401/403 或 API 明确报告凭据无效：`bad key`。
- 429：服务/限流错误，不重试当前刷新，交给正常刷新间隔。
- 无网络、超时和非 JSON：复用 `HttpLib` 的现有错误。
- 当前天气 payload 异常：硬失败并记录 provider 名称和非敏感上下文。
- 可选/预报数据不可用：保留核心当前天气，不伪造字段。

不在 provider 内实现额外重试，避免在配额型 API 上放大调用量。

## 设置与文档

`settings-schema.json` 新增：

- 两个 provider 选项。
- 两段服务说明。
- QWeather API Host、QWeather API Key、彩云 Token 输入项及依赖条件。

配置类新增对应绑定、变化事件和 `GetServiceConfig` 分支。README provider 表和说明补充支持范围、凭据获取方式、调用数量提示和 QWeather API Host 要求。CHANGELOG 记录新增 provider，metadata patch 版本递增。

所有新用户可见字符串进入翻译模板；现有翻译文件不手工伪造翻译。

## 测试与验证

先为纯转换逻辑添加失败测试，再实现 provider：

- QWeather 当前、24 小时、7 日、分钟降水、预警 fixture。
- 彩云综合响应 fixture。
- 单位换算、时区、昼夜图标、降水、缺省可选字段和未知天气代码。
- 错误响应、缺失当前天气和无预警场景。
- URL/诊断导出不会包含测试密钥。
- API Host 规范化及非法 Host 拒绝。

由于仓库当前没有单元测试框架，将为纯 provider 转换器引入最小的 Node 测试脚本；测试不导入 Cinnamon/GJS UI 模块，也不请求真实 API。

完成后运行：

- provider 单元测试
- TypeScript 类型检查
- `npm run lint`
- `npm run start`
- 检查生成并跟踪的 `files/weather@mockturtl/3.8/weather-applet.js`
- 校验 `settings-schema.json` 为合法 JSON

无法在当前环境自动化验证 Cinnamon 面板渲染或使用真实用户凭据；这些作为人工验收项记录，不把网络实测伪装为已完成。

## 验收标准

- Cinnamon 6.6.9 设置中可选择 QWeather 或彩云天气。
- 缺少所选 provider 凭据时显示已有的 API Key 配置错误，不发送请求。
- 使用有效凭据时，当前天气、逐小时和逐日数据能进入现有 UI。
- 用户启用分钟降水/预警且服务返回数据时，现有对应 UI 能显示它们。
- 关闭对应功能时不产生额外的 QWeather 分钟降水或预警请求。
- 彩云天气每次刷新只调用一次综合接口。
- 日志、错误信息和诊断导出不包含 QWeather API Key 或彩云 Token。
- QWeather 来源可见且可点击；预警所需归因与预警共同显示。
- 其他 provider、保存地点和旧配置继续通过构建与回归检查。

## 官方参考

- [QWeather API Host](https://dev.qweather.com/docs/configuration/api-host/)
- [QWeather 鉴权](https://dev.qweather.com/docs/configuration/authentication/)
- [QWeather 实时天气](https://dev.qweather.com/docs/api/weather/weather-now/)
- [QWeather 逐小时天气](https://dev.qweather.com/docs/api/weather/weather-hourly-forecast/)
- [QWeather 分钟级降水](https://dev.qweather.com/docs/api/minutely/minutely-precipitation/)
- [QWeather 实时天气预警](https://dev.qweather.com/docs/api/warning/weather-alert/)
- [QWeather 归因要求](https://dev.qweather.com/docs/terms/attribution/)
- [彩云天气版本说明](https://docs.caiyunapp.com/weather-api/version-guide.html)
- [彩云天气 v2.6 鉴权](https://docs.caiyunapp.com/weather-api/v2/v2.6/auth.html)
- [彩云天气 v2.6 综合接口](https://docs.caiyunapp.com/weather-api/v2/v2.6/6-weather.html)
- [彩云天气 v2.6 天级预报](https://docs.caiyunapp.com/weather-api/v2/v2.6/4-daily.html)
