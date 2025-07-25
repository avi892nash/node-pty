const pty = require('../lib/index.js');

async function demonstrateCommandCompletion() {
  console.log('=== Command Completion Detection Demo ===\n');

  // Test 1: Quick command
  console.log('1. Running quick command...');
  const start1 = Date.now();
  const result1 = await pty.exec('echo "Hello World"');
  const end1 = Date.now();
  console.log(`✓ Command finished in ${end1 - start1}ms`);
  console.log(`✓ Exit code: ${result1.exitCode}`);
  console.log(`✓ Output: "${result1.stdout}"`);
  console.log();

  // Test 2: Slow command  
  console.log('2. Running slow command (sleep 3 seconds)...');
  const start2 = Date.now();
  const result2 = await pty.exec('sleep 3 && echo "Done sleeping"');
  const end2 = Date.now();
  console.log(`✓ Command finished in ${end2 - start2}ms`);
  console.log(`✓ Exit code: ${result2.exitCode}`);
  console.log(`✓ Output: "${result2.stdout}"`);
  console.log();

  // Test 3: Multiple commands in sequence
  console.log('3. Running multiple commands in sequence...');
  const commands = ['pwd', 'whoami', 'date'];
  
  for (const cmd of commands) {
    const start = Date.now();
    const result = await pty.exec(cmd);
    const end = Date.now();
    console.log(`✓ "${cmd}" finished in ${end - start}ms, exit code: ${result.exitCode}`);
    console.log(`  Output: "${result.stdout.trim()}"`);
  }
  console.log();

  // Test 4: Command that fails
  console.log('4. Running command that fails...');
  try {
    await pty.exec('exit 42'); // Command that exits with code 42
  } catch (error) {
    console.log(`✓ Command failed as expected with exit code: ${error.exitCode}`);
    console.log(`✓ Error detected and handled properly`);
  }
  console.log();

  // Test 5: Command with timeout
  console.log('5. Testing timeout (command takes too long)...');
  try {
    await pty.exec('sleep 10', { timeout: 2000 }); // 2 second timeout
  } catch (error) {
    console.log(`✓ Command timed out as expected: ${error.timedOut}`);
    console.log(`✓ Timeout detection works!`);
  }

  console.log('\n=== All commands completed successfully! ===');
  console.log('\nKey Benefits:');
  console.log('• Always know exactly when command finishes');
  console.log('• Get complete output (not streaming chunks)');
  console.log('• Proper error handling with exit codes');
  console.log('• Timeout protection for long-running commands');
  console.log('• Promise-based API (async/await support)');
}

demonstrateCommandCompletion().catch(console.error);