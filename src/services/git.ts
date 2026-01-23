import simpleGit, { SimpleGit, BranchSummary } from 'simple-git';

export class GitService {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async getStagedDiff(): Promise<string> {
    const diff = await this.git.diff(['--cached']);
    return diff;
  }

  async getStatus(): Promise<any> {
    return await this.git.status();
  }

  async commit(message: string): Promise<void> {
    await this.git.commit(message);
  }

  async getCurrentBranch(): Promise<string> {
    const branch = await this.git.branch();
    return branch.current;
  }

  async getCommitsSince(branch: string): Promise<string[]> {
    try {
      // Get commits that are in HEAD but not in target branch
      // This ensures we only get commits unique to current branch
      const log = await this.git.log([`${branch}..HEAD`]);
      return log.all.map((commit) => `${commit.hash.slice(0, 7)} ${commit.message}`);
    } catch {
      // Fallback: try with origin/ prefix for remote branches
      try {
        const log = await this.git.log([`origin/${branch}..HEAD`]);
        return log.all.map((commit) => `${commit.hash.slice(0, 7)} ${commit.message}`);
      } catch {
        return [];
      }
    }
  }

  async getDiffBetweenBranches(targetBranch: string): Promise<string> {
    try {
      // Get diff between target branch and current HEAD
      const diff = await this.git.diff([`${targetBranch}...HEAD`]);
      return diff;
    } catch {
      // Fallback: try with origin/ prefix
      try {
        const diff = await this.git.diff([`origin/${targetBranch}...HEAD`]);
        return diff;
      } catch {
        return '';
      }
    }
  }

  async stageAll(): Promise<void> {
    await this.git.add('.');
  }

  async createBranch(name: string): Promise<void> {
    await this.git.checkoutLocalBranch(name);
  }

  async getBranches(): Promise<BranchSummary> {
    return await this.git.branch();
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch);
  }

  async deleteBranch(branch: string): Promise<void> {
    await this.git.deleteLocalBranch(branch);
  }

  async getRemoteUrl(): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      return origin?.refs?.fetch || origin?.refs?.push || null;
    } catch {
      return null;
    }
  }

  async hasUpstream(): Promise<boolean> {
    try {
      const branch = await this.getCurrentBranch();
      const result = await this.git.raw(['config', `branch.${branch}.remote`]);
      return !!result.trim();
    } catch {
      return false;
    }
  }

  async push(options?: { force?: boolean; setUpstream?: boolean }): Promise<void> {
    const args: string[] = [];
    
    if (options?.setUpstream) {
      args.push('-u', 'origin', await this.getCurrentBranch());
    }
    
    if (options?.force) {
      args.push('--force');
    }

    await this.git.push(args);
  }

  async pull(options?: { rebase?: boolean; force?: boolean }): Promise<void> {
    const args: string[] = [];

    if (options?.rebase) {
      args.push('--rebase');
    }

    if (options?.force) {
      args.push('--force');
    }

    if (args.length > 0) {
      await this.git.pull(args);
    } else {
      await this.git.pull();
    }
  }
}
