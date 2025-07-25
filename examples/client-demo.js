const WebSocket = require('ws');

// Demo client showing both terminal and command execution
async function demoClient() {
  const ws = new WebSocket('ws://localhost:8080');
  
  ws.on('open', () => {
    console.log('🔗 Connected to PTY server');
    
    // Start terminal session
    ws.send(JSON.stringify({ cwd: process.cwd() }));
    
    setTimeout(() => {
      console.log('\n📝 Sending terminal input...');
      // Traditional terminal input (streaming)
      ws.send(JSON.stringify({ type: 'input', data: 'echo "Hello from terminal"\r' }));
    }, 1000);
    
    setTimeout(() => {
      console.log('\n⚡ Executing command with completion detection...');
      // NEW: Execute command and get complete result
      ws.send(JSON.stringify({
        type: 'exec',
        commandId: 'cmd1',
        command: 'ls -la | head -5',
        timeout: 5000
      }));
    }, 2000);
    
    setTimeout(() => {
      console.log('\n📦 Executing batch commands...');
      // NEW: Execute multiple commands
      ws.send(JSON.stringify({
        type: 'exec_batch',
        batchId: 'batch1',
        commands: ['pwd', 'whoami', 'date'],
        timeout: 5000
      }));
    }, 3000);
    
    setTimeout(() => {
      console.log('\n🔥 Testing error handling...');
      // NEW: Test error handling
      ws.send(JSON.stringify({
        type: 'exec',
        commandId: 'cmd2',
        command: 'nonexistent-command'
      }));
    }, 4000);
    
    setTimeout(() => {
      console.log('\n✅ Demo complete, closing...');
      ws.close();
    }, 6000);
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'output':
        // Streaming terminal output
        process.stdout.write(`[TERMINAL] ${message.data}`);
        break;
        
      case 'command_start':
        console.log(`\n🚀 Command started: ${message.command} (ID: ${message.commandId})`);
        break;
        
      case 'command_complete':
        console.log(`\n✅ Command completed: ${message.result.command}`);
        console.log(`   Exit code: ${message.result.exitCode}`);
        console.log(`   Success: ${message.result.success}`);
        console.log(`   Output: "${message.result.stdout.trim()}"`);
        if (message.result.stderr) {
          console.log(`   Error: "${message.result.stderr.trim()}"`);
        }
        break;
        
      case 'command_error':
        console.log(`\n❌ Command failed: Exit code ${message.error.exitCode}`);
        console.log(`   Error: ${message.error.message}`);
        if (message.error.stdout) {
          console.log(`   Stdout: "${message.error.stdout.trim()}"`);
        }
        break;
        
      case 'batch_complete':
        console.log(`\n📦 Batch completed (ID: ${message.batchId}):`);
        message.results.forEach((result, i) => {
          console.log(`   ${i + 1}. ${result.command}: ${result.success ? '✅' : '❌'}`);
          if (result.success) {
            console.log(`      Output: "${result.result.stdout.trim()}"`);
          } else {
            console.log(`      Error: ${result.error.message}`);
          }
        });
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  });
  
  ws.on('close', () => {
    console.log('\n🔌 Disconnected from PTY server');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
}

// Wait a bit for server to start, then run demo
setTimeout(() => {
  demoClient().catch(console.error);
}, 2000);