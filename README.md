# dsh-session-summarizer

璇诲彇褰撳墠/鏈€杩戜細璇濆苟鐢熸垚涓婁笅鏂囨憳瑕佺殑 DSH锛圖eepSeek Harness锛夊師鐢熸彃浠躲€傛渶灏忚兘鍔涘垏鐗囷紝楠岃瘉銆屼互鍘熺敓 Cordis 鎻掍欢褰㈡€佽繘鍏?DSH 鐢熸€併€嶇殑鍙璺緞銆?
## 绠€浠?
鎻掍欢鍦?profile 鍐呬互 bundle patch 鏂瑰紡鎸傝浇锛屾敞鍐?`session_summarize` 宸ュ叿锛氳鍙栨寚瀹氾紙鎴栧綋鍓?鏈€杩戯級浼氳瘽鍐呭锛岀敓鎴愪笂涓嬫枃鎽樿骞跺洖澶嶃€傚叏绋嬭蛋 DSH 瀹樻柟杩愯鏃讹紙`dsh-session` 璇讳細璇濄€乣dsh-llm` 鐢熸垚锛夛紝涓嶄緷璧栦换浣曞閮ㄦ湇鍔°€?
## 缁撴瀯

```
dsh-session-summarizer/
鈹溾攢鈹€ package.json        # dsh.bundle.patch 澹版槑锛堢涓夋柟鎻掍欢 manifest 绾﹀畾锛?鈹溾攢鈹€ cordis.patch.yml    # bundle patch 灞傦細寰€ profile 鎻掑叆鎻掍欢琛?鈹斺攢鈹€ lib/
    鈹溾攢鈹€ index.js        # 鎻掍欢鍏ュ彛 { apply, inject, name }锛屾敞鍐?session_summarize 宸ュ叿
    鈹斺攢鈹€ summarize.js    # 璇讳細璇濓紙ctx.sessions / ctx.sessionQuery锛? 鎽樿锛坈tx.llm 鎴栧厹搴曪級
```

## 瀹夎

```sh
# 浠庝粨搴撳畨瑁咃紙鍙戝竷褰㈡€侊級
dsh plugin --profile <profile鍚? add <浠撳簱鍦板潃>

# 鏈湴璺緞锛堝紑鍙戦獙璇侊級
dsh plugin --profile <profile鍚? add file:../dsh-session-summarizer
```

瀹夎鍚庡惎鍔?profile锛屽伐鍏?`session_summarize` 闅忔彃浠舵敞鍐岋紱涔熷彲鍦?`cordis.patch.yml` 鐨?`config` 閲屾寚瀹氭憳瑕佹墍鐢ㄧ殑 `provider` / `model`锛堢暀绌哄垯杩愯鏃舵帰娴嬶級銆?
## 鐢ㄦ硶

鍦ㄤ細璇濋噷璁╂ā鍨嬭皟鐢?`session_summarize`锛?
| 鍙傛暟 | 蹇呭～ | 璇存槑 |
|---|---|---|
| `target` | 鍚?| 鎸囧畾浼氳瘽锛涚己鐪佽褰撳墠/鏈€杩戜細璇?|
| `maxTurns` | 鍚?| 鎽樿鐨勮疆娆′笂闄?|

## 濂戠害鐗堟湰閿佸畾

鏈彃浠舵寜 `@deepseek-ai/*@0.1.0-rc.6` 濂戠害瀹炵幇锛屽崌绾ч渶鍥炲綊楠岃瘉锛?
- `peerDependencies`锛歚@deepseek-ai/cordis ^4.0.1`銆乣@deepseek-ai/dsh-llm ^0.1.0-rc.6`銆乣@deepseek-ai/dsh-session ^0.1.0-rc.6`
- 瀹夎鏈哄埗锛氫緷璧?`dsh-app-boot` 鐨?bundle patch 绾﹀畾锛坄package.json` 鐨?`dsh.bundle.patch` 鎸囧悜 `cordis.patch.yml`锛屽畨瑁呭悗鑷姩杩涘叆 profile 鐨?`dsh.profile.bundles` 灞傦級
- 宸ュ叿娉ㄥ唽锛歚dsh-tools` 鐨?`ToolRuntime.register` + `defineTool`

## License

MIT锛堣 [LICENSE](LICENSE)锛夈€?