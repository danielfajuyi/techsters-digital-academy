import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('Starting Techsters LMS...\n');
console.log(' - Server: http://localhost:5000');
console.log(' - Client: http://localhost:5173\n');

const serverProc = spawn(npmCmd, ['run', 'dev', '--prefix', 'server'], {
  stdio: 'inherit',
  shell: isWin,
});

const clientProc = spawn(npmCmd, ['run', 'dev', '--prefix', 'client'], {
  stdio: 'inherit',
  shell: isWin,
});

function cleanup() {
  serverProc.kill();
  clientProc.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
