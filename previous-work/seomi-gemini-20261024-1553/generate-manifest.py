import hashlib
import json
import pathlib

worktree = pathlib.Path('/Users/tomaszboloz/.codex/worktrees/rust-latest-review/seomi')
patch_file = pathlib.Path('/tmp/seomi-gemini-20261024-1553/native.rust-latest-v3.patch')

files = [
    'src-tauri/Cargo.lock',
    'src-tauri/Cargo.toml',
    'src-tauri/src/commands/bot_dns.rs',
    'src-tauri/src/commands/cms_patch.rs',
    'src-tauri/src/commands/pdf_report/crawl_report/detail_tables.rs',
    'src-tauri/src/commands/pdf_report/crawl_report/fixture.rs',
    'src-tauri/src/commands/rendered_artifacts/windows.rs',
    'src-tauri/src/commands/rendered_artifacts/windows_stream.rs',
    'src-tauri/src/commands/rendered_artifacts/windows_tests.rs',
    'src-tauri/src/commands/run_store/schema_concurrency_tests.rs',
    'src-tauri/src/commands/run_store/shred.rs',
    'src-tauri/src/commands/run_store/shred_tests.rs',
    'src-tauri/src/commands/search_console/ga4/report.rs',
    'src-tauri/src/commands/search_console/oauth_response.rs',
    'src-tauri/src/commands/settings/secure_store.rs',
    'src-tauri/src/commands/settings/secure_store_tests.rs',
    'src-tauri/src/commands/site_crawler/html_attribute_locator.rs',
    'src-tauri/src/commands/site_crawler/image_decoding.rs',
    'src-tauri/src/commands/site_crawler/image_decoding_modern.rs',
    'src-tauri/src/commands/site_crawler/orchestration/rendered_prefetch.rs',
    'src-tauri/src/commands/site_crawler/orchestration/rendered_prefetch_failure.rs',
    'src-tauri/src/commands/site_crawler/orchestration/summary.rs',
    'src-tauri/src/commands/site_crawler/orchestration/tests/mod.rs',
    'src-tauri/src/commands/site_crawler/orchestration/tests/rendered_prefetch_join_tests.rs',
    'src-tauri/src/commands/site_crawler/proxy_feedback_tests.rs',
    'src-tauri/src/commands/site_crawler/proxy_pool_tests.rs',
    'src-tauri/src/commands/site_crawler/resource_fetch.rs',
    'src-tauri/src/commands/site_crawler/robots_matching.rs',
    'src-tauri/src/commands/site_crawler/scoring.rs',
    'src-tauri/src/services/custom_search/validation.rs',
    'src-tauri/src/services/html_parser/accessibility/selector_matching.rs',
    'src-tauri/src/services/html_parser/structured_data/microdata.rs',
    'src-tauri/src/services/html_parser/technologies/generator.rs',
    'src-tauri/src/services/html_parser/technologies/versions.rs',
    'src-tauri/src/services/security_checker/csp_parser.rs',
    'tests/nativeCmsPatch.rs',
    'tests/nativeCmsPatchResponse.rs'
]

manifest = {}
for rel_path in files:
    p = worktree / rel_path
    data = p.read_bytes()
    manifest[rel_path] = {
        'sha256': hashlib.sha256(data).hexdigest(),
        'lines': len(p.read_text(errors='replace').splitlines())
    }

patch_data = patch_file.read_bytes()
manifest['patch'] = {
    'path': str(patch_file),
    'sha256': hashlib.sha256(patch_data).hexdigest(),
    'bytes': len(patch_data)
}

print(json.dumps(manifest, indent=2))
