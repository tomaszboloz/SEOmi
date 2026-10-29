# Raw command logs

RTK preserved raw outputs at these paths on the host:

- `~/Library/Application Support/rtk/tee/1793067014_cargo_clippy.log` — initial clippy audit (fixed unused PDF label).
- `~/Library/Application Support/rtk/tee/1793067517_cargo_test.log` — initial PDF assertion before profile text ordering fix.
- `~/Library/Application Support/rtk/tee/1793067616_cargo_test.log` — diagnostic PDF text capture.
- `~/Library/Application Support/rtk/tee/1793067290_tsc.log` — initial test cast failure (fixed).

Final PASS command output is recorded in `commands.log`; final commands were rerun through the shared validation lock.
