import { Job, JobStatus } from '../types';
import { db } from '../database/db';

class JobQueue {
  private activeJobs: Map<string, Job> = new Map();

  createJob(
    userId: string,
    serverId: string,
    type: Job['type'],
    totalItems: number = 0
  ): Job {
    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      serverId,
      type,
      status: 'QUEUED',
      progress: 0,
      totalItems,
      processedItems: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.jobs.unshift(job);
    this.activeJobs.set(job.id, job);
    db.save();
    return job;
  }

  updateProgress(jobId: string, progress: number, processedItems?: number) {
    const job = db.jobs.find((j) => j.id === jobId);
    if (job) {
      job.status = 'RUNNING';
      job.progress = Math.min(100, Math.max(0, progress));
      if (processedItems !== undefined) job.processedItems = processedItems;
      job.updatedAt = new Date().toISOString();
      db.save();
    }
  }

  completeJob(jobId: string, result?: any) {
    const job = db.jobs.find((j) => j.id === jobId);
    if (job) {
      job.status = 'COMPLETED';
      job.progress = 100;
      job.result = result;
      job.updatedAt = new Date().toISOString();
      this.activeJobs.delete(jobId);
      db.save();
    }
  }

  failJob(jobId: string, error: string) {
    const job = db.jobs.find((j) => j.id === jobId);
    if (job) {
      job.status = 'FAILED';
      job.error = error;
      job.updatedAt = new Date().toISOString();
      this.activeJobs.delete(jobId);
      db.save();
    }
  }

  getJob(jobId: string): Job | undefined {
    return db.jobs.find((j) => j.id === jobId);
  }

  getUserJobs(userId: string): Job[] {
    return db.jobs.filter((j) => j.userId === userId).slice(0, 15);
  }
}

export const jobQueue = new JobQueue();
