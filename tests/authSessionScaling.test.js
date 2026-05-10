import assert from "node:assert/strict";
import {
  shouldTouchSession,
  touchSessionIfNeeded,
} from "../netlify/functions/_auth.js";

export async function runAuthSessionScalingTests() {
  assert.equal(
    shouldTouchSession(
      "2026-05-10T10:10:00.000Z",
      "2026-05-10T10:20:00.000Z",
      15 * 60 * 1000,
    ),
    false,
  );
  assert.equal(
    shouldTouchSession(
      "2026-05-10T10:00:00.000Z",
      "2026-05-10T10:20:00.000Z",
      15 * 60 * 1000,
    ),
    true,
  );

  const previousTouchInterval = process.env.SESSION_LAST_USED_TOUCH_INTERVAL_SECONDS;

  try {
    process.env.SESSION_LAST_USED_TOUCH_INTERVAL_SECONDS = "900";

    let calls = 0;
    const touched = await touchSessionIfNeeded(
      {
        async query(sql, params) {
          calls += 1;
          assert.match(sql, /update catalog_sessions/i);
          assert.equal(params[0], "sess-1");
          return { rowCount: 1 };
        },
      },
      "sess-1",
      "2026-05-10T09:30:00.000Z",
      "2026-05-10T10:00:00.000Z",
    );

    assert.equal(touched, true);
    assert.equal(calls, 1);

    calls = 0;
    const skipped = await touchSessionIfNeeded(
      {
        async query() {
          calls += 1;
          return { rowCount: 1 };
        },
      },
      "sess-2",
      "2026-05-10T09:55:00.000Z",
      "2026-05-10T10:00:00.000Z",
    );

    assert.equal(skipped, false);
    assert.equal(calls, 0);
  } finally {
    if (previousTouchInterval == null) {
      delete process.env.SESSION_LAST_USED_TOUCH_INTERVAL_SECONDS;
    } else {
      process.env.SESSION_LAST_USED_TOUCH_INTERVAL_SECONDS = previousTouchInterval;
    }
  }
}
