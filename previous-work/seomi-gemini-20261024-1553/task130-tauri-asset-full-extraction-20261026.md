# SEOmi 0.4.41 Windows embedded frontend extraction and closure audit

Date: 2026-10-26  
Executable: `/Volumes/Kingston/seomi-build/release0441-recovery/windows-package/seomi.exe`  
Executable size: `38262272` bytes  
Executable SHA-256: `46a8056c99e140d11a0504e1c0d3843a5504e1be91566b933631e3ec488aa7d6`

## Extraction result

- Candidate slash-path strings scanned: 106.
- Valid Brotli asset streams extracted: 99 (92 JS, 1 CSS, 1 HTML, 1 SVG logo, 4 PNG screenshots).
- Full extracted tree: `/Volumes/Kingston/seomi-build/release0441-recovery/windows-frontend`; canonical per-file manifest: `/Volumes/Kingston/seomi-build/release0441-recovery/windows-frontend/extraction-manifest.json`.
- A raw `/screenshots/semantic_map.png` substring occurred inside compressed bytes immediately before `/assets/ru-CmKuB3aF.js`; it had no Brotli payload and was rejected as a false candidate, not reported as a missing asset.

## Dependency closure

- Literal static/dynamic/Vite dependency references checked: 723.
- Missing referenced paths: 0.
- Entry closure from `index.html`: 95 files.
- Orphans: 4 public screenshots only: `screenshots/dataforseo.png`, `screenshots/project_gate.png`, `screenshots/single_audit.png`, `screenshots/site_crawler.png`.
- Locale chunks are included in the closure through the template dynamic imports in `i18n-CZjVthL_.js`; all 11 locale paths resolve.
- The Settings chunk and every recursively referenced local JS/CSS/HTML/SVG/PNG path resolve to an extracted file.

## Windows index and CSP

- Extracted `index.html` contains one external module entry (`./assets/index-CxZ0Ue1p.js`), 13 modulepreload links, one stylesheet (`./assets/index-hqAupqfu.css`), and `./logo.svg`.
- It has no CSP meta tag and no inline script. The source Tauri CSP is `script-src 'self'`; the external same-origin module assets therefore do not require per-script CSP hashes.
- The same configured CSP string is present in the executable at byte offset `15,436,503`: `default-src 'self'; img-src 'self' https: data: asset:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost http://127.0.0.1:11434;`.
- Every entry import above exists in the extracted tree; validation recorded zero missing paths.

## Key hashes and sizes

| Key | Compressed bytes | Decompressed bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `/assets/CommandPalette-DLictErk.js` | 2824 | 8382 | `74f16fbe60b1f2c432fe67160875ed8044cf5d42e40684e1e25d5423975043fc` |
| `/assets/SubscriptionModal-gdlXUK4b.js` | 2627 | 8464 | `891ff4c0cea57eb7b5d3fe21c406fb9c0495aa1ccb73c2d89961a4ca3283eead` |
| `/assets/useEmbeddingClustering-BvLnp-MF.js` | 1235 | 2638 | `12ded2c5366ffcb0cd74a44e991a2d554989b48b3b4f24161b75d135db974fa7` |
| `/assets/ar-CV1bQXDG.js` | 118942 | 425774 | `524413e0146472f0ae136f618eac38c573631efec8a177c72d1dfe66f1725328` |
| `/assets/BacklinkChecker-DdIMknCt.js` | 10071 | 39507 | `d54be5eab67bb78bca9d66f6f51843f184149bc0366369a0d34195a0692de864` |
| `/assets/KeywordClustering-CGi40ttc.js` | 6915 | 28318 | `024aba55f7649ac132633ac1c69fe29cb32dec5e74b49ddb94b8995d5fe73c00` |
| `/assets/contracts-DUDLw8yK.js` | 153 | 344 | `5893286a3043ae53f53f20b6a281de81736eebcf07af5db4186930f740a9f99a` |
| `/assets/DataForSeoCostMeter-CFR0lNFB.js` | 767 | 1743 | `86085aa80b83a854d0b859222b48f650b048458f85d71cf55d81f48d2476b125` |
| `/assets/useTransientValue-r8cL-HYl.js` | 232 | 418 | `73c28b59203652a043fdb162fdd0ae50a274370474c9a5464137dec5f72cfaa2` |
| `/assets/enforce-CGW1TxyO.js` | 39583 | 110679 | `9fe1292fcb44d2254933b1ccc93ae4eff4f9d09ba348d6eea3d9e560d70b4c75` |
| `/assets/history-BW3AYaQV.js` | 1137 | 2602 | `5e8bdc6ea9e5fc48c880c07773fccd702b2d35a54a94ec54d92dc12260c6ad48` |
| `/assets/index-CxZ0Ue1p.js` | 28831 | 111324 | `39518a024c3898c84351f1b1287903a98727216f64c023a4df807d423805e239` |
| `/assets/PrePublishWorkspace-DFPgCOQf.js` | 2891 | 7647 | `1dc45266b7039935e54d1b89ca849f25242093a96a70828cfcc3f049ef0dedc5` |
| `/assets/download-D5_t0_KW.js` | 407 | 668 | `331ef57b55631c0e9292a57a669c3a5a7b9596a14f6b5640e1cb7ed4c342f747` |
| `/assets/LinksAudit-hnNa_V4q.js` | 3258 | 12941 | `e5f7f5695d0b2c094d6841ccbf60af39088fe8bd190cf142c6eaef7d5002e26d` |
| `/assets/ids-Bll_cO7k.js` | 265 | 476 | `a57398ca050ca42f4a8d1d3c3ee8e1e1a2d524d01979ae989044b18a8b81ef4e` |
| `/assets/icons-vendor-DcCZopxQ.js` | 9917 | 34520 | `5feb45dd43bd45e921402f636dc37d2729b9bd54811dc617d92eee4d0a265933` |
| `/assets/tauri-vendor-BiFqnGCU.js` | 2054 | 5865 | `497adec0431975043342dec2b02c21badd20d462c95b714e3a0dbfcb25b5da64` |
| `/screenshots/site_crawler.png` | 187012 | 192251 | `ac14ee731a6fee1b81d3945a877686aceaee765cf727d94098c88307cb3e5c36` |
| `/assets/HelpTip-BEWo_px6.js` | 2019 | 4984 | `60557c1908f33f301315fece3f4d1861837f8089e65e56e6490b786aea8f982d` |
| `/assets/useDataForSeoCost--9Xk8vYy.js` | 444 | 843 | `620c58dd493066596162196aa43e3627931e0f46c94f755b7dd15adcbd4c50c8` |
| `/assets/index-hqAupqfu.css` | 16435 | 131297 | `9a085bdd03c57cddce9704587c7dcbc2426512c4f04291c3abe3ac1e7dfe1136` |
| `/assets/es-CkSyGfH4.js` | 115805 | 380454 | `012fa597bac9ae2e76d102770460f3f0d252eb12fca94686d5e290e1976b4028` |
| `/assets/useModalA11y-JJpE8PYw.js` | 645 | 1515 | `b886ade668d64436e60e2bfe014329bcbf47a7269cf8f69a7cb3ea76f87bec8c` |
| `/assets/DataForSEOAudit-COI6vnJ5.js` | 4317 | 17875 | `664b254083475ce1bfb8d8350e56fd2ba1283bd1710c9e1338f1f14d7e7fcd71` |
| `/assets/urlTelemetry-uXO2UIxg.js` | 2065 | 5462 | `7521f6de30a817d6c2c5e8c535cef4220bd6298414b17fc80fdaed350ad592c6` |
| `/assets/pl-CPZuAt52.js` | 118398 | 385269 | `09de48720495d9df348c5e90cbfb3d1d9fce2e92a09caebb3cd9ec10e3d99ad2` |
| `/assets/Overview-Bku_3BAG.js` | 18770 | 86072 | `8a86f777550de9daaa6bfeb87d10202dd599b306dc261408909276f6a3a767d9` |
| `/assets/embeddingClustering-cak1xfZs.js` | 5013 | 12400 | `22ca9edced8f17baa46b43163f6cfc55e94124697d9fe4564e7b8fd02bc23672` |
| `/assets/CreateProjectModal-BbdUi-Sv.js` | 1602 | 4869 | `f4588ec48f36f3dac2de0bf9a70b724113fd3a824d8be793112b79dbdf6e52a7` |
| `/screenshots/project_gate.png` | 108383 | 115193 | `da0dffecff404346cf24895ada937c4bbac7ff2bd8573b7b0eef774747bbd21d` |
| `/assets/i18n-vendor-xGfJ3VFQ.js` | 15651 | 49533 | `61f34d4fd5de306659126610671900f2c3fdb056d636f169cc1e60c7fe2cb322` |
| `/assets/toolsStore-B6bPD2UA.js` | 22412 | 81366 | `4635ecde56736a909476c336a1eb3d3a186cd24ad64f487c909268849f92e7a9` |
| `/assets/freeSuggestions-Y9kUvi2x.js` | 2213 | 5332 | `e5e3a457b9f0a5b4c76830be09b7e94c36f9b3f74cabfba6475474ede05a4747` |
| `/assets/ShowOnPageButton-hxO1PDwQ.js` | 715 | 1455 | `f402a4678aeb8bae7af7a5c8b33f1ed80014c983d6907f7b56f965612b855970` |
| `/assets/SeoToolsWorkspace-DI6gnF3_.js` | 4033 | 16016 | `18a1124dce500da1aa65c6b7b81565a03950265e0a2a9f5f772ed2dea5cec261` |
| `/assets/ko-BwuB9jGd.js` | 115276 | 387361 | `38f5280113910f99221c522176d94d1cd9a7f7ecb4ee28343195c03168aec67e` |
| `/assets/importedSerpStorage-DV0T8ohF.js` | 1372 | 3195 | `edfb231ff15d984447cf186210d9670e86a183fec55f0f23f7d5edcaea17d600` |
| `/screenshots/single_audit.png` | 106235 | 113349 | `89d045ce281f93963b9ef3907d1b5909a21692cb2d8a66da0c7fd5579cdd886b` |
| `/assets/ImagesAudit-nsctu2dV.js` | 2772 | 11167 | `b3f0f5fddea6d01d3f20156594c5d44cc794cbe68955799b44e993db5fc8518f` |
| `/assets/RankTracking-BSDJTjUr.js` | 2868 | 13197 | `0e48f61f09bdefdef22444e47afe8b06c16881e4b8b92852e6c05401ff00c7c9` |
| `/index.html` | 511 | 1711 | `b7aa4949160d7c274f13077b17a25bf0b0c143e5cbba23211ad50c13ff1c09bf` |
| `/logo.svg` | 376 | 1005 | `d1a4be3ada4393396003b3fb086f94efba8b7571886f0a102e72d00ef5c6a816` |
| `/assets/auditProblems-B5PT7W17.js` | 1967 | 7665 | `6bc7711148fa3c63f4b216626a9f2f8b6d6d62c67a95b09eaece5edc7a05f2aa` |
| `/assets/HistoryModal-BA_IrC_8.js` | 1210 | 3599 | `d50562f4ff1761056d65242004b133a85ecd6244cb1fa5ce20f86bc045bb48c2` |
| `/assets/projectStore-CRMbvZqR.js` | 1532 | 3739 | `82e0dbecdba5e2176387f278f0e5988c1a0047e9f0d86a27eef66ba02cbde3ad` |
| `/assets/i18n-CZjVthL_.js` | 109378 | 363585 | `e9d63b7a068424c0a8bb82e9586afd0f71ad520d77b7992bb37d3930d6d1d226` |
| `/assets/SocialPreview-DcBdKUHw.js` | 5782 | 24660 | `fb610f6e87d792cf4a6a3a4483b561ccb58684bb1294962ea55109c775688135` |
| `/assets/delivery-WXlsoHxM.js` | 1042 | 2206 | `8030f7ee98a61be7ad7b525158d109936660d309493e3a48a91961e0d3afbd7b` |
| `/screenshots/dataforseo.png` | 170698 | 176216 | `79f0855478779f76850d31a4aef1d86324af208e65e9dbb003169a93a652893b` |
| `/assets/it-DqI9xNQk.js` | 115595 | 377315 | `eeec223d0d944fe4cabca5c3a7a645759077a41750544ecff42e9cf2ea4393e1` |
| `/assets/SettingsModal-CWV7oazO.js` | 14727 | 61406 | `45387c63232ecbdae3125d515560e76d4698da9d7ad0fa384d1e2b5d663a4a11` |
| `/assets/HeadingsTree-CVSsxFn0.js` | 2610 | 9143 | `471cc5cd5218f19114d47f0e8f66bda3dbae84fe77c737fcf8486b86effc7ffa` |
| `/assets/zh-CQei5QxK.js` | 113592 | 353606 | `b46d1608d34e8e98d258fe6e3ae9e2b8b4b335f51b16ebfebc06873044c395ea` |
| `/assets/AmpAuditView-BDjs05wr.js` | 1476 | 5809 | `cfb0ec8a6b5385e293f9fec4aa94c4b8ff8849cba717bbbe0ab5a469a7b7d4ae` |
| `/assets/ga4Cache-B63fmj9M.js` | 542 | 993 | `2b87d0097dd8f92edb89a6d368a8479d28b90621a4bd82022a51d949fdf787cf` |
| `/assets/aliases-DbKAHD11.js` | 449 | 812 | `8fcdf48ae9a6585dc4e3e298bab7eeb9f5f5285df3561759bada6a86bc83247f` |
| `/assets/AiBrandVisibility-M6-klv9c.js` | 3380 | 13449 | `f0eef1978a821deac55ed458b15c29f5a28cd63f292d1663a5e16e27aafb577b` |
| `/assets/PerformanceMetrics-amoVLaJt.js` | 1956 | 10147 | `dc261d53eafefa1186b99b0d10b8207f0f0ce747660fdc2d4fe80facc6e0eada` |
| `/assets/graph-vendor-BMxi_4Qo.js` | 167509 | 601954 | `cb149fde45ec321ca5bbb46442539eacaccca24cd6594661bed09b6277da723d` |
| `/assets/McpHub-1w44O6Ig.js` | 3996 | 15398 | `9d2ee25d8cc2621c3384dbd4b3bde6f6cd34ebf3e4861978407232d70634cd8c` |
| `/assets/react-vendor-DUTLrdlK.js` | 60642 | 210915 | `aa9708afc89122293c19ef2ac90b82e680d35aedb6ec9160d568e1f7dd4e5ae2` |
| `/assets/llmEconomy-BhzqMMV8.js` | 678 | 1174 | `8b462b25cd84a49383dbaacbd7944b71189579ef03b5dda80380787115331612` |
| `/assets/SearchConsoleHub-B409IQok.js` | 11022 | 48659 | `0273b1030954510af59565dd6e91919a09e9e15a023f5e7ff1350cd526e83015` |
| `/assets/snapshotStore-BKLn1jdB.js` | 1054 | 2524 | `3b3a9929bb197122e9d9dbd09eab6f88f2480cbc1955b2d96ed5df24f1745275` |
| `/assets/pt-C5kOJA69.js` | 115766 | 378256 | `88eff747519d9ff797f6f66fddda8626e438aa01760eaeb5cd1ef451c7439cce` |
| `/assets/DomainOverview-CAsNgzSZ.js` | 4355 | 22130 | `f214a45043bce595b3fa0403c9fecc47b9e177fc423bad369072c951846cfc6f` |
| `/assets/ja-Dgn-x3JC.js` | 117561 | 410078 | `5b67e2bb161ba2555c9b44f53607a52a6baf3381dee289d624326568de92e8f7` |
| `/assets/AIAssistantModal-BxyDgQvT.js` | 6073 | 23539 | `6e93d05458482d31542ded97e93d3c7d9cbc20a1105ac9efdcbe840e42207dee` |
| `/assets/DataForSeoPickers-BRmmDWbv.js` | 2113 | 6711 | `05da6ff2839fc13766959794f0a210c97cdbb69a5eed9ce92f4d75626d4ec27e` |
| `/assets/tauri-CbqqxqEv.js` | 2255 | 6576 | `c76963c9ebbe83fe696e399faccb1afda5ae38840f982431e4e61c25e19148f6` |
| `/assets/context-B4JPpdbd.js` | 628 | 1167 | `0d196d31264ab9bf2a2ae1748be8f211d981c1967cfec7077ca6fe1120220cec` |
| `/assets/AuditTabs-n21f9Lj4.js` | 1537 | 4812 | `6ab553cb3b915dd68bc3074e9bf035b1068cef55962c1e9947f8879065309465` |
| `/assets/hybridSerp-B8qotC_L.js` | 1479 | 3728 | `79ca7e925ff65e4f34e2b694e0b9157a72f414014647d0480e5cc8a17c55a13c` |
| `/assets/dataforseo-By4g-k4w.js` | 18357 | 70402 | `4b0fd4fd2b11455b083635f61fb8cd36f742c261cc2e89bd3bbe1535ed8a2196` |
| `/assets/rolldown-runtime-XKyaHtl9.js` | 399 | 726 | `548d1dbf321e7d2ae804fcc158b588706a7c52f8ca175de1490c6ccb4dbe55b7` |
| `/assets/SavedKeywords-BVHFjZ80.js` | 3090 | 12965 | `badc0751d7916730a20ead1c7ba9338437dc702c03071dc864fde58cd94182c1` |
| `/assets/StructuredDataView-BiBcxjU6.js` | 1477 | 4733 | `93d0aa4a9c799f042f467888e76193722df45cbbf4b67ef33e6c6748143d784a` |
| `/assets/ProviderModelSelect-wp5fYNW-.js` | 705 | 1488 | `a6f6faa65c08bfa965d0d85f6e86266b46f726ca657512e51903137ce6bc767d` |
| `/assets/fr-qVHed_aV.js` | 117112 | 384318 | `162f54972e49d9bddd2e02f3332c1d3d0ae8b9fe0f0b221b8a1c193113d26ca0` |
| `/assets/de-SY-e1DEU.js` | 117316 | 377899 | `b3917d99280e6dc83f34675cd0733165e88311a25196e2750bc11dc1d6a9eb7c` |
| `/assets/normalize-whJQm8C2.js` | 1705 | 4236 | `57bf4bd38239d804f9f38b73c5b14cab7f00036b7fdbebb6e70141a422bea36d` |
| `/assets/storageContracts-3Anm6Bje.js` | 269 | 473 | `18aa1fbfa91f5e26fb0775bfae0ac6a0b92935d005b397df9b10d9af0f701765` |
| `/assets/SecurityHeaders-Cy-q3h9B.js` | 2659 | 11666 | `997b344f1f51935574713bebb179d77383fc424cc3cda20659d7d33bb25a85b9` |
| `/assets/SiteAudit-DkRou2Qh.js` | 135077 | 661686 | `da5c3f51db5ca41b5ec0336efe89beee21c1618924fce54c9eeb17cbca3d4a98` |
| `/assets/PageSpeedWorkspace-CLw3_CST.js` | 8195 | 34769 | `6a31185799e6a026b939445040c6b100e813957e0b20a39bd880e0372ddca014` |
| `/assets/AiSearchPrompts-BOwuI42s.js` | 5450 | 19345 | `386804c5b555d26d37345676b4e5ecaddd826eb7424e9e6c5c7c628d7f9f4ecf` |
| `/assets/TrendChart-CO552XzT.js` | 617 | 1165 | `c4aac9b1696b87c69a5a48a82967bbe023364393b13d46ec59b7b5023b2def86` |
| `/assets/data-vendor-TlUyPtIQ.js` | 76285 | 386490 | `f55ec302d587f58793aeba2235fbca0c582b005386eee83ae231875147e28e89` |
| `/assets/ContextHelp-DWxETFuI.js` | 419 | 855 | `2c845c8f29ba8a4a446b277ccb4462bf53ea480a5d6fe3858d246117edfa93ae` |
| `/assets/MetadataTable-QSwQwTop.js` | 5091 | 29836 | `c66bf9f1bd89963cddfa0ca44619700c1065a926de47a50855a1aa9d5ad18414` |
| `/assets/SecretKeyField-BquJy_7t.js` | 813 | 1697 | `826801cad7b01e496a87a9f65f2a3e51aa247670061a5d963342d2d866a2acbb` |
| `/assets/LogIntelligencePanel-DOy5TYFn.js` | 4685 | 12112 | `c60ec54d5a1b31d148ba23ffd483204a6337604c73c850db36b5357da3f29601` |
| `/assets/freeSerp-BUHY-kb7.js` | 1904 | 5358 | `dcecde0c72ec0c6ae37cca2b189195716f1e07665492af4d0ae12d8c616184c9` |
| `/assets/clipboard-dqatf-gR.js` | 279 | 549 | `e1ddba774f8ec18800a8810780fc7ac15a0c54300758b0ca3b223e77d7b877cd` |
| `/assets/ru-CmKuB3aF.js` | 123573 | 468325 | `c5be3ec682c5e30e7b5fce5fd5874fdfcc815c4ea982f5b6d09cbb951fe00c07` |
| `/assets/schemaIssueLocalization-DXOZinSX.js` | 384 | 941 | `1cd5232057b6a4d96af3ab1668146d4074b6d632036b47799fa6b1af482a44bf` |
| `/assets/KeywordResearch-HLFSOe5M.js` | 10329 | 41500 | `099f1ac11fe18d36298a02464f7b7ab79a424155f16a98bb08a3dabefeb4499c` |
| `/assets/export-DH6m7wqa.js` | 9206 | 28818 | `927ea3f5f569ac3bc3b61aeba00574dc064ebcdc4a7bad260429a9722891737c` |

## Settings evidence

- Executable key offset: 17471223 (0x10a96f7).
- Compressed payload: 14727 bytes; decompressed payload: 61406 bytes.
- Decompressed SHA-256: `45387c63232ecbdae3125d515560e76d4698da9d7ad0fa384d1e2b5d663a4a11`.
- Recursive closure check found no missing direct or transitive local dependency for this chunk.

No repository files, Git state, builds, tests, credentials, installers, or processes were modified. Extraction and validation were offline and read-only against the published executable.
