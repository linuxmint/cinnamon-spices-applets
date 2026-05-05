/**
 * To be tested manually with `cjs -m <this file path>`.
 *
 * Only ✅ and ⚠️ but no ❌ should be logged. The ⚠️ messages should be checked. The `GLib-GIO-CRITICAL` can be ignored.
 */

import * as cmd from '../command_launching.js';

{
    const name = "Simple command completion without timeout";
    try {
        await cmd.launch_command(`:`, 0, 0);
        console.log(`✅ ${name}.`);
    } catch (error) {
        console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "Simple command completion with timeout";
    try {
        await cmd.launch_command(`:`, 1, 0);
        console.log(`✅ ${name}.`);
    } catch (error) {
        console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "Long-running command completion without timeout";
    try {
        await cmd.launch_command(`sleep 1`, 0, 0);
        console.log(`✅ ${name}.`);
    } catch (error) {
        console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "Long-running command completion with timeout";
    try {
        await cmd.launch_command(`sleep 1`, 2, 0);
        console.log(`✅ ${name}.`);
    } catch (error) {
        console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "SIGTERM timeout";
    try {
        await cmd.launch_command("sleep 2", 1, 1);
        console.error(`❌ ${name}.`, "No error thrown.");
    } catch (error) {
        error instanceof cmd.Error_timed_out_by_sigterm ?
            console.log(`✅ ${name}.`) :
            console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "SIGKILL timeout";
    try {
        await cmd.launch_command("trap '' TERM; sleep 2", 1, 1);
        console.error(`❌ ${name}.`, "No error thrown.");
    } catch (error) {
        error instanceof cmd.Error_timed_out_by_sigkill ?
            console.log(`✅ ${name}.`) :
            console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "SIGKILL timeout disabled when SIGTERM timeout set to 0";
    try {
        await cmd.launch_command("exec sleep 2", 0, 1);
        console.log(`✅ ${name}.`);
    } catch (error) {
        console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "Non-zero exit code";
    try {
        await cmd.launch_command("exit 42", 0, 0);
        console.error(`❌ ${name}.`, "No error thrown.");
    } catch (error) {
        error instanceof cmd.Error_failed ?
            console.log(`✅ ${name}.`) :
            console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "Non-existent command";
    try {
        await cmd.launch_command("nonexistent_command_xyz", 0, 0);
        console.error(`❌ ${name}.`, "No error thrown.");
    } catch (error) {
        error instanceof cmd.Error_failed ?
            console.log(`✅ ${name}.`) :
            console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "Wrong format";
    try {
        await cmd.launch_command("\"unclosed'", 0, 0);
        console.error(`❌ ${name}.`, "No error thrown.");
    } catch (error) {
        error instanceof cmd.Error_failed ?
            console.log(`✅ ${name}.`) :
            console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "Long-running aborted by SIGTERM returning waiting time";
    try {
        console.log(`ℹ️ ${name}. Starting test...`);
        await cmd.launch_command("sleep 5", 1, 10);
        console.error(`❌ ${name}.`, "No error thrown.");
    }
    catch (error) {
        error instanceof cmd.Error_timed_out_by_sigterm ?
            console.log(
                `⚠️  ${name}. Ensure that this message appears ~1 second and not 5 after the 'Starting test...' one above.`
            ) :
            console.error(`❌ ${name}.`, error);
    }
}
{
    const name = "Long-running aborted by SIGKILL returning waiting time";
    try {
        console.log(`ℹ️ ${name}. Starting test...`);
        await cmd.launch_command("trap '' TERM; sleep 5", 1, 1);
        console.error(`❌ ${name}.`, "No error thrown.");
    }
    catch (error) {
        error instanceof cmd.Error_timed_out_by_sigkill ?
            console.log(
                `⚠️  ${name}. Ensure that this message appears ~2 seconds and not 5 after the 'Starting test...' one above.`
            ) :
            console.error(`❌ ${name}.`, error);
    }
}
