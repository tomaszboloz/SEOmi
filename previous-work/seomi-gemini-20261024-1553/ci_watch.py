import subprocess, json, time, datetime, sys, os

RUN_ID = "40213540803"
REPO = "tomaszboloz/SEOmi"
EXPECTED_SHA = "1b4c9692bbb2a5f02c85c457be7cc7ba154eafa4"
WATCH_FILE = "/tmp/seomi-gemini-20261024-1553/release.ci-1b4c969-watch-v10.json"
LOG_DIR = "/tmp/seomi-gemini-20261024-1553"

def query_run():
    res = subprocess.run(["gh", "api", f"/repos/{REPO}/actions/runs/{RUN_ID}"], capture_output=True, text=True)
    if res.returncode != 0:
        return None, res.stderr
    return json.loads(res.stdout), None

def query_jobs():
    res = subprocess.run(["gh", "api", f"/repos/{REPO}/actions/runs/{RUN_ID}/jobs?per_page=100"], capture_output=True, text=True)
    if res.returncode != 0:
        return None, res.stderr
    return json.loads(res.stdout).get("jobs", []), None

def download_job_log(job_id, job_name):
    safe_name = job_name.replace(" ", "_").replace("/", "_").replace("(", "").replace(")", "")
    log_path = f"{LOG_DIR}/job_{job_id}_{safe_name}.log"
    with open(log_path, "w") as fp:
        subprocess.run(["gh", "api", f"/repos/{REPO}/actions/jobs/{job_id}/logs"], stdout=fp, stderr=subprocess.PIPE)
    return log_path

def main(max_cycles=30, sleep_sec=35):
    for cycle in range(1, max_cycles + 1):
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        run_data, err = query_run()
        if not run_data:
            print(f"[{now_iso}] Error querying run: {err}", file=sys.stderr)
            time.sleep(sleep_sec)
            continue

        head_sha = run_data.get("head_sha")
        if head_sha != EXPECTED_SHA:
            print(f"[{now_iso}] HEAD SHA mismatch! Expected {EXPECTED_SHA}, got {head_sha}", file=sys.stderr)
            sys.exit(1)

        run_status = run_data.get("status")
        run_conclusion = run_data.get("conclusion")
        jobs, err = query_jobs()
        if jobs is None:
            print(f"[{now_iso}] Error querying jobs: {err}", file=sys.stderr)
            time.sleep(sleep_sec)
            continue

        job_summaries = []
        has_failure = False
        failed_job_info = None

        for j in jobs:
            j_id = j.get("id")
            j_name = j.get("name")
            j_status = j.get("status")
            j_conclusion = str(j.get("conclusion"))
            steps = j.get("steps", [])
            active = [s.get("name") for s in steps if s.get("status") == "in_progress"]
            active_step = active[0] if active else None
            completed_steps = len([s for s in steps if s.get("status") == "completed"])
            
            job_summaries.append({
                "id": j_id,
                "name": j_name,
                "status": j_status,
                "conclusion": j_conclusion,
                "completedSteps": f"{completed_steps}/{len(steps)}",
                "activeStep": active_step
            })

            if j_conclusion == "failure" or (j_status == "completed" and j_conclusion not in ["success", "skipped"]):
                has_failure = True
                failed_job_info = (j_id, j_name, j_conclusion)

        watch_record = {
            "timestamp": now_iso,
            "cycle": cycle,
            "runId": RUN_ID,
            "headSha": head_sha,
            "runStatus": run_status,
            "runConclusion": str(run_conclusion),
            "jobsCount": len(jobs),
            "jobs": job_summaries
        }

        # Write current snapshot
        with open(WATCH_FILE, "w") as fp:
            json.dump(watch_record, fp, indent=2)

        # Print concise one-line status
        in_progress_names = [j["name"] for j in job_summaries if j["status"] == "in_progress"]
        success_count = len([j for j in job_summaries if j["conclusion"] == "success"])
        print(f"[{now_iso}] Cycle {cycle}: status={run_status}, conc={run_conclusion}, success={success_count}/{len(jobs)}, in_progress={in_progress_names}")

        if has_failure:
            j_id, j_name, j_conc = failed_job_info
            print(f"[{now_iso}] DETECTED FAILURE in job {j_id} ({j_name}): {j_conc}", file=sys.stderr)
            log_path = download_job_log(j_id, j_name)
            print(f"Downloaded log to {log_path}", file=sys.stderr)
            watch_record["failedJobLog"] = log_path
            with open(WATCH_FILE, "w") as fp:
                json.dump(watch_record, fp, indent=2)
            sys.exit(2)

        if run_status == "completed":
            print(f"[{now_iso}] Run {RUN_ID} completed with conclusion: {run_conclusion}")
            sys.exit(0)

        if cycle < max_cycles:
            time.sleep(sleep_sec)

if __name__ == "__main__":
    max_c = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    sleep_s = int(sys.argv[2]) if len(sys.argv) > 2 else 35
    main(max_cycles=max_c, sleep_sec=sleep_s)
