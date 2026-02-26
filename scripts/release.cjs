const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const releaseType = process.argv[2] || 'patch'; // patch, minor, major

if (!['patch', 'minor', 'major'].includes(releaseType)) {
  console.error('Invalid release type. Must be patch, minor, or major.');
  process.exit(1);
}

// 1. 拿上一个 tag
let prevTag = '';
try {
  prevTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
} catch (e) {
  // 如果没有找到 tag，说明是第一次发版
}

// 2. 更新版本号 (npm version 会修改 package.json 并返回新的 tag 比如 v1.1.0)
const newVersionTag = execSync(`npm version ${releaseType} --no-git-tag-version`, { encoding: 'utf8' }).trim();
const newVersion = newVersionTag.replace(/^v/, '');

// 3. 提取 Git Log
const gitLogCommand = prevTag
  ? `git log ${prevTag}..HEAD --pretty=format:"%an|%h|%s" --no-merges`
  : `git log --pretty=format:"%an|%h|%s" --no-merges`;

let commits = [];
try {
  const logOutput = execSync(gitLogCommand, { encoding: 'utf8' }).trim();
  if (logOutput) {
    commits = logOutput.split('\n');
  }
} catch (e) {
  console.error('Failed to get git log', e);
}

if (commits.length === 0) {
  console.log('No commits found since last release. Skipping changelog generation.');
  process.exit(0);
}

// 4. 清洗 commit 提取双语
const enCommits = [];
const zhCommits = [];

commits.forEach(commitLine => {
  const [author, hash, ...subjectParts] = commitLine.split('|');
  const subject = subjectParts.join('|'); // 防止标题里本身带有 | 号
  
  // 过滤一些无用 commit
  if (/^chore(?:\([^)]+\))?:/i.test(subject) && !subject.includes('release')) {
    // maybe skip chores? We'll keep them but you can filter them if you want.
  }

  // 匹配分隔
  // "feat: 中文 | English" 或 "feat: English | 中文"
  // 这里我们用最简单的逻辑：如果有 |，假设左边是主标题，右边是副标题
  // 但我们无法 100% 确定哪边是中文。通常大家写： feat: 描述 | description
  // 我们直接按原样，如果有 | , 拆成两份，没 | 就两边都放一样
  let zhText = subject;
  let enText = subject;
  
  // 尝试剥离 conventional commits 的前缀 (例如 feat, fix 等)
  const conventionalMatch = subject.match(/^([a-zA-Z]+)(?:\([^)]+\))?\s*:\s*(.*)/);
  let prefix = '';
  let content = subject;
  
  if (conventionalMatch) {
    prefix = conventionalMatch[1] + ': ';
    content = conventionalMatch[2].trim();
  }

  if (content.includes('|')) {
    const parts = content.split('|').map(s => s.trim());
    // 假设 [0] 是中文, [1] 是英文
    zhText = prefix + parts[0];
    enText = prefix + (parts[1] || parts[0]);
  } else {
    zhText = subject;
    enText = subject;
  }

  const suffix = ` ([${hash}](https://github.com/Arktomson/ajaxInterceptor/commit/${hash})) [@${author}](https://github.com/${author})`;
  
  zhCommits.push(`- ${zhText}${suffix}`);
  enCommits.push(`- ${enText}${suffix}`);
});

// 5. 拼装 Changelog 块
const date = new Date().toISOString().split('T')[0];
let newChangelogBlock = `## ${newVersion} (${date})\n\n### 🇺🇸 English\n\n${enCommits.join('\n')}\n\n### 🇨🇳 简体中文\n\n${zhCommits.join('\n')}\n\n`;

// 6. 写入 CHANGELOG.md
const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
let oldChangelog = '';
if (fs.existsSync(changelogPath)) {
  oldChangelog = fs.readFileSync(changelogPath, 'utf8');
}

// 简单拼接，把新的版本块放最前面（保留顶部的 `# ajax-hooker` 标头）
if (oldChangelog.startsWith('# ajax-hooker')) {
  oldChangelog = oldChangelog.replace(/^# ajax-hooker\n*/, '');
}

fs.writeFileSync(changelogPath, `# ajax-hooker\n\n${newChangelogBlock}${oldChangelog}`, 'utf8');

console.log(`✨ Generated release notes for v${newVersion} successfully!`);
