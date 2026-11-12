// git-commit.mjs — perform git add + commit
import { execSync } from 'child_process';
const cwd = 'H:\\AI_OneShot_Model\\MiMo\\V2.6Pro\\操作系统嵌套';
try {
  execSync('git add -A', { cwd, stdio: 'inherit' });
  execSync('git commit -m "Nested OS: 完整嵌套操作系统桌面环境"', { cwd, stdio: 'inherit' });
  console.log('Committed OK');
} catch (e) {
  console.error('git error:', e.message);
}
