import NodeEnvironment from "jest-environment-node";
import type {
  EnvironmentContext,
  JestEnvironmentConfig,
} from "@jest/environment";

/**
 * Jest environment that pins the *process* timezone for the duration of one
 * test file.
 *
 * Why an environment and not a `beforeAll`: inside the sandbox Jest replaces
 * `process` with a copy whose `env` is a plain object behind a Proxy
 * (`createProcessObject` in `jest-util`), so `process.env.TZ = "..."` written
 * in a test never reaches libuv and has no effect on `Date`. An environment
 * module is loaded by Jest itself and runs against the *real* `process`;
 * assigning `process.env.TZ` there resets V8's timezone cache for the whole
 * isolate, including the vm context the test runs in.
 *
 * The timezone is assigned in the constructor *before* `super()`, because
 * jest-environment-node snapshots `process.env` into the sandbox while its
 * own constructor runs - assigning later would leave the sandboxed
 * `process.env.TZ` showing the host value.
 *
 * Usage - a docblock at the very top of a spec file with:
 *   @jest-environment <rootDir>/test/jest-environments/timezone.environment.ts
 *   @jest-environment-options {"timeZone": "America/Los_Angeles"}
 */
export default class TimezoneEnvironment extends NodeEnvironment {
  private previousTZ: string | undefined;

  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    const { timeZone } = config.projectConfig.testEnvironmentOptions as {
      timeZone?: string;
    };

    if (!timeZone) {
      throw new Error(
        'TimezoneEnvironment requires a timeZone, e.g. @jest-environment-options {"timeZone": "America/Los_Angeles"}',
      );
    }

    const previousTZ = process.env.TZ;
    process.env.TZ = timeZone;
    super(config, context);
    this.previousTZ = previousTZ;
  }

  async teardown(): Promise<void> {
    await super.teardown();
    // Restore, so the next file in this worker sees the host timezone again.
    if (this.previousTZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = this.previousTZ;
    }
  }
}
