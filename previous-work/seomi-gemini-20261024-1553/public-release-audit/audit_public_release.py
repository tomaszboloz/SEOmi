#!/usr/bin/env python3
"""Read-only public SEOmi release audit.

Usage (only after the requested release is public):
  python3 audit_public_release.py v0.4.41 <expected-commit-sha> <Kingston-output-dir>

The audit deliberately uses the public GitHub API and unauthenticated release
asset URLs.  The only privileged operation is the explicit `gh attestation
verify` command; its JSON output is retained as evidence and is never inferred
from release-provenance.json.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


REPOSITORY = "tomaszboloz/SEOmi"
REQUIRED_TAG = "v0.4.41"
REQUIRED_PLATFORMS = ("darwin-aarch64", "darwin-x86_64", "windows-x86_64")
UPDATER_PLATFORM_ARTIFACTS = {
    "darwin-aarch64": "SEOmi_aarch64.app.tar.gz",
    "darwin-x86_64": "SEOmi_x64.app.tar.gz",
}
PUBLIC_KEY_PATH = "src-tauri/tauri.conf.json"
SIGNER_WORKFLOW = "tomaszboloz/SEOmi/.github/workflows/release.yml"


class AuditFailure(RuntimeError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def assert_sha(value: str, label: str) -> str:
    if not re.fullmatch(r"[0-9a-fA-F]{64}", value or ""):
        raise AuditFailure(f"{label} is not a SHA-256 digest")
    return value.lower()


def assert_commit_sha(value: str) -> str:
    if not re.fullmatch(r"[0-9a-fA-F]{40}", value or ""):
        raise AuditFailure("expected commit SHA must be 40 hexadecimal characters")
    return value.lower()


def version_from_tag(tag: str) -> str:
    if tag != REQUIRED_TAG:
        raise AuditFailure(f"refusing tag {tag!r}; this audit is exclusively for {REQUIRED_TAG}")
    return tag[1:]


def require_kingston_output(path: str) -> Path:
    candidate = Path(path).expanduser()
    if not candidate.is_absolute() or not str(candidate).startswith("/Volumes/Kingston/"):
        raise AuditFailure("output directory must be an absolute path under /Volumes/Kingston/")
    candidate.mkdir(parents=True, exist_ok=True)
    if not candidate.is_dir():
        raise AuditFailure(f"output path is not a directory: {candidate}")
    return candidate


def public_json(url: str) -> Any:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "api.github.com":
        raise AuditFailure(f"refusing non-public GitHub API URL: {url}")
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "SEOmi-public-release-audit/1"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise AuditFailure(f"public GitHub API request failed: {url}: {error}") from error


def resolve_public_tag(tag: str, expected_sha: str) -> dict[str, Any]:
    expected_sha = assert_commit_sha(expected_sha)
    ref_url = f"https://api.github.com/repos/{REPOSITORY}/git/ref/tags/{urllib.parse.quote(tag, safe='v.') }"
    ref = public_json(ref_url)
    obj = ref.get("object") if isinstance(ref, dict) else None
    if not isinstance(obj, dict) or obj.get("type") not in ("commit", "tag"):
        raise AuditFailure("public tag ref has no commit/tag object")
    resolved_sha = str(obj.get("sha", "")).lower()
    if obj.get("type") == "tag":
        annotated = public_json(f"https://api.github.com/repos/{REPOSITORY}/git/tags/{resolved_sha}")
        resolved_sha = str(((annotated or {}).get("object") or {}).get("sha", "")).lower()
    if resolved_sha != expected_sha:
        raise AuditFailure(f"public tag {tag} resolves to {resolved_sha}, expected {expected_sha}")
    release = public_json(f"https://api.github.com/repos/{REPOSITORY}/releases/tags/{urllib.parse.quote(tag, safe='v.')}")
    if release.get("tag_name") != tag or release.get("draft") is not False or release.get("prerelease") is not False:
        raise AuditFailure("release is not the published non-prerelease release for the requested tag")
    if not release.get("published_at"):
        raise AuditFailure("published release has no published_at timestamp")
    return {"tagSha": resolved_sha, "release": release}


def inventory_assets(release: dict[str, Any], version: str) -> dict[str, dict[str, Any]]:
    assets = release.get("assets")
    if not isinstance(assets, list) or not assets:
        raise AuditFailure("published release has no assets")
    inventory: dict[str, dict[str, Any]] = {}
    for asset in assets:
        name = asset.get("name") if isinstance(asset, dict) else None
        if not isinstance(name, str) or not name or name in inventory:
            raise AuditFailure(f"release asset inventory contains a missing or duplicate name: {name!r}")
        if asset.get("state") != "uploaded" or int(asset.get("size", 0) or 0) <= 0:
            raise AuditFailure(f"release asset is not a non-empty uploaded asset: {name}")
        url = asset.get("browser_download_url")
        if not isinstance(url, str) or not url.startswith(f"https://github.com/{REPOSITORY}/releases/download/{REQUIRED_TAG}/"):
            raise AuditFailure(f"asset {name} has an unexpected public download URL")
        inventory[name] = asset

    required = {
        "SEOmi_aarch64.app.tar.gz",
        "SEOmi_x64.app.tar.gz",
        f"SEOmi_{version}_x64-setup.exe",
        f"SEOmi_{version}_x64_en-US.msi",
        f"SEOmi_{version}_aarch64.dmg",
        f"SEOmi_{version}_x64.dmg",
        "latest.json",
        "SHA256SUMS.txt",
        "sbom-node.json",
        "sbom-rust.json",
        "release-provenance.json",
    }
    required.update({f"{name}.sig" for name in (
        "SEOmi_aarch64.app.tar.gz", "SEOmi_x64.app.tar.gz",
        f"SEOmi_{version}_x64-setup.exe", f"SEOmi_{version}_x64_en-US.msi",
    )})
    missing = sorted(required - inventory.keys())
    if missing:
        raise AuditFailure(f"published release is missing required assets: {', '.join(missing)}")
    return inventory


def download_public_asset(asset: dict[str, Any], output_dir: Path) -> Path:
    name = asset["name"]
    if Path(name).name != name or name in (".", ".."):
        raise AuditFailure(f"unsafe release asset name: {name}")
    destination = output_dir / name
    url = asset["browser_download_url"]
    request = urllib.request.Request(url, headers={"User-Agent": "SEOmi-public-release-audit/1"})
    temporary = output_dir / f".{name}.part"
    try:
        with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
        os.replace(temporary, destination)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass
        raise AuditFailure(f"public asset download failed for {name}: {error}") from error
    if destination.stat().st_size <= 0:
        raise AuditFailure(f"downloaded asset is empty: {name}")
    return destination


def read_checksums(path: Path, expected_names: set[str]) -> dict[str, str]:
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(lines) != 7:
        raise AuditFailure(f"SHA256SUMS.txt must contain exactly 7 subjects, found {len(lines)}")
    checksums: dict[str, str] = {}
    for line in lines:
        match = re.fullmatch(r"([0-9a-fA-F]{64})  (.+)", line)
        if not match:
            raise AuditFailure(f"invalid SHA256SUMS.txt line: {line!r}")
        digest, name = match.groups()
        if name in checksums or name not in expected_names:
            raise AuditFailure(f"unexpected or duplicate SHA256SUMS subject: {name}")
        checksums[name] = digest.lower()
    if set(checksums) != expected_names:
        raise AuditFailure(f"SHA256SUMS subjects differ from release inventory: {sorted(checksums)}")
    return checksums


def validate_latest(path: Path, downloaded: dict[str, Path], version: str) -> dict[str, str]:
    latest = json.loads(path.read_text(encoding="utf-8"))
    if latest.get("version") != version or set(latest.get("platforms", {})) != set(REQUIRED_PLATFORMS):
        raise AuditFailure("latest.json version/platform set is not exactly the required v0.4.41 contract")
    selected: dict[str, str] = {}
    allowed_windows = {f"SEOmi_{version}_x64-setup.exe", f"SEOmi_{version}_x64_en-US.msi"}
    expected = {**UPDATER_PLATFORM_ARTIFACTS, "windows-x86_64": None}
    for platform in REQUIRED_PLATFORMS:
        entry = latest["platforms"].get(platform)
        if not isinstance(entry, dict) or set(entry) != {"signature", "url"}:
            raise AuditFailure(f"latest.json entry is invalid for {platform}")
        url = entry["url"]
        if not isinstance(url, str) or not url.startswith(f"https://github.com/{REPOSITORY}/releases/download/{REQUIRED_TAG}/"):
            raise AuditFailure(f"latest.json URL is not bound to the public requested release: {platform}")
        name = urllib.parse.unquote(urllib.parse.urlparse(url).path.rsplit("/", 1)[-1])
        allowed = allowed_windows if platform == "windows-x86_64" else {expected[platform]}
        if name not in allowed or url != f"https://github.com/{REPOSITORY}/releases/download/{REQUIRED_TAG}/{name}":
            raise AuditFailure(f"latest.json URL is not an exact expected updater URL for {platform}: {url}")
        signature = entry["signature"]
        if not isinstance(signature, str) or not signature.strip() or signature != downloaded[f"{name}.sig"].read_text(encoding="utf-8").strip():
            raise AuditFailure(f"latest.json signature does not exactly match paired {name}.sig")
        selected[platform] = name
    return selected


def validate_provenance(path: Path, checksums: dict[str, str], downloaded: dict[str, Path], expected_sha: str, version: str) -> dict[str, Any]:
    provenance = json.loads(path.read_text(encoding="utf-8"))
    if provenance.get("repository") != REPOSITORY or provenance.get("tag") != REQUIRED_TAG:
        raise AuditFailure("release-provenance.json repository/tag mismatch")
    if str(provenance.get("commitSha", "")).lower() != expected_sha:
        raise AuditFailure("release-provenance.json commitSha mismatch")
    if provenance.get("version") != version:
        raise AuditFailure("release-provenance.json version mismatch")
    subjects = provenance.get("subjects")
    if not isinstance(subjects, list) or {s.get("name") for s in subjects} != set(checksums):
        raise AuditFailure("release-provenance.json subjects do not exactly match SHA256SUMS.txt")
    for subject in subjects:
        name = subject["name"]
        if subject.get("sha256", "").lower() != checksums[name] or subject.get("sha256", "").lower() != sha256_file(downloaded[name]):
            raise AuditFailure(f"provenance/checksum/download hash mismatch for {name}")
        if int(subject.get("size", -1)) != downloaded[name].stat().st_size:
            raise AuditFailure(f"provenance/download size mismatch for {name}")
    sbom_entries = provenance.get("sboms")
    if not isinstance(sbom_entries, list) or {s.get("name") for s in sbom_entries} != {"sbom-node.json", "sbom-rust.json"}:
        raise AuditFailure("release-provenance.json must name both SBOMs")
    for sbom in sbom_entries:
        name = sbom["name"]
        if sbom.get("sha256", "").lower() != sha256_file(downloaded[name]):
            raise AuditFailure(f"SBOM hash mismatch for {name}")
    return provenance


def attestation_command(subject: str, expected_sha: str) -> list[str]:
    return [
        "gh", "attestation", "verify", subject,
        "--repo", REPOSITORY,
        "--source-digest", expected_sha,
        "--source-ref", "refs/heads/main",
        "--signer-workflow", SIGNER_WORKFLOW,
        "--signer-digest", expected_sha,
        "--deny-self-hosted-runners",
        "--format", "json",
    ]


def run_attestations(checksums: dict[str, str], downloaded: dict[str, Path], output_dir: Path, expected_sha: str) -> dict[str, Any]:
    if shutil.which("gh") is None:
        raise AuditFailure("gh CLI is unavailable; attestation verification is pending")
    results: dict[str, Any] = {}
    for subject in checksums:
        command = attestation_command(str(downloaded[subject]), expected_sha)
        evidence_path = output_dir / f"attestation-{subject}.json"
        with evidence_path.open("w", encoding="utf-8") as evidence:
            result = subprocess.run(command, stdout=evidence, stderr=subprocess.STDOUT, text=True, check=False)
        if result.returncode != 0:
            raise AuditFailure(f"gh attestation verify failed for {subject}; see {evidence_path}")
        results[subject] = {"exitCode": result.returncode, "command": command, "evidence": str(evidence_path)}
    return results


def verify_minisign(downloaded: dict[str, Path], selected: dict[str, str], output_dir: Path, source_root: Path) -> dict[str, Any]:
    minisign = shutil.which("minisign")
    if minisign is None:
        return {"status": "pending-cryptographic-verification", "reason": "minisign CLI unavailable", "artifacts": {}}
    config_path = source_root / PUBLIC_KEY_PATH
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
        encoded = config["plugins"]["updater"]["pubkey"]
        public_key = base64.b64decode(encoded, validate=True)
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise AuditFailure(f"could not decode updater public key from {config_path}: {error}") from error
    if not public_key.startswith(b"untrusted comment: minisign public key:"):
        raise AuditFailure("decoded updater public key is not a minisign public-key document")
    public_path = output_dir / "tauri-minisign.pub"
    public_path.write_bytes(public_key)
    artifacts = set(selected.values())
    artifacts.update({"SEOmi_aarch64.app.tar.gz", "SEOmi_x64.app.tar.gz", "SEOmi_0.4.41_x64-setup.exe", "SEOmi_0.4.41_x64_en-US.msi"})
    results: dict[str, Any] = {}
    for name in sorted(artifacts):
        signature = f"{name}.sig"
        command = [minisign, "-Vm", str(downloaded[name]), "-x", str(downloaded[signature]), "-p", str(public_path)]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, check=False)
        results[name] = {"exitCode": result.returncode, "output": result.stdout}
        if result.returncode != 0:
            raise AuditFailure(f"minisign verification failed for {name}: {result.stdout.strip()}")
    return {"status": "verified", "publicKeyPath": str(public_path), "artifacts": results}


def audit(tag: str, expected_sha: str, output_dir_arg: str, source_root_arg: str | None = None) -> dict[str, Any]:
    version = version_from_tag(tag)
    expected_sha = assert_commit_sha(expected_sha)
    output_dir = require_kingston_output(output_dir_arg)
    source_root = Path(source_root_arg or "/Users/tomaszboloz/.codex/worktrees/release-next/seomi")
    resolved = resolve_public_tag(tag, expected_sha)
    release = resolved["release"]
    assets = inventory_assets(release, version)

    needed = set(assets)
    downloaded = {name: download_public_asset(assets[name], output_dir) for name in sorted(needed)}
    expected_subjects = {
        "SEOmi_aarch64.app.tar.gz", "SEOmi_x64.app.tar.gz",
        f"SEOmi_{version}_x64-setup.exe", f"SEOmi_{version}_x64_en-US.msi",
        f"SEOmi_{version}_aarch64.dmg", f"SEOmi_{version}_x64.dmg", "latest.json",
    }
    checksums = read_checksums(downloaded["SHA256SUMS.txt"], expected_subjects)
    selected = validate_latest(downloaded["latest.json"], downloaded, version)
    provenance = validate_provenance(downloaded["release-provenance.json"], checksums, downloaded, expected_sha, version)
    attestation = run_attestations(checksums, downloaded, output_dir, expected_sha)
    minisign = verify_minisign(downloaded, selected, output_dir, source_root)

    hashes = {name: {"sha256": sha256_file(path), "size": path.stat().st_size} for name, path in downloaded.items()}
    report = {
        "status": "pass" if minisign["status"] == "verified" else minisign["status"],
        "repository": REPOSITORY, "tag": tag, "expectedCommitSha": expected_sha,
        "resolvedTagSha": resolved["tagSha"], "releaseId": release.get("id"),
        "publishedAt": release.get("published_at"), "assetCount": len(assets),
        "inventory": {"complete": True, "duplicateNames": False, "requiredAssetsPresent": True},
        "selectedUpdaterPlatforms": selected, "sha256sumsSubjects": checksums,
        "downloadDirectory": str(output_dir), "downloadHashes": hashes,
        "provenance": {"commitSha": provenance["commitSha"], "version": provenance["version"], "sbomHashes": {s["name"]: s["sha256"] for s in provenance["sboms"]}},
        "attestations": attestation, "minisign": minisign,
        "note": "release-provenance.json was checked as metadata only; attestation results come solely from gh attestation verify.",
    }
    (output_dir / "public-release-audit.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tag")
    parser.add_argument("expected_sha")
    parser.add_argument("output_dir")
    parser.add_argument("--source-root", default=None, help="source checkout containing src-tauri/tauri.conf.json")
    args = parser.parse_args(argv)
    try:
        report = audit(args.tag, args.expected_sha, args.output_dir, args.source_root)
        print(json.dumps({"status": report["status"], "output": report["downloadDirectory"], "assetCount": report["assetCount"]}, indent=2))
        return 0 if report["status"] == "pass" else 2
    except AuditFailure as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
