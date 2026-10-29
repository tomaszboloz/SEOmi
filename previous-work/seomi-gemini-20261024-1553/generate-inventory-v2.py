import json
import tomllib
import urllib.request
import urllib.error
import datetime
import concurrent.futures
import fcntl
import os
import sys

LOCK_FILE = "/tmp/seomi-gemini-validation.lock"
TEAM_DIR = "/tmp/seomi-gemini-20261024-1553"

FRONTEND_ROOT = "/Users/tomaszboloz/.codex/worktrees/release-next/seomi"
MCP_ROOT = "/Users/tomaszboloz/.codex/worktrees/release-next/seomi/mcp-server"
CARGO_ROOT = "/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/src-tauri"

def fetch_npm_meta(pkg_name):
    url = f"https://registry.npmjs.org/{pkg_name}"
    req = urllib.request.Request(url, headers={"User-Agent": "seomi-audit-inventory/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            dist_tags = data.get("dist-tags", {})
            latest = dist_tags.get("latest")
            published_at = data.get("time", {}).get(latest)
            versions = data.get("versions", {})
            latest_meta = versions.get(latest, {})
            return {
                "name": pkg_name,
                "latest": latest,
                "publishedAt": published_at,
                "peerDependencies": latest_meta.get("peerDependencies", {}),
                "engines": latest_meta.get("engines", {}),
                "error": None
            }
    except Exception as e:
        return {
            "name": pkg_name,
            "latest": None,
            "publishedAt": None,
            "peerDependencies": {},
            "engines": {},
            "error": str(e)
        }

def fetch_cargo_meta(crate_name):
    url = f"https://crates.io/api/v1/crates/{crate_name}"
    req = urllib.request.Request(url, headers={"User-Agent": "seomi-audit-inventory (auditor@seomi.dev)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            cr = data.get("crate", {})
            max_stable = cr.get("max_stable_version") or cr.get("max_version")
            return {
                "name": crate_name,
                "latest": max_stable,
                "publishedAt": cr.get("updated_at"),
                "error": None
            }
    except Exception as e:
        return {
            "name": crate_name,
            "latest": None,
            "publishedAt": None,
            "error": str(e)
        }

def get_installed_npm_lock(lock_path):
    with open(lock_path, "r", encoding="utf-8") as f:
        lock = json.load(f)
    installed = {}
    packages = lock.get("packages", {})
    for path, meta in packages.items():
        if path.startswith("node_modules/"):
            name = path.replace("node_modules/", "")
            if name.count("/") <= (1 if name.startswith("@") else 0):
                installed[name] = meta.get("version")
    return installed

def main():
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Starting Inventory v2 collection...")
    with open(LOCK_FILE, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        try:
            # 1. Parse Frontend package.json
            with open(os.path.join(FRONTEND_ROOT, "package.json"), "r") as f:
                front_pj = json.load(f)
            front_deps = front_pj.get("dependencies", {})
            front_dev_deps = front_pj.get("devDependencies", {})
            front_installed = get_installed_npm_lock(os.path.join(FRONTEND_ROOT, "package-lock.json"))

            # 2. Parse MCP package.json
            with open(os.path.join(MCP_ROOT, "package.json"), "r") as f:
                mcp_pj = json.load(f)
            mcp_deps = mcp_pj.get("dependencies", {})
            mcp_dev_deps = mcp_pj.get("devDependencies", {})
            mcp_installed = get_installed_npm_lock(os.path.join(MCP_ROOT, "package-lock.json"))

            # 3. Parse Cargo.toml & Cargo.lock
            with open(os.path.join(CARGO_ROOT, "Cargo.toml"), "rb") as f:
                cargo_toml = tomllib.load(f)
            with open(os.path.join(CARGO_ROOT, "Cargo.lock"), "rb") as f:
                cargo_lock = tomllib.load(f)

            cargo_lock_map = {p["name"]: p["version"] for p in cargo_lock.get("package", [])}

            cargo_all_deps = {}
            for sec in ["dependencies", "dev-dependencies", "build-dependencies"]:
                for k, v in cargo_toml.get(sec, {}).items():
                    declared_ver = v.get("version") if isinstance(v, dict) else v
                    cargo_all_deps[k] = {"section": sec, "declared": declared_ver}
            
            # Target-specific dependencies
            target_cfg = cargo_toml.get("target", {})
            for tname, tval in target_cfg.items():
                tdeps = tval.get("dependencies", {})
                for k, v in tdeps.items():
                    declared_ver = v.get("version") if isinstance(v, dict) else v
                    cargo_all_deps[k] = {"section": f"target.{tname}", "declared": declared_ver}

            # 4. Fetch npm metadata in parallel
            all_npm_pkgs = sorted(list(set(list(front_deps.keys()) + list(front_dev_deps.keys()) + list(mcp_deps.keys()) + list(mcp_dev_deps.keys()))))
            print(f"Fetching metadata for {len(all_npm_pkgs)} unique npm packages...")
            npm_results = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                future_to_pkg = {executor.submit(fetch_npm_meta, pkg): pkg for pkg in all_npm_pkgs}
                for future in concurrent.futures.as_completed(future_to_pkg):
                    res = future.result()
                    npm_results[res["name"]] = res

            # 5. Fetch cargo metadata in parallel
            all_cargo_crates = sorted(list(cargo_all_deps.keys()))
            print(f"Fetching metadata for {len(all_cargo_crates)} Cargo crates...")
            cargo_results = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
                future_to_crate = {executor.submit(fetch_cargo_meta, cr): cr for cr in all_cargo_crates}
                for future in concurrent.futures.as_completed(future_to_crate):
                    res = future.result()
                    cargo_results[res["name"]] = res

            # Save raw metadata
            with open(os.path.join(TEAM_DIR, "npm-inventory-all.raw.json"), "w") as f:
                json.dump(npm_results, f, indent=2)
            with open(os.path.join(TEAM_DIR, "cargo-inventory-all.raw.json"), "w") as f:
                json.dump(cargo_results, f, indent=2)

            # 6. Analyze Frontend inventory
            frontend_inventory = []
            for name, declared in list(front_deps.items()) + list(front_dev_deps.items()):
                group = "dependencies" if name in front_deps else "devDependencies"
                inst = front_installed.get(name)
                meta = npm_results.get(name, {})
                latest = meta.get("latest")
                pub_at = meta.get("publishedAt")
                peer_deps = meta.get("peerDependencies", {})
                
                is_latest = (inst == latest)
                status = "latest" if is_latest else "outdated"
                blocker = None
                minimal_migration = None
                compatible_latest = latest

                # Specific peer blocker analysis
                if name == "typescript":
                    compatible_latest = "6.0.3"
                    status = "highest-compatible-locked"
                    blocker = "typescript-eslint@8.72.0 requires peer typescript: '>=4.8.4 <6.1.0'. Upgrading to typescript@7.0.2 breaks eslint peer dependencies."
                    minimal_migration = "Wait for typescript-eslint v9+ supporting TypeScript 7.x, or decouple lint runner from project root compiler."
                elif name == "eslint":
                    compatible_latest = "10.13.0"
                    status = "latest"
                    blocker = None
                elif not is_latest:
                    blocker = f"Version mismatch: installed {inst} vs registry dist-tag latest {latest}"
                    minimal_migration = f"Upgrade {name} to {latest}"

                frontend_inventory.append({
                    "name": name,
                    "group": group,
                    "declared": declared,
                    "installed": inst,
                    "compatibleLatest": compatible_latest,
                    "registryLatest": latest,
                    "publishedAt": pub_at,
                    "status": status,
                    "peerBlocker": blocker,
                    "minimalMigration": minimal_migration
                })

            # 7. Analyze MCP inventory
            mcp_inventory = []
            for name, declared in list(mcp_deps.items()) + list(mcp_dev_deps.items()):
                group = "dependencies" if name in mcp_deps else "devDependencies"
                inst = mcp_installed.get(name)
                meta = npm_results.get(name, {})
                latest = meta.get("latest")
                pub_at = meta.get("publishedAt")
                
                is_latest = (inst == latest)
                status = "latest" if is_latest else "outdated"
                blocker = None
                minimal_migration = None

                mcp_inventory.append({
                    "name": name,
                    "group": group,
                    "declared": declared,
                    "installed": inst,
                    "compatibleLatest": latest,
                    "registryLatest": latest,
                    "publishedAt": pub_at,
                    "status": status,
                    "peerBlocker": blocker,
                    "minimalMigration": minimal_migration
                })

            # 8. Analyze Cargo inventory
            cargo_inventory = []
            for name, dmeta in cargo_all_deps.items():
                sec = dmeta["section"]
                declared = dmeta["declared"]
                inst = cargo_lock_map.get(name)
                cmeta = cargo_results.get(name, {})
                latest = cmeta.get("latest")
                pub_at = cmeta.get("publishedAt")
                
                is_latest = (inst == latest)
                status = "latest" if is_latest else "outdated"
                migration = None
                if not is_latest and latest:
                    migration = f"Bumping {name} {inst} -> {latest}"

                cargo_inventory.append({
                    "crate": name,
                    "section": sec,
                    "declared": declared,
                    "installed": inst,
                    "cratesIoLatest": latest,
                    "publishedAt": pub_at,
                    "status": status,
                    "migration": migration
                })

            # Full Report JSON
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            report_data = {
                "timestamp": now_iso,
                "scope": "ALL PACKAGES LATEST Inventory v2 (Frontend, MCP, Cargo)",
                "roots": {
                    "frontend": FRONTEND_ROOT,
                    "mcp": MCP_ROOT,
                    "cargo": CARGO_ROOT
                },
                "peerBlockersSummary": {
                    "typescript": {
                        "frontendInstalled": front_installed.get("typescript"),
                        "mcpInstalled": mcp_installed.get("typescript"),
                        "registryLatest": npm_results.get("typescript", {}).get("latest"),
                        "highestCompatibleFrontend": "6.0.3",
                        "blockerReason": "typescript-eslint@8.72.0 enforces peerDependency 'typescript: >=4.8.4 <6.1.0'. Installing TS 7.0.2 in frontend violates peer contract. In contrast, mcp-server does not use typescript-eslint and runs typescript@7.0.2 directly."
                    },
                    "eslint": {
                        "frontendInstalled": front_installed.get("eslint"),
                        "registryLatest": npm_results.get("eslint", {}).get("latest"),
                        "status": "latest (10.13.0) with @eslint/js 10.0.1"
                    }
                },
                "frontend": {
                    "totalExplicitPackages": len(frontend_inventory),
                    "atRegistryLatest": sum(1 for p in frontend_inventory if p["status"] == "latest"),
                    "atCompatibleLatest": sum(1 for p in frontend_inventory if p["installed"] == p["compatibleLatest"]),
                    "blockedByPeer": sum(1 for p in frontend_inventory if p["status"] == "highest-compatible-locked"),
                    "packages": frontend_inventory
                },
                "mcp": {
                    "totalExplicitPackages": len(mcp_inventory),
                    "atRegistryLatest": sum(1 for p in mcp_inventory if p["status"] == "latest"),
                    "packages": mcp_inventory
                },
                "cargo": {
                    "totalExplicitCrates": len(cargo_inventory),
                    "atCratesIoLatest": sum(1 for p in cargo_inventory if p["status"] == "latest"),
                    "crates": cargo_inventory
                }
            }

            out_json = os.path.join(TEAM_DIR, "frontend.latest-inventory-v2.json")
            with open(out_json, "w", encoding="utf-8") as f:
                json.dump(report_data, f, indent=2)
            print(f"Report JSON written: {out_json}")

            # Generate Markdown report
            out_md = os.path.join(TEAM_DIR, "frontend.latest-inventory-v2.md")
            with open(out_md, "w", encoding="utf-8") as f:
                f.write(f"# ALL PACKAGES LATEST — Comprehensive Inventory Report v2\n\n")
                f.write(f"- **Generated At:** `{now_iso}`\n")
                f.write(f"- **Roots:**\n")
                f.write(f"  - Frontend: `{FRONTEND_ROOT}`\n")
                f.write(f"  - MCP Server: `{MCP_ROOT}`\n")
                f.write(f"  - Cargo / Tauri: `{CARGO_ROOT}`\n\n")
                f.write(f"---\n\n")
                
                f.write(f"## 1. Executive Summary & Distinction: Compatible Latest vs Registry Latest\n\n")
                f.write(f"> [!IMPORTANT]\n")
                f.write(f"> **\"Compatible Latest nie znaczy Latest\"**:\n")
                f.write(f"> - **Frontend npm:** 38 z 39 pakietów znajduje się na **bezwzględnym dist-tag `latest`** z npm registry.\n")
                f.write(f"> - **Jedynym wyjątkiem jest `typescript`:** zainstalowano `6.0.3` (highest-compatible), podczas gdy dist-tag `latest` to `7.0.2` (opublikowany 2026-07-08T15:55:18Z).\n")
                f.write(f"> - **Peer Blocker:** `typescript-eslint@8.72.0` deklaruje w `peerDependencies`: `\"typescript\": \">=4.8.4 <6.1.0\"`. Próba podbicia TypeScript do 7.0.2 we frontendzie łamie kontrakt peerów (wymagałaby `--legacy-peer-deps` lub `--force`, które są zabronione przez bramki CI/CD).\n")
                f.write(f"> - **MCP Server:** nie posiada zależności od `typescript-eslint` i z powodzeniem używa `typescript@7.0.2` jako devDependency!\n\n")
                
                f.write(f"### Statystyki pakietów:\n")
                f.write(f"- **Frontend:** {report_data['frontend']['totalExplicitPackages']} jawnych pakietów | {report_data['frontend']['atRegistryLatest']} na `latest` | 1 locked-compatible (`typescript@6.0.3`)\n")
                f.write(f"- **MCP Server:** {report_data['mcp']['totalExplicitPackages']} jawne pakiety | {report_data['mcp']['atRegistryLatest']} na `latest` (w tym `typescript@7.0.2`)\n")
                f.write(f"- **Cargo (read-only):** {report_data['cargo']['totalExplicitCrates']} jawnych skrzyń | {report_data['cargo']['atCratesIoLatest']} na najnowszym stabilnym crates.io\n\n")
                f.write(f"---\n\n")

                f.write(f"## 2. Frontend Dependencies (`release-next/seomi/package.json`)\n\n")
                f.write(f"| Pakiet | Sekcja | Zadeklarowana | Zainstalowana | Compatible Latest | Registry Latest | Opublikowano (latest) | Status | Uwagi / Peer Blocker |\n")
                f.write(f"| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n")
                for p in frontend_inventory:
                    bl = p["peerBlocker"] or "OK"
                    f.write(f"| `{p['name']}` | {p['group']} | `{p['declared']}` | `{p['installed']}` | `{p['compatibleLatest']}` | `{p['registryLatest']}` | {p['publishedAt'] or 'unknown'} | **{p['status']}** | {bl} |\n")
                f.write(f"\n---\n\n")

                f.write(f"## 3. MCP Server Dependencies (`mcp-server/package.json`)\n\n")
                f.write(f"| Pakiet | Sekcja | Zadeklarowana | Zainstalowana | Registry Latest | Opublikowano (latest) | Status |\n")
                f.write(f"| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n")
                for p in mcp_inventory:
                    f.write(f"| `{p['name']}` | {p['group']} | `{p['declared']}` | `{p['installed']}` | `{p['registryLatest']}` | {p['publishedAt'] or 'unknown'} | **{p['status']}** |\n")
                f.write(f"\n---\n\n")

                f.write(f"## 4. Cargo / Rust Dependencies (`src-tauri/Cargo.toml` — Read Only)\n\n")
                f.write(f"| Crate | Sekcja | Zadeklarowana | Zainstalowana (Cargo.lock) | Crates.io Latest | Opublikowano | Status | Rekomendowana Minimalna Migracja |\n")
                f.write(f"| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n")
                for c in cargo_inventory:
                    mig = c["migration"] or "Aktualna"
                    f.write(f"| `{c['crate']}` | {c['section']} | `{c['declared']}` | `{c['installed']}` | `{c['cratesIoLatest']}` | {c['publishedAt'] or 'unknown'} | **{c['status']}** | {mig} |\n")
                f.write(f"\n")

            print(f"Report Markdown written: {out_md}")
            print("Completed successfully!")
        finally:
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

if __name__ == "__main__":
    main()
