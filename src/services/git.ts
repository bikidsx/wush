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
    const log = await this.git.log({ from: branch, to: 'HEAD' });
    return log.all.map((commit) => `${commit.hash.slice(0, 7)} ${commit.message}`);
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
}
