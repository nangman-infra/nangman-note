import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AppHealthStatus {
  status: 'ok';
  database: 'up';
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth(): Promise<AppHealthStatus> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
