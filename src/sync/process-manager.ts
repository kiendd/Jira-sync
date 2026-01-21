import { fork, ChildProcess } from 'child_process';
import path from 'path';
import { logger } from '../config/index.js';
import { SyncPairConfig } from './config-loader.js';

interface WorkerInfo {
  config: SyncPairConfig;
  process: ChildProcess;
  lastHeartbeat: Date | null;
  status: 'running' | 'stopped' | 'error';
}

interface WorkerStatus {
  name: string;
  status: string;
  lastHeartbeat: string | null;
  pid: number | null;
}

export class ProcessManager {
  private workers: Map<string, WorkerInfo> = new Map();
  private isShuttingDown = false;

  startWorkers(configs: SyncPairConfig[]): void {
    logger.info({ count: configs.length }, 'Starting worker processes');

    for (const cfg of configs) {
      this.startWorker(cfg);
    }

    this.startHeartbeatMonitor();
  }

  private startWorker(cfg: SyncPairConfig): void {
    const workerScript = path.resolve(process.cwd(), 'dist/sync/worker.js');

    const env = {
      ...process.env,
      WORKER_NAME: cfg.name,
      WORKER_CONFIG_PATH: cfg.configPath,
      DATABASE_NAME: cfg.config.name || cfg.name,
    };

    const worker = fork(workerScript, [], {
      env,
      stdio: 'pipe',
    });

    const workerInfo: WorkerInfo = {
      config: cfg,
      process: worker,
      lastHeartbeat: null,
      status: 'running',
    };

    this.workers.set(cfg.name, workerInfo);

    worker.on('message', (message: any) => {
      if (message.type === 'heartbeat') {
        workerInfo.lastHeartbeat = new Date();
        logger.debug({ worker: cfg.name }, 'Received heartbeat from worker');
      }
    });

    worker.on('error', (err) => {
      logger.error({ worker: cfg.name, err }, 'Worker process error');
      workerInfo.status = 'error';
    });

    worker.on('exit', (code) => {
      if (this.isShuttingDown) {
        logger.info({ worker: cfg.name, code }, 'Worker exited during shutdown');
        return;
      }

      logger.warn({ worker: cfg.name, code }, 'Worker process exited unexpectedly');
      workerInfo.status = 'stopped';

      if (code !== 0) {
        this.restartWorker(cfg);
      }
    });

    worker.stdout?.on('data', (data) => {
      process.stdout.write(`[${cfg.name}] ${data}`);
    });

    worker.stderr?.on('data', (data) => {
      process.stderr.write(`[${cfg.name}] ${data}`);
    });

    logger.info({ worker: cfg.name, pid: worker.pid }, 'Worker process started');
  }

  private restartWorker(cfg: SyncPairConfig): void {
    const maxRetries = 3;
    const workerInfo = this.workers.get(cfg.name);

    if (!workerInfo) {
      return;
    }

    const retryCount = (workerInfo as any).retryCount || 0;

    if (retryCount >= maxRetries) {
      logger.error({ worker: cfg.name }, 'Max retries reached, not restarting');
      return;
    }

    (workerInfo as any).retryCount = retryCount + 1;

    logger.info({ worker: cfg.name, attempt: retryCount + 1 }, 'Restarting worker');

    setTimeout(() => {
      this.startWorker(cfg);
    }, 5000);
  }

  private startHeartbeatMonitor(): void {
    setInterval(() => {
      const now = new Date();
      const heartbeatTimeout = 60000;

      for (const [name, workerInfo] of this.workers) {
        if (workerInfo.status !== 'running') continue;

        if (workerInfo.lastHeartbeat) {
          const elapsed = now.getTime() - workerInfo.lastHeartbeat.getTime();
          if (elapsed > heartbeatTimeout) {
            logger.warn({ worker: name }, 'Worker heartbeat timeout, restarting');
            workerInfo.process.kill('SIGTERM');
            this.restartWorker(workerInfo.config);
          }
        }
      }
    }, 30000);
  }

  getWorkerStatus(): WorkerStatus[] {
    const statuses: WorkerStatus[] = [];

    for (const [name, workerInfo] of this.workers) {
      statuses.push({
        name,
        status: workerInfo.status,
        lastHeartbeat: workerInfo.lastHeartbeat?.toISOString() || null,
        pid: workerInfo.process.pid || null,
      });
    }

    return statuses;
  }

  stopAll(): void {
    this.isShuttingDown = true;

    logger.info('Stopping all workers');

    for (const [name, workerInfo] of this.workers) {
      logger.info({ worker: name }, 'Sending SIGTERM to worker');
      workerInfo.process.kill('SIGTERM');
    }

    setTimeout(() => {
      for (const [name, workerInfo] of this.workers) {
        if (!workerInfo.process.killed) {
          logger.info({ worker: name }, 'Sending SIGKILL to worker');
          workerInfo.process.kill('SIGKILL');
        }
      }
    }, 10000);
  }
}

export const processManager = new ProcessManager();
