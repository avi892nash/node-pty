const WebSocket = require('ws');
const pty = require('../lib/index.js'); // Use our enhanced version
const net = require('net');

console.log('[PTY SERVER] Starting Enhanced PTY WebSocket server...');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.on('error', () => {
      resolve(false);
    });
  });
}

async function findAvailablePort() {
  for (let port = 8080; port < 8180; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error('No available port found');
}

async function startServer() {
  const port = await findAvailablePort();
  const wss = new WebSocket.Server({ port });
  return { port, wss };
}

(async () => {
  const { port, wss } = await startServer();

  process.env.PTY_SERVER_PORT = port.toString();
  if (process.send) {
    process.send({ type: 'port', port });
  }

  wss.on('connection', function connection(ws, req) {
    console.log(`[PTY SERVER] New WebSocket connection from ${req.socket.remoteAddress}:${req.socket.remotePort}`);
    
    let ptyProcess = null;
    let started = false;
    let shell, shellArgs, cwd;
    let connectionId = Date.now().toString(36);

    ws.on('message', async (msg) => {
      let message;
      try {
        message = JSON.parse(msg);
      } catch (e) {
        return;
      }
      
      if (!started) {
        shell = process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : 'bash');
        shellArgs = [];
        if (process.platform !== 'win32') {
          shellArgs.push('-l');
        }
        cwd = message.cwd || process.env.HOME;
        
        try {
          ptyProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd,
            env: process.env
          });
          
          // Send pty output to client (streaming)
          ptyProcess.onData(data => {
            ws.send(JSON.stringify({ type: 'output', data }));
          });
          
          ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`[PTY SERVER] [${connectionId}] Process exited with code ${exitCode}, signal: ${signal}`);
            ws.close();
          });
          
          started = true;
          return;
        } catch (error) {
          console.error(`[PTY SERVER] [${connectionId}] Failed to spawn PTY process:`, error);
          ws.close();
          return;
        }
      }
      
      // Handle different message types
      if (message.type === 'input') {
        if (ptyProcess) {
          ptyProcess.write(message.data);
        }
      } 
      else if (message.type === 'resize') {
        if (ptyProcess) {
          ptyProcess.resize(message.cols, message.rows);
        }
      }
      // NEW: Handle command execution with completion detection
      else if (message.type === 'exec') {
        try {
          console.log(`[PTY SERVER] [${connectionId}] Executing command: ${message.command}`);
          
          // Send command start notification
          ws.send(JSON.stringify({
            type: 'command_start',
            commandId: message.commandId,
            command: message.command
          }));
          
          // Execute command and wait for completion
          const result = await pty.exec(message.command, {
            cwd: message.cwd || cwd,
            timeout: message.timeout || 30000,
            shell: message.shell !== false, // Default to shell mode
            env: process.env
          });
          
          // Send complete result back
          ws.send(JSON.stringify({
            type: 'command_complete',
            commandId: message.commandId,
            result: {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
              command: result.command,
              timedOut: result.timedOut,
              success: result.exitCode === 0
            }
          }));
          
          console.log(`[PTY SERVER] [${connectionId}] Command completed: ${message.command} (exit code: ${result.exitCode})`);
          
        } catch (error) {
          // Send error result back
          ws.send(JSON.stringify({
            type: 'command_error',
            commandId: message.commandId,
            error: {
              message: error.message,
              exitCode: error.exitCode,
              stdout: error.stdout || '',
              stderr: error.stderr || '',
              timedOut: error.timedOut || false
            }
          }));
          
          console.error(`[PTY SERVER] [${connectionId}] Command failed: ${message.command}`, error.message);
        }
      }
      // NEW: Handle batch command execution
      else if (message.type === 'exec_batch') {
        try {
          console.log(`[PTY SERVER] [${connectionId}] Executing batch commands:`, message.commands);
          
          const results = [];
          for (const cmd of message.commands) {
            try {
              const result = await pty.exec(cmd, {
                cwd: message.cwd || cwd,
                timeout: message.timeout || 30000,
                shell: message.shell !== false,
                env: process.env
              });
              results.push({ command: cmd, result, success: true });
            } catch (error) {
              results.push({ 
                command: cmd, 
                error: {
                  message: error.message,
                  exitCode: error.exitCode,
                  stdout: error.stdout || '',
                  stderr: error.stderr || ''
                }, 
                success: false 
              });
            }
          }
          
          ws.send(JSON.stringify({
            type: 'batch_complete',
            batchId: message.batchId,
            results
          }));
          
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'batch_error',
            batchId: message.batchId,
            error: error.message
          }));
        }
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[PTY SERVER] [${connectionId}] WebSocket closed: ${code} ${reason}`);
      if (ptyProcess) {
        ptyProcess.kill();
      }
    });

    ws.on('error', (error) => {
      console.error(`[PTY SERVER] [${connectionId}] WebSocket error:`, error);
    });
  });

  wss.on('error', (error) => {
    console.error('[PTY SERVER] WebSocket server error:', error);
  });

  console.log('[PTY SERVER] Enhanced PTY WebSocket server running on ws://localhost:' + port);
  console.log('[PTY SERVER] Supports both streaming terminal and command execution!');
})();