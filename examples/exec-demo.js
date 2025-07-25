const pty = require('../lib/index.js');

async function demoExecVsSpawn() {
  console.log('=== node-pty exec() vs spawn() Demo ===\n');

  try {
    // Demo 1: Using new exec() function for complete results
    console.log('1. Using exec() for complete command results:');
    const result = await pty.exec('ls -la', { timeout: 5000 });
    console.log('✓ Command:', result.command);
    console.log('✓ Exit code:', result.exitCode);
    console.log('✓ Output length:', result.stdout.length, 'characters');
    console.log('✓ First few lines of output:');
    console.log(result.stdout.split('\n').slice(0, 3).join('\n'));

    console.log('\n' + '='.repeat(50) + '\n');

    // Demo 2: Using traditional spawn() for streaming
    console.log('2. Using spawn() for streaming output:');
    const ptyProcess = pty.spawn('bash', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    let streamOutput = '';
    ptyProcess.onData((data) => {
      streamOutput += data;
      process.stdout.write(data); // Show real-time output
    });

    ptyProcess.write('echo "Hello from streaming terminal"\r');
    ptyProcess.write('date\r');
    ptyProcess.write('exit\r');

    // Wait for process to finish
    await new Promise((resolve) => {
      ptyProcess.onExit(() => {
        console.log('\n✓ Streaming process finished');
        console.log('✓ Total streamed data:', streamOutput.length, 'characters');
        resolve();
      });
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // Demo 3: exec() with error handling
    console.log('3. Testing exec() error handling:');
    try {
      await pty.exec('nonexistent-command');
    } catch (error) {
      console.log('✓ Caught expected error:', error.message);
      console.log('✓ Exit code:', error.exitCode);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Demo 4: exec() with different options
    console.log('4. exec() with custom options:');
    const result2 = await pty.exec('echo $USER && pwd', {
      shell: true,
      cwd: '/tmp',
      timeout: 3000,
      stripFinalNewline: true
    });
    console.log('✓ Command output:', JSON.stringify(result2.stdout));
    console.log('✓ Working directory was /tmp');

  } catch (error) {
    console.error('Demo error:', error.message);
  }

  console.log('\n=== Demo Complete ===');
  console.log('\nKey Differences:');
  console.log('• exec(): Promise-based, returns complete result, like execa');
  console.log('• spawn(): Event-based, streaming output, original node-pty API');
  console.log('\nBoth approaches work with the same underlying pty system!');
}

// Run the demo
demoExecVsSpawn().catch(console.error);
